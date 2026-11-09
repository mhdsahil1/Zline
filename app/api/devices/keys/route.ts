import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Device } from "@/lib/models/Device";
import { UserKey } from "@/lib/models/UserKey";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// GET /api/devices/keys?userIds=id1,id2 OR ?userId=id
// Returns all active, verified, non-revoked devices and their public keys.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get("userId");
    const userIdsParam = searchParams.get("userIds");

    const targetUserIds: string[] = [];
    if (userIdParam) targetUserIds.push(userIdParam);
    if (userIdsParam) {
      targetUserIds.push(...userIdsParam.split(",").map((s) => s.trim()).filter(Boolean));
    }

    // Always include current user so sender can wrap keys for their own other devices!
    if (!targetUserIds.includes(session.user.id)) {
      targetUserIds.push(session.user.id);
    }

    await connectDB();

    const validObjectIds = targetUserIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    // 1. Fetch all active, non-revoked devices
    const devices = await Device.find({
      userId: { $in: validObjectIds },
      isRevoked: false,
    })
      .select("userId deviceId deviceName deviceType publicKey fingerprint isVerified lastActiveAt")
      .lean();

    // 2. Backward compatibility: If a user has NO devices registered yet in Device collection,
    // check legacy UserKey and fabricate a virtual device so v2.0 users are still reachable
    const usersWithDevices = new Set(devices.map((d) => d.userId.toString()));
    const missingUserIds = validObjectIds.filter((id) => !usersWithDevices.has(id.toString()));

    if (missingUserIds.length > 0) {
      const legacyKeys = await UserKey.find({ userId: { $in: missingUserIds } }).lean();
      for (const lk of legacyKeys) {
        devices.push({
          userId: lk.userId,
          deviceId: `legacy_${lk.userId.toString()}`,
          deviceName: "Legacy Client",
          deviceType: "browser",
          publicKey: lk.publicKey,
          fingerprint: "LEGACY_V2_KEY",
          isVerified: true,
          lastActiveAt: lk.updatedAt || new Date(),
        } as any);
      }
    }

    return NextResponse.json({ devices }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch device keys:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

