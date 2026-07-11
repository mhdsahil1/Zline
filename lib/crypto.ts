// Utility functions for client-side End-to-End Encryption using the Web Crypto API.

// Helpers for base64 conversions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate RSA-OAEP Keypair
export async function generateE2EKeypair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
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

// Export CryptoKey as JWK string
export async function exportKeyToJwk(key: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

// Import Public Key from JWK string
export async function importPublicKey(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// Import Private Key from JWK string
export async function importPrivateKey(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// Hybrid Encryption (AES-GCM for message content, RSA-OAEP for AES key)
export async function encryptMessage(
  text: string,
  recipientPublicKeyJwk: string,
  senderPublicKeyJwk?: string
): Promise<{ encryptedContent: string; encAesKey: string; encAesKeyForSender?: string; iv: string }> {
  // 1. Import recipient public key
  const rsaPubKey = await importPublicKey(recipientPublicKeyJwk);

  // 2. Generate random AES-GCM key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  // 3. Encrypt content with AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encryptedBuf = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    encoder.encode(text)
  );

  // 4. Export AES key to raw bytes
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // 5. Encrypt AES key using recipient's RSA public key
  const encryptedAesKeyBuf = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    rsaPubKey,
    rawAesKey
  );

  let encAesKeyForSender: string | undefined = undefined;
  if (senderPublicKeyJwk) {
    try {
      const senderRsaPubKey = await importPublicKey(senderPublicKeyJwk);
      const encryptedAesKeyForSenderBuf = await window.crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
        },
        senderRsaPubKey,
        rawAesKey
      );
      encAesKeyForSender = arrayBufferToBase64(encryptedAesKeyForSenderBuf);
    } catch (err) {
      console.error("Failed to encrypt AES key for sender:", err);
    }
  }

  // 6. Convert buffers to base64
  return {
    encryptedContent: arrayBufferToBase64(encryptedBuf),
    encAesKey: arrayBufferToBase64(encryptedAesKeyBuf),
    encAesKeyForSender,
    iv: arrayBufferToBase64(iv.buffer),
  };
}

// Decrypt message
export async function decryptMessage(
  encryptedContentBase64: string,
  encAesKeyBase64: string,
  ivBase64: string,
  myPrivateKeyJwk: string
): Promise<string> {
  // 1. Import my private key
  const rsaPrivKey = await importPrivateKey(myPrivateKeyJwk);

  // 2. Decode inputs
  const encryptedContentBuf = base64ToArrayBuffer(encryptedContentBase64);
  const encryptedAesKeyBuf = base64ToArrayBuffer(encAesKeyBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

  // 3. Decrypt AES key with RSA private key
  const rawAesKey = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    rsaPrivKey,
    encryptedAesKeyBuf
  );

  // 4. Import AES key
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  // 5. Decrypt content with AES-GCM
  const decryptedBuf = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    encryptedContentBuf
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuf);
}
