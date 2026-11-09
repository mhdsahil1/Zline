import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Device } from "@/lib/models/Device";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeFingerprint } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// GET /api/devices - List all registered devices for current user
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const devices = await Device.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ devices }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch devices:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/devices - Register or update a device
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { deviceId, deviceName, deviceType, publicKey, fingerprint } = body;

    if (!deviceId || !deviceName || !publicKey) {
      return NextResponse.json(
        { message: "deviceId, deviceName, and publicKey are required" },
        { status: 400 }
      );
    }

    // Server-side verification of cryptographic fingerprint
    const verifiedFingerprint = await computeFingerprint(publicKey);

    await connectDB();

    // Check if device is already registered
    const existing = await Device.findOne({ deviceId });

    if (existing) {
      if (existing.userId.toString() !== session.user.id) {
        return NextResponse.json(
          { message: "Device belongs to another user account" },
          { status: 403 }
        );
      }

      if (existing.isRevoked) {
        return NextResponse.json(
          { message: "This device has been revoked and cannot be reused" },
          { status: 403 }
        );
      }

      // Update existing device
      existing.deviceName = deviceName || existing.deviceName;
      existing.deviceType = deviceType || existing.deviceType;
      existing.publicKey = publicKey;
      existing.fingerprint = verifiedFingerprint;
      existing.lastActiveAt = new Date();
      await existing.save();

      return NextResponse.json({ success: true, device: existing }, { status: 200 });
    }

    // Check device count limit per account (e.g., maximum 10 active devices)
    const activeCount = await Device.countDocuments({
      userId: session.user.id,
      isRevoked: false,
    });

    if (activeCount >= 10) {
      return NextResponse.json(
        { message: "Maximum device limit reached (10 active devices). Please unlink an older device first." },
        { status: 400 }
      );
    }

    // Determine verification: if this is the first device registered for user, mark verified automatically
    const totalDevices = await Device.countDocuments({ userId: session.user.id });
    const isFirstDevice = totalDevices === 0;

    const newDevice = await Device.create({
      userId: session.user.id,
      deviceId,
      deviceName,
      deviceType: deviceType || "browser",
      publicKey,
      fingerprint: verifiedFingerprint,
      isVerified: isFirstDevice,
      lastActiveAt: new Date(),
    });

    return NextResponse.json({ success: true, device: newDevice }, { status: 201 });
  } catch (error) {
    console.error("Failed to register device:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/devices - Rename a device
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { deviceId, deviceName } = await req.json();

    if (!deviceId || !deviceName) {
      return NextResponse.json(
        { message: "deviceId and deviceName are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const device = await Device.findOne({ deviceId, userId: session.user.id });
    if (!device) {
      return NextResponse.json({ message: "Device not found" }, { status: 404 });
    }

    device.deviceName = deviceName.trim();
    await device.save();

    return NextResponse.json({ success: true, device }, { status: 200 });
  } catch (error) {
    console.error("Failed to rename device:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/devices - Revoke a device
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deviceIdParam = searchParams.get("deviceId");
    let deviceId = deviceIdParam;

    if (!deviceId) {
      const body = await req.json().catch(() => ({}));
      deviceId = body.deviceId;
    }

    if (!deviceId) {
      return NextResponse.json({ message: "deviceId is required" }, { status: 400 });
    }

    await connectDB();

    const device = await Device.findOne({ deviceId, userId: session.user.id });
    if (!device) {
      return NextResponse.json({ message: "Device not found" }, { status: 404 });
    }

    device.isRevoked = true;
    device.revokedAt = new Date();
    await device.save();

    return NextResponse.json(
      { success: true, message: "Device revoked successfully", deviceId },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to revoke device:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

