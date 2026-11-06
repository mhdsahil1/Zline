/**
 * Obscura Playwright-core Browser Lifecycle Management
 * Establishes CDP connections and provides isolated, disposable browser contexts.
 */

import { chromium, Browser, BrowserContext } from "playwright-core";
import { getObscuraWebSocketUrl, invalidateObscuraEndpointCache } from "./connection";

let activeBrowser: Browser | null = null;
let connectingPromise: Promise<Browser> | null = null;

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 (ZlineResearch/1.0)";

/**
 * Gets or establishes a shared Playwright Browser connection over CDP to Obscura.
 */
export async function getObscuraBrowser(): Promise<Browser> {
  if (activeBrowser && activeBrowser.isConnected()) {
    return activeBrowser;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      const wsEndpoint = await getObscuraWebSocketUrl();

      const browser = await chromium.connectOverCDP(wsEndpoint, {
        timeout: 10000, // 10s connection timeout
      });

      browser.on("disconnected", () => {
        console.warn("[Obscura] Browser instance disconnected from CDP endpoint.");
        activeBrowser = null;
        invalidateObscuraEndpointCache();
      });

      activeBrowser = browser;
      return browser;
    } catch (err: any) {
      invalidateObscuraEndpointCache();
      activeBrowser = null;
      throw new Error(`Failed to connect to Obscura browser over CDP: ${err.message}`);
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

/**
 * Creates a strictly isolated, ephemeral browser context for a single browsing session.
 * Zero cookie/localStorage/cache sharing between users.
 */
export async function createIsolatedContext(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const browser = await getObscuraBrowser();

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "UTC",
    ignoreHTTPSErrors: false, // Enforce strict TLS validation
    javaScriptEnabled: true,
    bypassCSP: false,
  });

  return { browser, context };
}

/**
 * Safely closes an isolated browser context, cleaning up all cookies, storage, and tabs.
 */
export async function closeIsolatedContext(context: BrowserContext): Promise<void> {
  try {
    await context.close();
  } catch (err: any) {
    console.warn("[Obscura] Warning when closing browser context:", err.message);
  }
}

/**
 * Gracefully disconnects the main browser connection (e.g. during shutdown).
 */
export async function disconnectObscuraBrowser(): Promise<void> {
  if (activeBrowser) {
    try {
      await activeBrowser.close();
    } catch {
      // Ignore disconnect errors
    } finally {
      activeBrowser = null;
      invalidateObscuraEndpointCache();
    }
  }
}

