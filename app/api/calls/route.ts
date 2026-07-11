import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Call } from "@/lib/models/Call";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const userId = session.user.id;

    // Fetch calls where the user is either the caller or a participant
    const calls = await Call.find({
      $or: [
        { caller: userId },
        { participants: userId }
      ]
    })
      .populate("caller", "name image")
      .populate("participants", "name image")
      .populate("chatId", "groupName isGroup")
      .sort({ startedAt: -1 })
      .lean();

    return NextResponse.json(calls, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch call history:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
