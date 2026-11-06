/**
 * Tavily Web Search Service for Zline AI
 * Provides resilient, cached, and sanitized search capabilities via Tavily Search API.
 */

export interface TavilySearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  score?: number;
}

export interface TavilySearchOptions {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeDomains?: string[];
  excludeDomains?: string[];
}

interface CacheEntry {
  results: TavilySearchResult[];
  timestamp: number;
}

// In-memory 10-minute short-lived cache to avoid duplicate API calls and optimize latency
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function sanitizeUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // Invalid URL
  }
  return null;
}

function cleanText(text: string, maxLength = 800): string {
  if (!text) return "";
  const cleaned = text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + "…" : cleaned;
}

/**
 * Executes a real-time web search using the Tavily REST API.
 * Never throws — returns an empty array or cached results on failure.
 */
export async function searchTavily(
  query: string,
  options: TavilySearchOptions = {}
): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[Tavily] TAVILY_API_KEY is not configured in environment.");
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase().slice(0, 300);
  if (!normalizedQuery) return [];

  // Check cache first
  const cached = searchCache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  const maxResults = Math.min(Math.max(options.maxResults || 5, 1), 8);
  const searchDepth = options.searchDepth || "advanced";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: normalizedQuery,
        search_depth: searchDepth,
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[Tavily] Search API error (${response.status}):`, errBody);
      return [];
    }

    const data = await response.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];

    // Deduplicate and sanitize results
    const seenUrls = new Set<string>();
    const sanitizedResults: TavilySearchResult[] = [];

    for (const item of rawResults) {
      if (!item.url || !item.title) continue;
      const validUrl = sanitizeUrl(item.url);
      if (!validUrl || seenUrls.has(validUrl)) continue;

      seenUrls.add(validUrl);
      sanitizedResults.push({
        title: cleanText(item.title, 120),
        url: validUrl,
        snippet: cleanText(item.content || item.snippet || "", 900),
        publishedDate: item.published_date || undefined,
        score: typeof item.score === "number" ? item.score : undefined,
      });

      if (sanitizedResults.length >= maxResults) break;
    }

    // Cache valid results
    if (sanitizedResults.length > 0) {
      searchCache.set(normalizedQuery, {
        results: sanitizedResults,
        timestamp: Date.now(),
      });

      // Simple cache size management
      if (searchCache.size > 200) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey) searchCache.delete(oldestKey);
      }
    }

    return sanitizedResults;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.warn(`[Tavily] Search query timed out after 8s: "${normalizedQuery}"`);
    } else {
      console.error("[Tavily] Search request failed:", err.message);
    }
    return [];
  }
}

