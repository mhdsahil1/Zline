import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { StarredMessage } from "@/lib/models/StarredMessage";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: Fetch all starred messages for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const starred = await StarredMessage.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .populate({
        path: "messageId",
        populate: { path: "sender", select: "name image" },
      })
      .populate({
        path: "chatId",
        select: "isGroup groupName users",
        populate: { path: "users", select: "name" },
      })
      .lean();

    return NextResponse.json(starred, { status: 200 });
  } catch (error) {
    console.error("Fetch starred messages error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST: Star a message
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { messageId, chatId } = await req.json();

    if (!messageId || !chatId) {
      return NextResponse.json(
        { message: "messageId and chatId are required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify the message exists
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ message: "Message not found" }, { status: 404 });
    }

    const chat = await Chat.findById(message.chat);
    if (!chat || !chat.users.some((u: any) => u.toString() === session.user.id)) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // Create starred message (compound unique index prevents duplicates)
    try {
      const starred = await StarredMessage.create({
        userId: session.user.id,
        messageId,
        chatId,
      });
      return NextResponse.json(starred, { status: 201 });
    } catch (err: any) {
      if (err.code === 11000) {
        return NextResponse.json({ message: "Message already starred" }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    console.error("Star message error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Unstar a message
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ message: "messageId is required" }, { status: 400 });
    }

    await connectDB();

    await StarredMessage.findOneAndDelete({
      userId: session.user.id,
      messageId,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Unstar message error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
