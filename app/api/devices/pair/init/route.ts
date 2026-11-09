import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { DevicePairing } from "@/lib/models/DevicePairing";
import crypto from "crypto";
import QRCode from "qrcode";
import { computeFingerprint } from "@/lib/crypto";

// POST /api/devices/pair/init - Initiates a QR device pairing challenge for a new device
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deviceId, deviceName, deviceType, publicKey } = body;

    if (!deviceId || !deviceName || !publicKey) {
      return NextResponse.json(
        { message: "deviceId, deviceName, and publicKey are required" },
        { status: 400 }
      );
    }

    // Verify fingerprint
    const fingerprint = await computeFingerprint(publicKey);

    await connectDB();

    // Generate cryptographically secure pairing ID and challenge
    const pairingId = "pair_" + crypto.randomBytes(16).toString("hex");
    const challenge = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    const pairing = await DevicePairing.create({
      pairingId,
      targetDeviceId: deviceId,
      targetDeviceName: deviceName,
      targetDeviceType: deviceType || "browser",
      targetPublicKey: publicKey,
      targetFingerprint: fingerprint,
      challenge,
      status: "pending",
      expiresAt,
    });

    // Generate secure QR payload
    const qrPayload = JSON.stringify({
      protocol: "zline-pair-v3",
      pairingId,
      challenge,
      deviceId,
      deviceName,
      fingerprint,
      exp: expiresAt.getTime(),
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
      color: {
        dark: "#1e1b4b",
        light: "#ffffff",
      },
    });

    return NextResponse.json(
      {
        pairingId,
        challenge,
        fingerprint,
        qrCodeDataUrl,
        rawPayload: qrPayload,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to initiate device pairing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

