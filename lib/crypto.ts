// Zline v3.0: Multi-Device Cryptographic Messaging & Cross-Device E2EE Engine
// Uses Web Crypto API (RSA-OAEP 2048-bit + AES-256-GCM) with IndexedDB secure key storage.

export interface IKeyEnvelope {
  deviceId: string;
  userId?: string;
  algorithm: string;
  encryptedKey: string;
}

export interface EncryptedMessageResult {
  ciphertext: string;
  iv: string;
  algorithm: "AES-256-GCM";
  keyEnvelopes: IKeyEnvelope[];
  encAesKey?: string;
  encAesKeyForSender?: string;
  cryptographicVersion: "3.0";
}

export interface LocalDeviceIdentity {
  deviceId: string;
  deviceName: string;
  deviceType: "desktop" | "laptop" | "mobile" | "tablet" | "browser";
  publicKeyJwk: string;
  privateKeyJwk: string;
  fingerprint: string;
  createdAt: number;
}

export class DecryptionError extends Error {
  public code: "NO_ENVELOPE_FOR_DEVICE" | "INTEGRITY_CHECK_FAILED" | "KEY_UNWRAP_FAILED" | "UNKNOWN";
  constructor(code: "NO_ENVELOPE_FOR_DEVICE" | "INTEGRITY_CHECK_FAILED" | "KEY_UNWRAP_FAILED" | "UNKNOWN", message: string) {
    super(message);
    this.name = "DecryptionError";
    this.code = code;
  }
}

// ─── Environment-agnostic Web Crypto and Base64 Helpers ─────────────────────

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  // Node.js fallback
  try {
    const nodeCrypto = require("crypto");
    if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
      return nodeCrypto.webcrypto.subtle;
    }
  } catch {
    // ignore
  }
  throw new Error("Web Crypto API (subtle) is not supported in this runtime environment.");
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  // Node.js fallback
  try {
    const nodeCrypto = require("crypto");
    if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.getRandomValues) {
      return nodeCrypto.webcrypto.getRandomValues(array);
    }
    return nodeCrypto.randomFillSync(array);
  } catch {
    // ignore
  }
  throw new Error("Secure random values generator is not available.");
}

export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer as ArrayBuffer).toString("base64");
  }
  let binary = "";
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Keypair Generation & Import/Export ────────────────────────────────────

export async function generateE2EKeypair(): Promise<CryptoKeyPair> {
  const subtle = getSubtleCrypto();
  return await subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKeyToJwk(key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const jwk = await subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkStr: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const jwk = typeof jwkStr === "string" ? JSON.parse(jwkStr) : jwkStr;
  return await subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKey(jwkStr: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const jwk = typeof jwkStr === "string" ? JSON.parse(jwkStr) : jwkStr;
  return await subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// ─── Cryptographic Fingerprint Calculation ─────────────────────────────────

/**
 * Computes a standardized SHA-256 fingerprint for a public key.
 * Formatted as 8 groups of 4 hex characters: "XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX"
 */
export async function computeFingerprint(publicKeyJwkOrStr: string | object): Promise<string> {
  try {
    const jwk = typeof publicKeyJwkOrStr === "string" ? JSON.parse(publicKeyJwkOrStr) : publicKeyJwkOrStr;
    // Canonicalize key fields: kty, n, e
    const canonical = JSON.stringify({
      e: jwk.e,
      kty: jwk.kty,
      n: jwk.n,
    });

    const subtle = getSubtleCrypto();
    const encoder = new TextEncoder();
    const digest = await subtle.digest("SHA-256", encoder.encode(canonical));
    const bytes = new Uint8Array(digest);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    // Group into 8 blocks of 4
    const chunks: string[] = [];
    for (let i = 0; i < 32; i += 4) {
      chunks.push(hex.substring(i, i + 4));
    }
    return chunks.join(" ");
  } catch (err) {
    console.error("Failed to compute fingerprint:", err);
    return "INVALID_FINGERPRINT";
  }
}

// ─── Device Detection Utilities ───────────────────────────────────────────

export function detectDeviceType(): "desktop" | "laptop" | "mobile" | "tablet" | "browser" {
  if (typeof window === "undefined" || !navigator) return "browser";
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return "mobile";
  }
  if (/macintosh|mac os x/i.test(ua)) {
    return "laptop";
  }
  if (/windows|linux/i.test(ua)) {
    return "desktop";
  }
  return "browser";
}

export function detectDeviceName(): string {
  if (typeof window === "undefined" || !navigator) return "Zline Web Client";
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.indexOf("Firefox") > -1) browser = "Firefox";
  else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Internet";
  else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
  else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
  else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Edge";
  else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
  else if (ua.indexOf("Safari") > -1) browser = "Safari";

  let os = "Device";
  if (ua.indexOf("Win") !== -1) os = "Windows";
  else if (ua.indexOf("Mac") !== -1) os = "macOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";

  return `${browser} on ${os}`;
}

// ─── IndexedDB Key Storage ────────────────────────────────────────────────

const IDB_NAME = "zline_secure_e2ee_db";
const IDB_STORE = "device_keys";
const IDB_VERSION = 1;

function openKeyDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "userId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("IndexedDB open failed, fallback to memory/localStorage");
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function getStoredLocalDevice(userId: string): Promise<LocalDeviceIdentity | null> {
  if (typeof window === "undefined") return null;

  try {
    const db = await openKeyDatabase();
    if (db) {
      const result = await new Promise<LocalDeviceIdentity | null>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, "readonly");
          const store = tx.objectStore(IDB_STORE);
          const req = store.get(userId);
          req.onsuccess = () => resolve(req.result?.device || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (result) return result;
    }

    // Fallback: Check localStorage for v2 legacy keys and migrate them
    const legacyPriv = localStorage.getItem(`zline_e2e_private_key_${userId}`) || localStorage.getItem("zline_e2e_private_key");
    const legacyPub = localStorage.getItem(`zline_e2e_public_key_${userId}`) || localStorage.getItem("zline_e2e_public_key");
    const legacyDevId = localStorage.getItem(`zline_device_id_${userId}`);

    if (legacyPriv && legacyPub) {
      const deviceId = legacyDevId || "dev_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const fingerprint = await computeFingerprint(legacyPub);
      const migrated: LocalDeviceIdentity = {
        deviceId,
        deviceName: detectDeviceName(),
        deviceType: detectDeviceType(),
        publicKeyJwk: legacyPub,
        privateKeyJwk: legacyPriv,
        fingerprint,
        createdAt: Date.now(),
      };
      // Save migrated keys into IndexedDB
      await saveLocalDevice(userId, migrated);
      // Clean up legacy localStorage keys
      try {
        localStorage.removeItem(`zline_e2e_private_key_${userId}`);
        localStorage.removeItem("zline_e2e_private_key");
        localStorage.setItem(`zline_device_id_${userId}`, deviceId);
        localStorage.setItem(`zline_device_fingerprint_${userId}`, fingerprint);
      } catch {
        // ignore
      }
      return migrated;
    }
  } catch (err) {
    console.error("Error reading stored local device:", err);
  }
  return null;
}

export async function saveLocalDevice(userId: string, device: LocalDeviceIdentity): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await openKeyDatabase();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const store = tx.objectStore(IDB_STORE);
          const req = store.put({ userId, device });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      });
    }

    // Mirror deviceId and fingerprint to localStorage for fast synchronous UI access
    try {
      localStorage.setItem(`zline_device_id_${userId}`, device.deviceId);
      localStorage.setItem(`zline_device_fingerprint_${userId}`, device.fingerprint);
    } catch {
      // ignore
    }
  } catch (err) {
    console.error("Failed to save local device to IndexedDB:", err);
  }
}

export async function clearLocalDevice(userId: string): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await openKeyDatabase();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const store = tx.objectStore(IDB_STORE);
          const req = store.delete(userId);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    localStorage.removeItem(`zline_device_id_${userId}`);
    localStorage.removeItem(`zline_device_fingerprint_${userId}`);
    localStorage.removeItem(`zline_e2e_private_key_${userId}`);
    localStorage.removeItem(`zline_e2e_public_key_${userId}`);
  } catch (err) {
    console.error("Error clearing local device:", err);
  }
}

export async function getOrCreateLocalDevice(userId: string): Promise<LocalDeviceIdentity> {
  const existing = await getStoredLocalDevice(userId);
  if (existing) {
    return existing;
  }

  // Generate fresh independent cryptographic identity for this device
  const keypair = await generateE2EKeypair();
  const privateKeyJwk = await exportKeyToJwk(keypair.privateKey);
  const publicKeyJwk = await exportKeyToJwk(keypair.publicKey);
  const fingerprint = await computeFingerprint(publicKeyJwk);

  const deviceId = "dev_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const device: LocalDeviceIdentity = {
    deviceId,
    deviceName: detectDeviceName(),
    deviceType: detectDeviceType(),
    publicKeyJwk,
    privateKeyJwk,
    fingerprint,
    createdAt: Date.now(),
  };

  await saveLocalDevice(userId, device);
  return device;
}

// ─── Multi-Recipient Message Encryption (v3.0) ─────────────────────────────

export interface RecipientDeviceTarget {
  deviceId: string;
  userId?: string;
  publicKey: string; // JWK string
}

/**
 * Encrypts a message using AES-256-GCM and wraps the symmetric key separately
 * for every authorized recipient device and sender device using RSA-OAEP.
 */
export async function encryptMultiRecipientMessage(
  text: string,
  targetDevices: RecipientDeviceTarget[],
  senderDevice?: RecipientDeviceTarget
): Promise<EncryptedMessageResult> {
  if (!text) {
    throw new Error("Cannot encrypt empty message.");
  }
  if (!targetDevices || targetDevices.length === 0) {
    throw new Error("No target devices available for encryption.");
  }

  const subtle = getSubtleCrypto();

  // 1. Generate fresh 256-bit AES-GCM message key
  const aesKey = await subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Generate cryptographically random 96-bit (12-byte) IV
  const iv = getRandomValues(new Uint8Array(12));

  // 3. Encrypt payload content with AES-GCM
  const encoder = new TextEncoder();
  const encryptedBuf = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    aesKey,
    encoder.encode(text)
  );

  // 4. Export raw AES key bytes for key-wrapping
  const rawAesKey = await subtle.exportKey("raw", aesKey);

  // 5. Wrap AES key for all recipient devices and sender devices
  const allDevicesToWrap = [...targetDevices];
  if (senderDevice && !allDevicesToWrap.some((d) => d.deviceId === senderDevice.deviceId)) {
    allDevicesToWrap.push(senderDevice);
  }

  const keyEnvelopes: IKeyEnvelope[] = [];
  let encAesKeyForFirstRecipient: string | undefined = undefined;
  let encAesKeyForSender: string | undefined = undefined;

  for (const target of allDevicesToWrap) {
    try {
      const rsaPubKey = await importPublicKey(target.publicKey);
      const encryptedAesKeyBuf = await subtle.encrypt(
        {
          name: "RSA-OAEP",
        },
        rsaPubKey,
        rawAesKey
      );

      const wrappedKeyBase64 = arrayBufferToBase64(encryptedAesKeyBuf);
      keyEnvelopes.push({
        deviceId: target.deviceId,
        userId: target.userId,
        algorithm: "RSA-OAEP-256",
        encryptedKey: wrappedKeyBase64,
      });

      if (!encAesKeyForFirstRecipient && target.deviceId !== senderDevice?.deviceId) {
        encAesKeyForFirstRecipient = wrappedKeyBase64;
      }
      if (senderDevice && target.deviceId === senderDevice.deviceId) {
        encAesKeyForSender = wrappedKeyBase64;
      }
    } catch (wrapErr) {
      console.warn(`Failed to wrap AES key for device ${target.deviceId}:`, wrapErr);
    }
  }

  if (keyEnvelopes.length === 0) {
    throw new Error("Failed to wrap encryption key for any authorized device.");
  }

  return {
    ciphertext: arrayBufferToBase64(encryptedBuf),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    algorithm: "AES-256-GCM",
    keyEnvelopes,
    encAesKey: encAesKeyForFirstRecipient || keyEnvelopes[0].encryptedKey,
    encAesKeyForSender,
    cryptographicVersion: "3.0",
  };
}

// ─── Multi-Device Message Decryption (v3.0) ────────────────────────────────

export async function decryptMultiRecipientMessage(
  ciphertextBase64: string,
  ivBase64: string,
  keyEnvelopes: IKeyEnvelope[] | undefined,
  currentDeviceId: string,
  myPrivateKeyJwk: string,
  legacyFallback?: {
    encAesKey?: string;
    encAesKeyForSender?: string;
    isSender?: boolean;
  }
): Promise<string> {
  const subtle = getSubtleCrypto();

  // 1. Locate key envelope for this device
  let wrappedKeyBase64: string | undefined;

  if (keyEnvelopes && keyEnvelopes.length > 0) {
    const envelope = keyEnvelopes.find((e) => e.deviceId === currentDeviceId);
    if (envelope) {
      wrappedKeyBase64 = envelope.encryptedKey;
    }
  }

  // 2. Legacy fallback if no modern envelope found
  if (!wrappedKeyBase64 && legacyFallback) {
    if (legacyFallback.isSender && legacyFallback.encAesKeyForSender) {
      wrappedKeyBase64 = legacyFallback.encAesKeyForSender;
    } else if (legacyFallback.encAesKey) {
      wrappedKeyBase64 = legacyFallback.encAesKey;
    }
  }

  if (!wrappedKeyBase64) {
    throw new DecryptionError(
      "NO_ENVELOPE_FOR_DEVICE",
      "No cryptographic key envelope found for this device."
    );
  }

  // 3. Import local private key
  let rsaPrivKey: CryptoKey;
  try {
    rsaPrivKey = await importPrivateKey(myPrivateKeyJwk);
  } catch (err) {
    throw new DecryptionError("KEY_UNWRAP_FAILED", "Failed to import local private key.");
  }

  // 4. Unwrap AES message key with RSA-OAEP
  let rawAesKey: ArrayBuffer;
  try {
    const encryptedAesKeyBuf = base64ToArrayBuffer(wrappedKeyBase64);
    rawAesKey = await subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      rsaPrivKey,
      encryptedAesKeyBuf
    );
  } catch (err) {
    throw new DecryptionError("KEY_UNWRAP_FAILED", "Failed to unwrap AES message key.");
  }

  // 5. Import raw AES key
  let aesKey: CryptoKey;
  try {
    aesKey = await subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
  } catch (err) {
    throw new DecryptionError("KEY_UNWRAP_FAILED", "Failed to import AES key.");
  }

  // 6. Decrypt ciphertext with AES-GCM
  try {
    const encryptedContentBuf = base64ToArrayBuffer(ciphertextBase64);
    const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

    const decryptedBuf = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
      },
      aesKey,
      encryptedContentBuf
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuf);
  } catch (err) {
    throw new DecryptionError(
      "INTEGRITY_CHECK_FAILED",
      "Message authentication failed: ciphertext or IV has been tampered with."
    );
  }
}

// ─── Backward-compatible v2.0 Encryption & Decryption Wrappers ─────────────

export async function encryptMessage(
  text: string,
  recipientPublicKeyJwk: string,
  senderPublicKeyJwk?: string
): Promise<{ encryptedContent: string; encAesKey: string; encAesKeyForSender?: string; iv: string }> {
  const result = await encryptMultiRecipientMessage(
    text,
    [{ deviceId: "legacy-recipient", publicKey: recipientPublicKeyJwk }],
    senderPublicKeyJwk ? { deviceId: "legacy-sender", publicKey: senderPublicKeyJwk } : undefined
  );

  return {
    encryptedContent: result.ciphertext,
    encAesKey: result.encAesKey || "",
    encAesKeyForSender: result.encAesKeyForSender,
    iv: result.iv,
  };
}

export async function decryptMessage(
  encryptedContentBase64: string,
  encAesKeyBase64: string,
  ivBase64: string,
  myPrivateKeyJwk: string
): Promise<string> {
  return await decryptMultiRecipientMessage(
    encryptedContentBase64,
    ivBase64,
    undefined,
    "legacy",
    myPrivateKeyJwk,
    { encAesKey: encAesKeyBase64 }
  );
}
