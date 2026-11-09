import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { DevicePairing } from "@/lib/models/DevicePairing";

export const dynamic = "force-dynamic";

// GET /api/devices/pair/status?pairingId=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pairingId = searchParams.get("pairingId");

    if (!pairingId) {
      return NextResponse.json({ message: "pairingId is required" }, { status: 400 });
    }

    await connectDB();

    const pairing = await DevicePairing.findOne({ pairingId }).lean();
    if (!pairing) {
      return NextResponse.json({ message: "Pairing session not found or expired" }, { status: 404 });
    }

    if (pairing.status === "pending" && new Date(pairing.expiresAt) < new Date()) {
      await DevicePairing.updateOne({ pairingId }, { status: "expired" });
      return NextResponse.json({ status: "expired" }, { status: 200 });
    }

    return NextResponse.json(
      {
        status: pairing.status,
        transferToken: pairing.status === "approved" ? pairing.transferToken : undefined,
        deviceId: pairing.targetDeviceId,
        approvedByUserId: pairing.approvedByUserId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to check pairing status:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

