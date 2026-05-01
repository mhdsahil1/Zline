import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Chat } from "@/lib/models/Chat";
import { Message } from "@/lib/models/Message";
import { User } from "@/lib/models/User";
import mongoose from "mongoose";
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

    // Find all chats the user is part of, sorted by latest activity
    const chats = await Chat.find({ users: userId })
      .populate("users", "name email image isOnline lastSeen")
      .populate({
        path: "latestMessage",
        select: "content sender createdAt type",
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Get unread counts for each chat
    const chatIds = chats.map((c) => c._id);
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          chat: { $in: chatIds },
          sender: { $ne: new mongoose.Types.ObjectId(userId) },
          status: { $ne: "seen" },
          deletedFor: { $ne: new mongoose.Types.ObjectId(userId) },
          deletedForEveryone: { $ne: true },
        },
      },
      { $group: { _id: "$chat", count: { $sum: 1 } } },
    ]);

    const unreadMap = new Map(
      unreadCounts.map((item) => [item._id.toString(), item.count])
    );

    // Build response with chat info
    const result = chats.map((chat) => {
      const otherUsers = (chat.users as any[]).filter(
        (u) => u._id.toString() !== userId
      );

      return {
        _id: chat._id,
        isGroup: chat.isGroup,
        groupName: chat.groupName,
        users: chat.users,
        // For 1-on-1 chats, show the other user's info
        chatName: chat.isGroup
          ? chat.groupName
          : otherUsers[0]?.name || "Unknown",
        chatImage: chat.isGroup ? null : otherUsers[0]?.image,
        chatInitial: chat.isGroup
          ? (chat.groupName || "G").charAt(0).toUpperCase()
          : (otherUsers[0]?.name || "?").charAt(0).toUpperCase(),
        isOnline: !chat.isGroup && otherUsers[0]?.isOnline,
        lastSeen: !chat.isGroup ? otherUsers[0]?.lastSeen : null,
        otherUser: !chat.isGroup ? otherUsers[0] : null,
        latestMessage: chat.latestMessage,
        unreadCount: unreadMap.get(chat._id.toString()) || 0,
        updatedAt: chat.updatedAt,
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch chats", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
