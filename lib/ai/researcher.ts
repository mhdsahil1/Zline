/**
 * Research Coordinator for Zline AI
 * Orchestrates Tavily Web Search and Obscura Headless Browser deep extraction.
 */

import { searchTavily, TavilySearchResult } from "@/lib/tavily";
import { browseWebsite, ResearchSource } from "@/lib/obscura";

export interface ResearchProgressStatus {
  stage: "searching" | "finding" | "browsing" | "extracting" | "analyzing" | "generating" | "idle";
  query?: string;
  sourceCount?: number;
  url?: string;
  siteName?: string;
}

export interface ExecuteResearchOptions {
  directUrl?: string;
  maxSearchResults?: number;
  maxDeepCrawlPages?: number;
  onProgress?: (status: ResearchProgressStatus) => void;
}

/**
 * Executes a full research workflow combining Tavily search discovery
 * and Obscura headless browser extraction.
 */
export async function executeResearch(
  query: string,
  options: ExecuteResearchOptions = {}
): Promise<ResearchSource[]> {
  const {
    directUrl,
    maxSearchResults = 5,
    maxDeepCrawlPages = 3,
    onProgress,
  } = options;

  // SCENARIO A: Direct URL specified in prompt
  if (directUrl) {
    onProgress?.({
      stage: "browsing",
      url: directUrl,
    });

    const extraction = await browseWebsite(directUrl, {
      timeoutMs: 12000,
    });

    onProgress?.({
      stage: "extracting",
      url: directUrl,
    });

    const source: ResearchSource = {
      title: extraction.title || directUrl,
      url: directUrl,
      snippet:
        extraction.description ||
        (extraction.content ? extraction.content.slice(0, 350) + "..." : "Direct webpage extraction."),
      publishedDate: extraction.metadata?.publishedAt || undefined,
      author: extraction.metadata?.author || undefined,
      siteName: extraction.metadata?.siteName || undefined,
      browsed: extraction.success && extraction.browsedViaObscura,
      extractedContent: extraction.success ? extraction.content : undefined,
      markdownContent: extraction.success ? extraction.markdown : undefined,
    };

    onProgress?.({
      stage: "analyzing",
      sourceCount: 1,
    });

    return [source];
  }

  // SCENARIO B: Web Search with Tavily + Obscura Deep Crawl
  onProgress?.({
    stage: "searching",
    query,
  });

  let searchResults: TavilySearchResult[] = [];
  try {
    searchResults = await searchTavily(query, {
      maxResults: maxSearchResults,
      searchDepth: "advanced",
    });
  } catch (searchErr) {
    console.error("[Research] Tavily search retrieval failed:", searchErr);
  }

  if (searchResults.length === 0) {
    return [];
  }

  onProgress?.({
    stage: "finding",
    sourceCount: searchResults.length,
    query,
  });

  // Select top N results for deeper Obscura extraction
  const toBrowse = searchResults.slice(0, maxDeepCrawlPages);

  onProgress?.({
    stage: "browsing",
    sourceCount: toBrowse.length,
    query,
  });

  // Controlled concurrency: browse target webpages with Obscura in parallel
  const browseResults = await Promise.allSettled(
    toBrowse.map(async (item) => {
      try {
        const extraction = await browseWebsite(item.url, { timeoutMs: 10000 });
        return { url: item.url, extraction };
      } catch (err: any) {
        return { url: item.url, error: err.message };
      }
    })
  );

  onProgress?.({
    stage: "extracting",
    sourceCount: toBrowse.length,
  });

  // Map extraction results into a lookup table by URL
  const extractionsByUrl = new Map<string, any>();
  for (const settled of browseResults) {
    if (settled.status === "fulfilled" && settled.value && (settled.value as any).extraction) {
      const val = settled.value as any;
      if (val.extraction.success) {
        extractionsByUrl.set(val.url, val.extraction);
      }
    }
  }

  // Assemble the unified list of research sources
  const finalSources: ResearchSource[] = searchResults.map((item) => {
    const ext = extractionsByUrl.get(item.url);

    if (ext && ext.success) {
      return {
        title: ext.title || item.title,
        url: item.url,
        snippet: ext.description || item.snippet,
        publishedDate: ext.metadata?.publishedAt || item.publishedDate,
        author: ext.metadata?.author,
        siteName: ext.metadata?.siteName,
        score: item.score,
        browsed: true,
        extractedContent: ext.content,
        markdownContent: ext.markdown,
      };
    }

    // Graceful fallback: use original Tavily snippet and metadata
    return {
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      publishedDate: item.publishedDate,
      score: item.score,
      browsed: false,
    };
  });

  onProgress?.({
    stage: "analyzing",
    sourceCount: finalSources.length,
  });

  return finalSources;
}

