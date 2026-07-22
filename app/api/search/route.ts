import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || !query.trim()) {
      return NextResponse.json({ users: [], messages: [] }, { status: 200 });
    }

    await connectDB();
    const userId = session.user.id;
    const safeQuery = query.substring(0, 100).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const regex = new RegExp(safeQuery, "i");

    // 1. Search Users
    const users = await User.find({
      _id: { $ne: userId },
      $or: [{ name: regex }, { email: regex }],
    })
      .select("-password")
      .limit(10)
      .lean();

    // 2. Search Messages
    // First find chats the user is part of
    const userChats = await Chat.find({ users: userId }).select("_id").lean();
    const chatIds = userChats.map((c) => c._id);

    const messages = await Message.find({
      chat: { $in: chatIds },
      content: regex,
      deletedFor: { $ne: userId },
      deletedForEveryone: { $ne: true },
    })
      .populate("sender", "name image")
      .populate({
        path: "chat",
        populate: { path: "users", select: "name image" },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ users, messages }, { status: 200 });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
