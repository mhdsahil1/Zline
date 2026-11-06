/**
 * Security and SSRF Validation for Obscura Webpage Extraction
 * Strictly enforces protocols, validates DNS resolutions, and blocks all private/reserved IP spaces.
 */

import dns from "dns/promises";
import net from "net";

// Hostnames and TLDs that must be immediately blocked
const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "instance-data",
  "vault",
  "consul",
  "kubernetes.default",
]);

const FORBIDDEN_TLDS = [
  ".local",
  ".internal",
  ".lan",
  ".corp",
  ".home",
  ".arpa",
  ".onion",
  ".test",
  ".example",
  ".invalid",
];

/**
 * Checks if an IPv4 address is within private, loopback, link-local, or reserved ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Treat malformed IPs as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private-Use)
  if (a === 10) return true;

  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-Local / Cloud Metadata: AWS/GCP/Azure)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private-Use)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && parts[2] === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;

  // 192.168.0.0/16 (Private-Use)
  if (a === 192 && b === 168) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future Use)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is within private, loopback, link-local, or documentation ranges.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Unspecified :: and Loopback ::1
  if (normalized === "::" || normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:192.0.2.1)
  if (normalized.startsWith("::ffff:") || normalized.startsWith("0:0:0:0:0:ffff:")) {
    const lastPart = normalized.split(":").pop();
    if (lastPart && net.isIPv4(lastPart)) {
      return isPrivateIPv4(lastPart);
    }
  }

  // Unique Local Addresses (ULA) fc00::/7 (fc00... or fd00...)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  // Link-Local fe80::/10
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) {
    return true;
  }

  // Documentation 2001:db8::/32
  if (/^2001:0?db8:/i.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Validates any IP address (IPv4 or IPv6) against private and internal network spaces.
 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateIPv6(ip);
  }
  return true; // Unknown IP formats are treated as forbidden
}

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedUrl?: string;
  resolvedIp?: string;
}

/**
 * Performs strict SSRF validation on a target URL before allowing Obscura navigation:
 * 1. Confirms protocol is http: or https:
 * 2. Blocks known internal hostnames and TLDs
 * 3. Resolves all DNS records and asserts no record resolves to private/loopback/link-local IP addresses
 */
export async function validateUrlForBrowsing(
  rawUrl: string
): Promise<UrlValidationResult> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, reason: "URL must be a non-empty string." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "Malformed URL syntax." };
  }

  // Only allow HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  // Check username/password in URL (avoid credential stuffing or basic auth trickery)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: "User credentials in URLs are disallowed for security.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check against static forbidden hostnames
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    return {
      valid: false,
      reason: `Access to forbidden internal host "${hostname}" is blocked.`,
    };
  }

  // Check forbidden TLDs
  for (const tld of FORBIDDEN_TLDS) {
    if (hostname.endsWith(tld)) {
      return {
        valid: false,
        reason: `Access to private or local TLD "${tld}" is blocked.`,
      };
    }
  }

  // Check if hostname is an IP literal
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return {
        valid: false,
        reason: `Access to private or reserved IP address "${hostname}" is blocked.`,
      };
    }
    return {
      valid: true,
      sanitizedUrl: parsed.toString(),
      resolvedIp: hostname,
    };
  }

  // Resolve DNS to verify all destination IPs
  try {
    const addresses = await dns.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return {
        valid: false,
        reason: `DNS resolution returned no addresses for host "${hostname}".`,
      };
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        return {
          valid: false,
          reason: `Host "${hostname}" resolved to private/forbidden IP "${record.address}". Blocked for SSRF protection.`,
        };
      }
    }

    return {
      valid: true,
      sanitizedUrl: parsed.toString(),
      resolvedIp: addresses[0].address,
    };
  } catch (dnsErr: any) {
    return {
      valid: false,
      reason: `DNS lookup failed for host "${hostname}": ${dnsErr.message || "Unresolvable"}`,
    };
  }
}

