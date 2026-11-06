/**
 * Obscura CDP Connection and Discovery Service
 * Dynamically resolves the Chrome DevTools Protocol endpoint from Obscura via /json/version.
 */

import { ObscuraHealthStatus } from "./types";

interface CachedEndpoint {
  wsUrl: string;
  resolvedAt: number;
}

let cachedEndpoint: CachedEndpoint | null = null;
let lastFailureTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const FAIL_CACHE_TTL_MS = 20 * 1000; // Skip retry for 20 seconds if offline

/**
 * Normalizes and determines the base HTTP/HTTPS URL from OBSCURA_CDP_URL.
 */
export function getObscuraBaseUrl(): string {
  const envUrl = process.env.OBSCURA_CDP_URL || "http://127.0.0.1:9222";
  let normalized = envUrl.trim().replace(/\/+$/, "");

  // If provided as ws:// or wss://, convert to http:// or https:// for discovery endpoint
  if (normalized.startsWith("ws://")) {
    normalized = "http://" + normalized.slice(5);
  } else if (normalized.startsWith("wss://")) {
    normalized = "https://" + normalized.slice(6);
  }

  return normalized;
}

/**
 * Resolves the active WebSocket Debugger URL from Obscura's /json/version endpoint.
 * Handles Docker container host rewrites when Obscura advertises 127.0.0.1 internally.
 */
export async function getObscuraWebSocketUrl(): Promise<string> {
  const envUrl = process.env.OBSCURA_CDP_URL;

  // If already a full browser WebSocket debugger URL, test cache first
  if (cachedEndpoint && Date.now() - cachedEndpoint.resolvedAt < CACHE_TTL_MS) {
    return cachedEndpoint.wsUrl;
  }

  // Fail-fast if service was recently confirmed offline
  if (Date.now() - lastFailureTime < FAIL_CACHE_TTL_MS) {
    throw new Error("Obscura service is currently offline (cached failure).");
  }

  // If the user explicitly provided a full direct ws:// URL with devtools path
  if (envUrl && (envUrl.startsWith("ws://") || envUrl.startsWith("wss://")) && envUrl.includes("/devtools/browser/")) {
    cachedEndpoint = { wsUrl: envUrl, resolvedAt: Date.now() };
    return envUrl;
  }

  const baseUrl = getObscuraBaseUrl();
  const versionEndpoint = `${baseUrl}/json/version`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second discovery timeout

  try {
    const response = await fetch(versionEndpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Obscura CDP endpoint responded with status ${response.status}: ${await response.text().catch(() => "")}`
      );
    }

    const data = await response.json();
    let wsUrl: string = data.webSocketDebuggerUrl;

    if (!wsUrl) {
      throw new Error(`Obscura /json/version did not return a webSocketDebuggerUrl property.`);
    }

    // Fix host/port if Obscura inside Docker advertises 127.0.0.1 / localhost
    // but the Next.js app communicates through a custom container name or external port
    try {
      const parsedBase = new URL(baseUrl);
      const parsedWs = new URL(wsUrl);

      // If hosts differ (e.g. Obscura reports 127.0.0.1 internally, but Next.js accessed it via 'obscura:9222')
      if (parsedWs.hostname !== parsedBase.hostname || parsedWs.port !== parsedBase.port) {
        parsedWs.hostname = parsedBase.hostname;
        if (parsedBase.port) {
          parsedWs.port = parsedBase.port;
        }
        wsUrl = parsedWs.toString();
      }
    } catch {
      // Keep original wsUrl if URL parsing fails
    }

    cachedEndpoint = { wsUrl, resolvedAt: Date.now() };
    return wsUrl;
  } catch (err: any) {
    clearTimeout(timeoutId);
    // Record failure time for fast fallback
    lastFailureTime = Date.now();
    cachedEndpoint = null;
    throw new Error(`Failed to discover Obscura CDP WebSocket endpoint at "${versionEndpoint}": ${err.message}`);
  }
}

/**
 * Performs a lightweight health check against the Obscura service.
 */
export async function checkObscuraHealth(): Promise<ObscuraHealthStatus> {
  const baseUrl = getObscuraBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${baseUrl}/json/version`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        available: false,
        endpoint: baseUrl,
        error: `HTTP error ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      available: true,
      endpoint: baseUrl,
      version: data["Protocol-Version"] || "1.3",
      browser: data["Browser"] || "Obscura/Rust-CDP",
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      available: false,
      endpoint: baseUrl,
      error: err.message || "Connection refused",
    };
  }
}

/**
 * Resets the cached endpoint if a connection fails.
 */
export function invalidateObscuraEndpointCache(): void {
  cachedEndpoint = null;
}

