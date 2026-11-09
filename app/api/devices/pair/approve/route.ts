import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { DevicePairing } from "@/lib/models/DevicePairing";
import { Device } from "@/lib/models/Device";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

// POST /api/devices/pair/approve - Approves an incoming device pairing request from a trusted device
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { pairingId, challenge, approvingDeviceId } = await req.json();

    if (!pairingId || !challenge) {
      return NextResponse.json(
        { message: "pairingId and challenge are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const pairing = await DevicePairing.findOne({ pairingId });
    if (!pairing) {
      return NextResponse.json({ message: "Pairing session not found or expired" }, { status: 404 });
    }

    if (pairing.status !== "pending") {
      return NextResponse.json(
        { message: `Pairing session is already ${pairing.status}` },
        { status: 400 }
      );
    }

    if (pairing.expiresAt < new Date()) {
      pairing.status = "expired";
      await pairing.save();
      return NextResponse.json({ message: "Pairing challenge has expired" }, { status: 400 });
    }

    // Verify challenge matches
    if (pairing.challenge !== challenge) {
      return NextResponse.json({ message: "Invalid challenge verification" }, { status: 403 });
    }

    // Check device limit
    const activeCount = await Device.countDocuments({
      userId: session.user.id,
      isRevoked: false,
    });

    if (activeCount >= 10) {
      return NextResponse.json(
        { message: "Account has reached maximum authorized devices (10)" },
        { status: 400 }
      );
    }

    // Register or activate target device in Device collection
    await Device.findOneAndUpdate(
      { deviceId: pairing.targetDeviceId },
      {
        userId: session.user.id,
        deviceId: pairing.targetDeviceId,
        deviceName: pairing.targetDeviceName,
        deviceType: pairing.targetDeviceType,
        publicKey: pairing.targetPublicKey,
        fingerprint: pairing.targetFingerprint,
        isVerified: true,
        verifiedByDeviceId: approvingDeviceId || "trusted-device",
        isRevoked: false,
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Generate short-lived HMAC transfer token for Device B to establish session
    const secret = process.env.NEXTAUTH_SECRET || "zline_e2ee_secret_key_v3";
    const timestamp = Date.now().toString();
    const tokenData = `${session.user.id}:${pairing.targetDeviceId}:${pairingId}:${timestamp}`;
    const signature = crypto.createHmac("sha256", secret).update(tokenData).digest("hex");
    const transferToken = `${tokenData}.${signature}`;

    pairing.status = "approved";
    pairing.approvedByUserId = session.user.id as any;
    pairing.approvedByDeviceId = approvingDeviceId;
    pairing.transferToken = transferToken;
    await pairing.save();

    return NextResponse.json(
      {
        success: true,
        message: "Device approved and linked successfully",
        targetDeviceName: pairing.targetDeviceName,
        targetFingerprint: pairing.targetFingerprint,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to approve device pairing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

