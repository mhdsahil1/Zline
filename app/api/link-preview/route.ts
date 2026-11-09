import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isSafeUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.startsWith("169.254.")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveUrl(relative: string | null | undefined, base: string): string | null {
  if (!relative) return null;
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl || !isSafeUrl(targetUrl)) {
      return NextResponse.json({ message: "Invalid or unsafe URL" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to fetch URL" }, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return NextResponse.json({ message: "URL is not an HTML document" }, { status: 400 });
    }

    // Read only the first 128KB of HTML to extract metadata quickly
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder("utf-8");
      let bytesRead = 0;
      while (bytesRead < 131072) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (html.includes("</head>")) break;
      }
      reader.cancel().catch(() => {});
    }

    const parsedBase = new URL(targetUrl);
    const siteNameMatch =
      html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
    const siteName = siteNameMatch ? siteNameMatch[1].trim() : parsedBase.hostname.replace(/^www\./, "");

    const titleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsedBase.hostname;

    const descMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : null;

    const imgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const rawImage = imgMatch ? imgMatch[1].trim() : null;
    const image = resolveUrl(rawImage, targetUrl);

    const iconMatch =
      html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
    const rawIcon = iconMatch ? iconMatch[1].trim() : "/favicon.ico";
    const favicon = resolveUrl(rawIcon, targetUrl) || `https://www.google.com/s2/favicons?domain=${parsedBase.hostname}&sz=32`;

    return NextResponse.json(
      {
        url: targetUrl,
        title,
        description,
        image,
        siteName,
        favicon,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to extract metadata";
    return NextResponse.json({ message }, { status: 500 });
  }
}

