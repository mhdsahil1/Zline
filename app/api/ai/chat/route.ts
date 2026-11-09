import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkIpRateLimit } from "@/lib/rateLimit";
import { classifySearchIntent, SearchMode } from "@/lib/searchClassifier";
import { executeResearch } from "@/lib/ai/researcher";
import { buildZinoPrompt } from "@/lib/ai/context-builder";
import { ResearchSource } from "@/lib/obscura";

const apiKey =
  process.env.NVIDIA_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  "";
const baseURL =
  process.env.NVIDIA_BASE_URL ||
  process.env.DEEPSEEK_BASE_URL ||
  "https://integrate.api.nvidia.com/v1";
const model =
  process.env.NVIDIA_MODEL ||
  process.env.DEEPSEEK_MODEL ||
  "nvidia/nemotron-3.5-bolt-e4b";

const openai = new OpenAI({
  apiKey: apiKey || "dummy-key-for-build",
  baseURL,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { message: "Authentication required to chat with Zino." },
        { status: 401 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { message: "AI Assistant is not configured. Please set NVIDIA_API_KEY in .env." },
        { status: 503 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rate = checkIpRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          message: "Too many AI requests. Please slow down and try again shortly.",
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const searchMode: SearchMode = body.searchMode || "auto";
    const wantsStream = body.stream !== false;

    if (rawMessages.length === 0) {
      return NextResponse.json(
        { message: "Messages array cannot be empty." },
        { status: 400 }
      );
    }

    // Extract the latest user query
    const latestUserMsg = [...rawMessages].reverse().find((m: any) => m.role === "user");
    const userPrompt = String(latestUserMsg?.content || "");

    // Determine if real-time web search or direct URL browsing is required
    const searchDecision = classifySearchIntent(userPrompt, searchMode);

    // Prepare recent context messages
    const recentMessages = rawMessages.slice(-15).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").substring(0, 4000),
    }));

    // 1. Handle Streaming Response via Server-Sent Events (SSE)
    if (wantsStream) {
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          function sendEvent(event: string, data: any) {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          }

          try {
            let sources: ResearchSource[] = [];

            // Execute research (Tavily search + Obscura headless browser deep extraction)
            if (searchDecision.shouldSearch) {
              try {
                sources = await executeResearch(searchDecision.extractedQuery, {
                  directUrl: searchDecision.directUrl,
                  maxSearchResults: 5,
                  maxDeepCrawlPages: 3,
                  onProgress: (status) => {
                    sendEvent("status", status);
                  },
                });
              } catch (searchErr) {
                console.error("[Research Error] Search/browsing failed, falling back to general LLM:", searchErr);
              }

              if (sources.length > 0) {
                sendEvent("sources", {
                  sources,
                  query: searchDecision.extractedQuery,
                });
              }
            }

            sendEvent("status", { stage: "generating" });

            const finalMessages = buildZinoPrompt(
              userPrompt,
              recentMessages,
              sources,
              searchDecision.shouldSearch,
              searchDecision.extractedQuery
            );

            const stream = await openai.chat.completions.create({
              model,
              messages: finalMessages,
              temperature: 0.7,
              top_p: 0.95,
              max_tokens: 2048,
              stream: true,
            });

            let fullContent = "";

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta as any;
              const reasoning = delta?.reasoning_content || delta?.reasoning || "";
              if (reasoning) {
                sendEvent("reasoning", { text: reasoning });
              }
              const text = delta?.content || "";
              if (text) {
                fullContent += text;
                sendEvent("delta", { text });
              }
            }

            sendEvent("done", {
              content: fullContent,
              sources,
              searchQuery: searchDecision.shouldSearch ? searchDecision.extractedQuery : null,
            });

            controller.close();
          } catch (streamErr: any) {
            console.error("[Zline AI Stream Error]:", streamErr);
            sendEvent("error", {
              message: streamErr?.message || "Error generating stream response.",
            });
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // 2. Non-streaming fallback
    let sources: ResearchSource[] = [];
    if (searchDecision.shouldSearch) {
      try {
        sources = await executeResearch(searchDecision.extractedQuery, {
          directUrl: searchDecision.directUrl,
          maxSearchResults: 5,
          maxDeepCrawlPages: 3,
        });
      } catch (searchErr) {
        console.error("[Research Error] Non-streaming search/browsing failed:", searchErr);
      }
    }

    const finalMessages = buildZinoPrompt(
      userPrompt,
      recentMessages,
      sources,
      searchDecision.shouldSearch,
      searchDecision.extractedQuery
    );

    const completion = await openai.chat.completions.create({
      model,
      messages: finalMessages,
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2048,
      stream: false,
    });

    const reply =
      completion.choices[0]?.message?.content ||
      (completion.choices[0]?.message as any)?.reasoning_content ||
      "I couldn't generate a response. Please try again.";

    return NextResponse.json(
      {
        content: reply,
        role: "assistant",
        sources,
        searchQuery: searchDecision.shouldSearch ? searchDecision.extractedQuery : null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Zline AI Route Error:", error);
    return NextResponse.json(
      {
        message: error.message || "Failed to process AI chat request.",
      },
      { status: 500 }
    );
  }
}
