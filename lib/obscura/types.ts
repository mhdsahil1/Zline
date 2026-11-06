/**
 * Obscura Headless Browser Type Definitions for Zline AI
 */

export interface ObscuraMetadata {
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  author?: string | null;
  siteName?: string | null;
  language?: string | null;
}

export interface WebpageExtractionResult {
  success: boolean;
  url: string;
  finalUrl?: string;
  title: string;
  description?: string;
  content: string;
  markdown?: string;
  metadata: ObscuraMetadata;
  extractedAt: string;
  error?: string;
  browsedViaObscura: boolean;
}

export interface BrowseOptions {
  timeoutMs?: number;
  waitForSelector?: string;
  maxContentLength?: number;
  blockResources?: ("image" | "media" | "font" | "stylesheet")[];
}

export interface ObscuraHealthStatus {
  available: boolean;
  endpoint?: string;
  version?: string;
  browser?: string;
  error?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  score?: number;
  browsed?: boolean;
  extractedContent?: string;
  markdownContent?: string;
  author?: string;
  siteName?: string;
}

