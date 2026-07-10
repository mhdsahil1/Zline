import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_CHAT_MEDIA_BYTES = 100 * 1024 * 1024; // 100MB per chat
const MEDIA_EXPIRY_MS = 24 * 60 * 60 * 1000;    // 1 day in milliseconds

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const receiverId = searchParams.get("receiverId");

    if (!receiverId) {
      return NextResponse.json(
        { message: "Receiver ID is required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Find the chat between these two users
    const chat = await Chat.findOne({
      users: { $all: [session.user.id, receiverId] },
    });

    if (!chat) {
      return NextResponse.json([], { status: 200 });
    }

    const messages = await Message.find({ chat: chat._id }).sort({
      createdAt: 1,
    });

    // Mark messages as seen if they were sent by the other user and are not seen yet
    const unseenMessages = messages.filter(
      (m) => m.sender.toString() === receiverId && m.status !== "seen"
    );

    if (unseenMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: unseenMessages.map((m) => m._id) } },
        { $set: { status: "seen" } }
      );
      
      // Update the local array to reflect the new status
      unseenMessages.forEach((m) => (m.status = "seen"));
    }

    return NextResponse.json(messages, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch messages", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { receiverId, content, type = "text", fileUrl, fileName, fileSize } = body;

    if (!receiverId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // For text messages, content is required
    if (type === "text" && !content) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // For media messages, fileUrl is required
    if (type !== "text" && !fileUrl) {
      return NextResponse.json(
        { message: "Missing file data" },
        { status: 400 }
      );
    }

    await connectDB();

    // Find or create chat
    let chat = await Chat.findOne({
      users: { $all: [session.user.id, receiverId] },
    });

    if (!chat) {
      chat = await Chat.create({
        users: [session.user.id, receiverId],
      });
    }

    // Enforce 100MB per-chat media cap
    if (type !== "text" && fileSize) {
      const mediaMessages = await Message.find({
        chat: chat._id,
        type: { $in: ["image", "file", "voice"] },
        fileSize: { $exists: true },
      }).select("fileSize");

      const totalUsed = mediaMessages.reduce((sum, m) => sum + (m.fileSize || 0), 0);

      if (totalUsed + fileSize > MAX_CHAT_MEDIA_BYTES) {
        const usedMB = (totalUsed / (1024 * 1024)).toFixed(1);
        return NextResponse.json(
          { message: `Chat media storage is full (${usedMB}MB / 100MB used). Media messages expire after 1 day to free space.` },
          { status: 413 }
        );
      }
    }

    // Set expiry for media messages (1 day from now)
    const expiresAt = type !== "text" ? new Date(Date.now() + MEDIA_EXPIRY_MS) : undefined;

    const newMessage = await Message.create({
      chat: chat._id,
      sender: session.user.id,
      content: content || "",
      type,
      fileUrl,
      fileName,
      fileSize,
      expiresAt,
    });

    chat.latestMessage = newMessage._id;
    await chat.save();

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("Failed to send message", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { messageId, status } = await req.json();

    if (!messageId || !status) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    await connectDB();
    await Message.findByIdAndUpdate(messageId, { status });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to update message status", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
