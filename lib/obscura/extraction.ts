/**
 * Obscura Webpage Extraction Engine for Zline AI
 * Navigates to target pages, renders dynamic JavaScript, sanitizes the DOM,
 * and extracts readable content, metadata, and markdown representations.
 */

import { BrowseOptions, WebpageExtractionResult } from "./types";
import { validateUrlForBrowsing } from "./validation";
import { createIsolatedContext, closeIsolatedContext } from "./browser";

const DEFAULT_TIMEOUT_MS = 12000; // 12 seconds per webpage
const DEFAULT_MAX_CONTENT_LENGTH = 16000; // 16k chars per page

/**
 * Browses a website with Obscura, validates security, executes scripts,
 * and extracts structured content.
 */
export async function browseWebsite(
  rawUrl: string,
  options: BrowseOptions = {}
): Promise<WebpageExtractionResult> {
  const extractedAt = new Date().toISOString();

  // 1. SSRF and Protocol Pre-Validation
  const validation = await validateUrlForBrowsing(rawUrl);
  if (!validation.valid || !validation.sanitizedUrl) {
    return {
      success: false,
      url: rawUrl,
      title: "Blocked by Security Policy",
      content: "",
      metadata: {},
      extractedAt,
      error: validation.reason || "Security validation rejected target URL.",
      browsedViaObscura: false,
    };
  }

  const targetUrl = validation.sanitizedUrl;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxContentLength = options.maxContentLength || DEFAULT_MAX_CONTENT_LENGTH;

  let isolated: { browser: any; context: any } | null = null;

  try {
    isolated = await createIsolatedContext();
    const page = await isolated.context.newPage();

    // Set sensible request timeout
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    // 2. Abort heavy unnecessary resources to speed up page load & bandwidth
    await page.route("**/*", async (route: any) => {
      const request = route.request();
      const resourceType = request.resourceType();
      const requestUrl = request.url();

      // Block heavy binary media, ads, and telemetry
      if (
        resourceType === "image" ||
        resourceType === "media" ||
        resourceType === "font"
      ) {
        return route.abort();
      }

      // Revalidate redirect destinations and third-party requests against SSRF
      try {
        const parsed = new URL(requestUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return route.abort("blockedbyclient");
        }
      } catch {
        return route.abort("blockedbyclient");
      }

      route.continue();
    });

    // 3. Navigate to page
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    // Validate response status
    const status = response ? response.status() : 200;
    const finalUrl = page.url();

    // Double check finalUrl after redirects
    if (finalUrl !== targetUrl) {
      const redirectValidation = await validateUrlForBrowsing(finalUrl);
      if (!redirectValidation.valid) {
        throw new Error(`Redirect destination "${finalUrl}" was blocked: ${redirectValidation.reason}`);
      }
    }

    if (status >= 400) {
      return {
        success: false,
        url: targetUrl,
        finalUrl,
        title: `HTTP Error ${status}`,
        content: `Webpage returned HTTP status ${status}.`,
        metadata: {},
        extractedAt,
        error: `HTTP error response: ${status}`,
        browsedViaObscura: true,
      };
    }

    // Optional wait for specific selector or brief pause for JS rendering
    if (options.waitForSelector) {
      try {
        await page.waitForSelector(options.waitForSelector, { timeout: 3000 });
      } catch {
        // Continue even if specific selector times out
      }
    } else {
      // Brief 500ms grace period for client-side frameworks (React/Vue/Next hydration)
      await page.waitForTimeout(600);
    }

    // 4. In-page evaluation: Extract metadata & clean DOM content
    const extractedData = await page.evaluate(() => {
      // Helper to query meta tags
      const getMeta = (...selectors: string[]): string | null => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const content = el.getAttribute("content") || el.getAttribute("value");
            if (content && content.trim()) return content.trim();
          }
        }
        return null;
      };

      // Extract metadata
      const title =
        getMeta('meta[property="og:title"]', 'meta[name="twitter:title"]') ||
        document.title ||
        document.querySelector("h1")?.textContent?.trim() ||
        "Untitled Page";

      const description =
        getMeta(
          'meta[name="description"]',
          'meta[property="og:description"]',
          'meta[name="twitter:description"]'
        ) || undefined;

      const canonicalUrl =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
        getMeta('meta[property="og:url"]') ||
        null;

      const author =
        getMeta(
          'meta[name="author"]',
          'meta[property="article:author"]',
          'meta[name="twitter:creator"]'
        ) ||
        document.querySelector('[rel="author"]')?.textContent?.trim() ||
        null;

      const publishedAt =
        getMeta(
          'meta[property="article:published_time"]',
          'meta[name="publication_date"]',
          'meta[name="date"]',
          'meta[property="og:published_time"]'
        ) ||
        document.querySelector("time[datetime]")?.getAttribute("datetime") ||
        null;

      const siteName =
        getMeta('meta[property="og:site_name"]') ||
        window.location.hostname.replace(/^www\./, "");

      const language = document.documentElement.lang || null;

      // Clone body to avoid mutating page state
      const clone = document.body.cloneNode(true) as HTMLElement;

      // Remove unwanted elements
      const elementsToRemove = clone.querySelectorAll(
        "script, style, noscript, iframe, svg, canvas, template, nav, footer, header, aside, form, dialog, .ad, .advertisement, [aria-hidden='true']"
      );
      elementsToRemove.forEach((el) => el.remove());

      // Attempt to find main content container
      const mainContainer = (clone.querySelector(
        "article, main, [role='main'], #main-content, #content, .post-content"
      ) || clone) as HTMLElement;

      // Generate clean readable text
      const rawText = mainContainer.innerText || mainContainer.textContent || "";
      const cleanedText = rawText
        .replace(/[\r\n\t]+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // Generate simple markdown representation
      const markdownLines: string[] = [];
      const walker = document.createTreeWalker(mainContainer, NodeFilter.SHOW_ELEMENT);
      let currentNode = walker.nextNode();

      while (currentNode) {
        const el = currentNode as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
          const level = parseInt(tag.charAt(1), 10);
          const text = el.innerText?.trim();
          if (text) {
            markdownLines.push(`${"#".repeat(level)} ${text}\n`);
          }
        } else if (tag === "p") {
          const text = el.innerText?.trim();
          if (text && text.length > 20) {
            markdownLines.push(`${text}\n`);
          }
        } else if (tag === "li") {
          const text = el.innerText?.trim();
          if (text) {
            markdownLines.push(`- ${text}`);
          }
        } else if (tag === "pre" || tag === "code") {
          const text = el.innerText?.trim();
          if (text && !markdownLines.some((l) => l.includes(text))) {
            markdownLines.push(`\`\`\`\n${text}\n\`\`\`\n`);
          }
        }

        currentNode = walker.nextNode();
      }

      const generatedMarkdown = markdownLines.join("\n").trim();

      return {
        title,
        description,
        canonicalUrl,
        author,
        publishedAt,
        siteName,
        language,
        content: cleanedText,
        markdown: generatedMarkdown || cleanedText,
      };
    });

    const truncatedContent = (extractedData.content || "").slice(0, maxContentLength);
    const truncatedMarkdown = (extractedData.markdown || "").slice(0, maxContentLength);

    return {
      success: true,
      url: targetUrl,
      finalUrl,
      title: extractedData.title,
      description: extractedData.description,
      content: truncatedContent,
      markdown: truncatedMarkdown,
      metadata: {
        canonicalUrl: extractedData.canonicalUrl,
        publishedAt: extractedData.publishedAt,
        author: extractedData.author,
        siteName: extractedData.siteName,
        language: extractedData.language,
      },
      extractedAt,
      browsedViaObscura: true,
    };
  } catch (err: any) {
    console.error(`[Obscura] Webpage extraction failed for "${targetUrl}":`, err.message);
    return {
      success: false,
      url: targetUrl,
      title: "Extraction Failed",
      content: "",
      metadata: {},
      extractedAt,
      error: err.message || "Failed to extract content via Obscura browser.",
      browsedViaObscura: false,
    };
  } finally {
    if (isolated?.context) {
      await closeIsolatedContext(isolated.context);
    }
  }
}
