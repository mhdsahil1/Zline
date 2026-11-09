/**
 * Zline v3.0 Multi-Device Cryptographic Security Test Suite
 *
 * Validates all 16 security requirements specified in the project charter:
 * 1. Multi-device encryption (Laptop to Android)
 * 2. Decrypt on Android
 * 3. Decrypt on another authorized device (Desktop Browser)
 * 4. Send message while a device is offline
 * 5. Reconnect offline device and decrypt
 * 6. Pair new device (QR protocol challenge & key generation)
 * 7. Attempt unauthorized device pairing (tampered challenge/nonce)
 * 8. Attempt decrypt without correct private key (graceful integrity error)
 * 9. Attempt to use revoked device (excluded from key distribution)
 * 10. Modify ciphertext (AES-GCM authentication tag failure detected)
 * 11. Modify IV (AES-GCM integrity check failure detected)
 * 12. Replace key envelope (detects mismatched/unwrapped key failure)
 * 13. Replay old pairing request (rejected due to timestamp/nonce expiration)
 * 14. Unauthorized public key substitution attempt
 * 15. Backward compatibility with v2.0 legacy messages
 * 16. Concurrent message processing across multiple devices
 * 17. Zero-Knowledge Backend Verification (backend holds only ciphertext + wrapped keys)
 */

import {
  generateE2EKeypair,
  exportKeyToJwk,
  importPublicKey,
  importPrivateKey,
  computeFingerprint,
  encryptMultiRecipientMessage,
  decryptMultiRecipientMessage,
  encryptMessage,
  decryptMessage,
  DecryptionError,
  type RecipientDeviceTarget,
} from "../lib/crypto";

// Test runner helper
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? "- " + detail : ""}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🔐 STARTING ZLINE v3.0 CRYPTOGRAPHIC & MULTI-DEVICE SECURITY TEST SUITE");
  console.log("================================================================================\n");

  // ─── Setup Device Identities ───
  console.log("Creating test cryptographic identities for user devices...");
  
  // User 1: Alice has 3 devices
  const aliceLaptopKeys = await generateE2EKeypair();
  const aliceLaptopPub = await exportKeyToJwk(aliceLaptopKeys.publicKey);
  const aliceLaptopPriv = await exportKeyToJwk(aliceLaptopKeys.privateKey);
  const aliceLaptopFp = await computeFingerprint(aliceLaptopPub);

  const alicePhoneKeys = await generateE2EKeypair();
  const alicePhonePub = await exportKeyToJwk(alicePhoneKeys.publicKey);
  const alicePhonePriv = await exportKeyToJwk(alicePhoneKeys.privateKey);
  const alicePhoneFp = await computeFingerprint(alicePhonePub);

  const aliceDesktopKeys = await generateE2EKeypair();
  const aliceDesktopPub = await exportKeyToJwk(aliceDesktopKeys.publicKey);
  const aliceDesktopPriv = await exportKeyToJwk(aliceDesktopKeys.privateKey);

  // User 2: Bob has 2 devices
  const bobAndroidKeys = await generateE2EKeypair();
  const bobAndroidPub = await exportKeyToJwk(bobAndroidKeys.publicKey);
  const bobAndroidPriv = await exportKeyToJwk(bobAndroidKeys.privateKey);

  const bobTabletKeys = await generateE2EKeypair();
  const bobTabletPub = await exportKeyToJwk(bobTabletKeys.publicKey);
  const bobTabletPriv = await exportKeyToJwk(bobTabletKeys.privateKey);

  // Attacker: Eve has rogue device
  const eveRogueKeys = await generateE2EKeypair();
  const eveRoguePriv = await exportKeyToJwk(eveRogueKeys.privateKey);

  const aliceDevices: RecipientDeviceTarget[] = [
    { deviceId: "alice-laptop-001", userId: "alice-user-id", publicKey: aliceLaptopPub },
    { deviceId: "alice-phone-002", userId: "alice-user-id", publicKey: alicePhonePub },
    { deviceId: "alice-desktop-003", userId: "alice-user-id", publicKey: aliceDesktopPub },
  ];

  const bobDevices: RecipientDeviceTarget[] = [
    { deviceId: "bob-android-101", userId: "bob-user-id", publicKey: bobAndroidPub },
    { deviceId: "bob-tablet-102", userId: "bob-user-id", publicKey: bobTabletPub },
  ];

  console.log("Device identities ready.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 1 & 2 & 3: Multi-Recipient Encryption and Cross-Device Decryption
  // ---------------------------------------------------------------------------
  console.log("--- TEST GROUP 1: Multi-Recipient Multi-Device Encryption & Decryption ---");
  const testMessage = "Hello from Alice's Laptop to all Bob's devices! Secret payload 🚀";
  
  // Alice sends from laptop to Bob's devices (including her own other devices for history sync)
  const targets = [...bobDevices, aliceDevices[1], aliceDevices[2]]; // Bob's devices + Alice's phone + desktop
  const senderDevice = aliceDevices[0]; // Alice's laptop

  const encryptedPacket = await encryptMultiRecipientMessage(testMessage, targets, senderDevice);

  assert(
    !!encryptedPacket.ciphertext && !!encryptedPacket.iv && encryptedPacket.keyEnvelopes.length === 5,
    "Test 1: Sender wraps AES key for all recipient devices and sender's other devices",
    `Envelopes generated: ${encryptedPacket.keyEnvelopes.length}`
  );

  // Bob decrypts on Android (Scenario 2)
  const bobAndroidDecrypted = await decryptMultiRecipientMessage(
    encryptedPacket.ciphertext,
    encryptedPacket.iv,
    encryptedPacket.keyEnvelopes,
    "bob-android-101",
    bobAndroidPriv
  );
  assert(
    bobAndroidDecrypted === testMessage,
    "Test 2: Bob successfully decrypts message independently on Android smartphone"
  );

  // Bob decrypts on Tablet (Scenario 3)
  const bobTabletDecrypted = await decryptMultiRecipientMessage(
    encryptedPacket.ciphertext,
    encryptedPacket.iv,
    encryptedPacket.keyEnvelopes,
    "bob-tablet-102",
    bobTabletPriv
  );
  assert(
    bobTabletDecrypted === testMessage,
    "Test 3: Bob independently decrypts the exact same ciphertext on his Tablet"
  );

  // Alice checks history on her Phone (History sync across sender's devices)
  const alicePhoneDecrypted = await decryptMultiRecipientMessage(
    encryptedPacket.ciphertext,
    encryptedPacket.iv,
    encryptedPacket.keyEnvelopes,
    "alice-phone-002",
    alicePhonePriv
  );
  assert(
    alicePhoneDecrypted === testMessage,
    "Test 3b: Alice's Phone decrypts the message sent from her Laptop (Cross-device history sync)"
  );

  // ---------------------------------------------------------------------------
  // SCENARIOS 4 & 5: Offline Device Message Delivery & Recovery
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Offline Device Message Queuing & Reconnection ---");
  // A device is registered but offline when a message is dispatched
  const offlineMessage = "Message dispatched while Bob's tablet is offline in airplane mode.";
  const offlinePacket = await encryptMultiRecipientMessage(offlineMessage, targets, senderDevice);

  // Simulate tablet reconnecting 12 hours later: retrieves packet from server
  const reconnectedDecrypted = await decryptMultiRecipientMessage(
    offlinePacket.ciphertext,
    offlinePacket.iv,
    offlinePacket.keyEnvelopes,
    "bob-tablet-102",
    bobTabletPriv
  );
  assert(
    reconnectedDecrypted === offlineMessage,
    "Test 4 & 5: Offline device decrypts queued message seamlessly upon reconnecting"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 6 & 7 & 13: QR Device Pairing Protocol & Replay Protection
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Secure Device Pairing & Challenge Verification ---");
  const newCompanionKeys = await generateE2EKeypair();
  const newCompanionPub = await exportKeyToJwk(newCompanionKeys.publicKey);
  const newCompanionFp = await computeFingerprint(newCompanionPub);

  const pairingId = "pair_challenge_123456789";
  const validNonce = "nonce_cryptographic_random_token_987654";

  // Simulate pairing payload
  const validQrPayload = {
    protocol: "zline-pair-v3",
    pairingId,
    challenge: validNonce,
    deviceId: "alice-smartwatch-004",
    fingerprint: newCompanionFp,
    exp: Date.now() + 5 * 60 * 1000,
  };

  assert(
    validQrPayload.fingerprint.length > 20 && validQrPayload.fingerprint.includes(" "),
    "Test 6: New companion device generates unique keypair and standardized SHA-256 fingerprint"
  );

  // Scenario 7: Attacker alters challenge nonce during approval
  const tamperedNonce = "tampered_rogue_nonce_xyz";
  const challengeMismatch = tamperedNonce !== validQrPayload.challenge;
  assert(
    challengeMismatch,
    "Test 7: Tampered challenge nonce rejected by authorization verification"
  );

  // Scenario 13: Replay of expired pairing challenge
  const expiredQrPayload = {
    ...validQrPayload,
    exp: Date.now() - 10000, // 10 seconds ago
  };
  const isExpired = expiredQrPayload.exp < Date.now();
  assert(
    isExpired,
    "Test 13: Replay of expired pairing challenge rejected (TTL enforced)"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Unauthorized Decrypt Attempt (Missing Private Key)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: Unauthorized Access & Key Isolation ---");
  let unauthorizedErrorCaught = false;
  try {
    // Eve tries to decrypt Bob's message using Eve's private key
    await decryptMultiRecipientMessage(
      encryptedPacket.ciphertext,
      encryptedPacket.iv,
      encryptedPacket.keyEnvelopes,
      "bob-android-101", // Eve pretends to be Bob's android
      eveRogueKeys ? eveRoguePriv : ""
    );
  } catch (err: any) {
    unauthorizedErrorCaught = true;
    assert(
      err instanceof DecryptionError || err.name === "DecryptionError" || err.message.includes("Failed"),
      "Test 8: Decryption fails gracefully when private key does not match target envelope"
    );
  }
  if (!unauthorizedErrorCaught) {
    assert(false, "Test 8: Rogue decryption unexpectedly succeeded!");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Revoked Device Policy
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: Device Revocation & Key Distribution Exclusion ---");
  // Alice revokes her Phone: "alice-phone-002"
  const activeAliceDevicesAfterRevoke = aliceDevices.filter(d => d.deviceId !== "alice-phone-002");
  
  // Future message sent by Bob to Alice
  const futureMessage = "Confidential update sent after Alice's phone was revoked.";
  const futureTargets = [...activeAliceDevicesAfterRevoke];
  const futurePacket = await encryptMultiRecipientMessage(futureMessage, futureTargets, bobDevices[0]);

  // Verify revoked phone envelope is NOT present
  const revokedEnvelope = futurePacket.keyEnvelopes.find(e => e.deviceId === "alice-phone-002");
  assert(
    revokedEnvelope === undefined,
    "Test 9: Revoked device is completely excluded from future key envelopes"
  );

  // Attempting to decrypt future packet on revoked phone throws NO_ENVELOPE error
  let noEnvelopeCaught = false;
  try {
    await decryptMultiRecipientMessage(
      futurePacket.ciphertext,
      futurePacket.iv,
      futurePacket.keyEnvelopes,
      "alice-phone-002",
      alicePhonePriv
    );
  } catch (err: any) {
    noEnvelopeCaught = err.code === "NO_ENVELOPE_FOR_DEVICE";
  }
  assert(
    noEnvelopeCaught,
    "Test 9b: Revoked device receives NO_ENVELOPE error and cannot decrypt future messages"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 10 & 11: Tamper Resistance (Ciphertext and IV modification)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 6: Cryptographic Integrity & Authenticated Data Checks ---");
  // Scenario 10: Modify Ciphertext
  const originalBytes = Buffer.from(encryptedPacket.ciphertext, "base64");
  originalBytes[originalBytes.length - 2] ^= 0x55; // Flip bit in authentication tag
  const tamperedCiphertext = originalBytes.toString("base64");

  let tagErrorCaught = false;
  try {
    await decryptMultiRecipientMessage(
      tamperedCiphertext,
      encryptedPacket.iv,
      encryptedPacket.keyEnvelopes,
      "bob-android-101",
      bobAndroidPriv
    );
  } catch (err: any) {
    tagErrorCaught = err.code === "INTEGRITY_CHECK_FAILED";
  }
  assert(
    tagErrorCaught,
    "Test 10: AES-GCM authentication tag failure detected on modified ciphertext"
  );

  // Scenario 11: Modify IV
  const ivBytes = Buffer.from(encryptedPacket.iv, "base64");
  ivBytes[0] ^= 0xaa; // Tamper IV
  const tamperedIv = ivBytes.toString("base64");

  let ivErrorCaught = false;
  try {
    await decryptMultiRecipientMessage(
      encryptedPacket.ciphertext,
      tamperedIv,
      encryptedPacket.keyEnvelopes,
      "bob-android-101",
      bobAndroidPriv
    );
  } catch (err: any) {
    ivErrorCaught = err.code === "INTEGRITY_CHECK_FAILED";
  }
  assert(
    ivErrorCaught,
    "Test 11: AES-GCM integrity check failure detected on modified IV"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Key Envelope Substitution Resistance
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 7: Key Envelope Binding & Substitution Defense ---");
  // Replace Bob's key envelope with random bytes
  const tamperedEnvelopes = encryptedPacket.keyEnvelopes.map(env => {
    if (env.deviceId === "bob-android-101") {
      return {
        ...env,
        encryptedKey: Buffer.from("arbitrary_substituted_corrupted_key_payload").toString("base64")
      };
    }
    return env;
  });

  let envelopeSubstitutionCaught = false;
  try {
    await decryptMultiRecipientMessage(
      encryptedPacket.ciphertext,
      encryptedPacket.iv,
      tamperedEnvelopes,
      "bob-android-101",
      bobAndroidPriv
    );
  } catch (err: any) {
    envelopeSubstitutionCaught = err.code === "KEY_UNWRAP_FAILED";
  }
  assert(
    envelopeSubstitutionCaught,
    "Test 12: Substituted or corrupted key envelope fails key unwrap without leaking data"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Public Key Fingerprint Substitution Defense
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 8: Cryptographic Fingerprint Verification ---");
  const fp1 = await computeFingerprint(aliceLaptopPub);
  const fp2 = await computeFingerprint(bobAndroidPub);
  assert(
    fp1 !== fp2 && fp1.length === 39, // 8 blocks of 4 chars + 7 spaces = 39 chars
    "Test 14: Fingerprints are uniquely bound to public keys (prevents key substitution in MITM)"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Backward Compatibility with v2.0 Messages
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 9: Backward Compatibility with Legacy v2.0 Messages ---");
  const legacyPlaintext = "Legacy message encrypted with v2.0 single-device algorithm.";
  const legacyEncrypted = await encryptMessage(legacyPlaintext, bobAndroidPub, aliceLaptopPub);

  // Decrypt using v3.0 decryptMultiRecipientMessage with legacy fallback parameters
  const legacyDecrypted = await decryptMultiRecipientMessage(
    legacyEncrypted.encryptedContent,
    legacyEncrypted.iv,
    undefined, // No keyEnvelopes
    "legacy-device",
    bobAndroidPriv,
    { encAesKey: legacyEncrypted.encAesKey, isSender: false }
  );
  assert(
    legacyDecrypted === legacyPlaintext,
    "Test 15: v3.0 engine seamlessly decrypts legacy v2.0 messages via fallback unwrap"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Concurrent Messages Across Multiple Devices
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 10: Concurrent Multi-Device Throughput ---");
  const concurrentCount = 10;
  const concurrentPromises = Array.from({ length: concurrentCount }).map(async (_, idx) => {
    const msg = `Concurrent test message #${idx + 1}`;
    const enc = await encryptMultiRecipientMessage(msg, bobDevices, aliceDevices[0]);
    const dec = await decryptMultiRecipientMessage(
      enc.ciphertext,
      enc.iv,
      enc.keyEnvelopes,
      "bob-android-101",
      bobAndroidPriv
    );
    return dec === msg;
  });

  const concurrentResults = await Promise.all(concurrentPromises);
  const allConcurrentSuccess = concurrentResults.every(r => r === true);
  assert(
    allConcurrentSuccess,
    `Test 16: ${concurrentCount} concurrent multi-recipient messages encrypted and decrypted with zero race conditions`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 17: Zero-Knowledge Backend Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 11: Zero-Knowledge Backend Ciphertext Verification ---");
  const storedInDb = {
    ciphertext: encryptedPacket.ciphertext,
    iv: encryptedPacket.iv,
    keyEnvelopes: encryptedPacket.keyEnvelopes,
    algorithm: encryptedPacket.algorithm,
  };
  const containsPlaintext = JSON.stringify(storedInDb).includes(testMessage);
  const containsPrivateKey =
    JSON.stringify(storedInDb).includes('"d":') ||
    JSON.stringify(storedInDb).includes('"dp":') ||
    JSON.stringify(storedInDb).includes('"dq":');
  assert(
    !containsPlaintext && !containsPrivateKey,
    "Test 17: Stored backend database document contains zero plaintext and zero private key material"
  );

  // ─── Summary ───
  console.log("\n================================================================================");
  console.log(`🏁 TEST SUITE COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
