import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import mongoose from "mongoose";

// GET: Fetch pinned messages for a chat
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json({ message: "chatId is required" }, { status: 400 });
    }

    await connectDB();

    const chat = await Chat.findOne({ _id: chatId, users: session.user.id });
    if (!chat) {
      return NextResponse.json({ message: "Chat not found or access denied" }, { status: 404 });
    }

    if (!chat.pinnedMessages || chat.pinnedMessages.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const pinnedMessages = await Message.find({
      _id: { $in: chat.pinnedMessages },
      deletedForEveryone: { $ne: true },
    })
      .populate("sender", "name image")
      .sort({ createdAt: -1 });

    return NextResponse.json(pinnedMessages, { status: 200 });
  } catch (error) {
    console.error("Fetch pinned messages error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST: Pin a message
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

    const chat = await Chat.findOne({ _id: chatId, users: session.user.id });
    if (!chat) {
      return NextResponse.json({ message: "Chat not found or access denied" }, { status: 404 });
    }

    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
      return NextResponse.json({ message: "Message not found in this chat" }, { status: 404 });
    }

    // Max 25 pinned messages per chat
    if (chat.pinnedMessages && chat.pinnedMessages.length >= 25) {
      return NextResponse.json(
        { message: "Maximum of 25 pinned messages reached" },
        { status: 400 }
      );
    }

    const msgObjectId = new mongoose.Types.ObjectId(messageId);

    // Check if already pinned
    const alreadyPinned = chat.pinnedMessages?.some(
      (id: any) => id.toString() === messageId
    );
    if (alreadyPinned) {
      return NextResponse.json({ message: "Message is already pinned" }, { status: 400 });
    }

    chat.pinnedMessages = [...(chat.pinnedMessages || []), msgObjectId];
    await chat.save();

    const populatedMessage = await Message.findById(messageId).populate("sender", "name image");

    return NextResponse.json({
      message: populatedMessage,
      chatId,
      isGroup: chat.isGroup,
      pinnedCount: chat.pinnedMessages.length,
    }, { status: 200 });
  } catch (error) {
    console.error("Pin message error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Unpin a message
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const chatId = searchParams.get("chatId");

    if (!messageId || !chatId) {
      return NextResponse.json(
        { message: "messageId and chatId are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const chat = await Chat.findOne({ _id: chatId, users: session.user.id });
    if (!chat) {
      return NextResponse.json({ message: "Chat not found or access denied" }, { status: 404 });
    }

    chat.pinnedMessages = (chat.pinnedMessages || []).filter(
      (id: any) => id.toString() !== messageId
    );
    await chat.save();

    return NextResponse.json({
      messageId,
      chatId,
      pinnedCount: chat.pinnedMessages.length,
    }, { status: 200 });
  } catch (error) {
    console.error("Unpin message error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
