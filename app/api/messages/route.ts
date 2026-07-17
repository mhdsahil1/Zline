import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import mongoose from "mongoose";

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
    const chatId = searchParams.get("chatId");

    if (!receiverId && !chatId) {
      return NextResponse.json(
        { message: "Receiver ID or Chat ID is required" },
        { status: 400 }
      );
    }

    await connectDB();

    let chat;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, users: session.user.id });
    } else {
      chat = await Chat.findOne({
        isGroup: false,
        users: { $all: [session.user.id, receiverId] },
      });
    }

    if (!chat) {
      return NextResponse.json([], { status: 200 });
    }

    const messages = await Message.find({ chat: chat._id })
      .populate("sender", "name image")
      .populate({
        path: "replyTo",
        select: "content sender type fileName",
        populate: { path: "sender", select: "name" },
      })
      .sort({
        createdAt: 1,
      });

    // Mark messages as seen if they were not sent by the current user and current user is not in readBy yet
    const unseenMessages = messages.filter(
      (m) => m.sender.toString() !== session.user!.id && 
             (!m.readBy || !m.readBy.some((r: any) => r.userId.toString() === session.user!.id))
    );

    if (unseenMessages.length > 0) {
      const userObjectId = new mongoose.Types.ObjectId(session.user.id);
      await Message.updateMany(
        { _id: { $in: unseenMessages.map((m) => m._id) } },
        {
          $set: { status: "seen" },
          $addToSet: { readBy: { userId: userObjectId, readAt: new Date() } },
        }
      );
      
      // Update the local array to reflect the new status
      unseenMessages.forEach((m) => {
        m.status = "seen";
        if (!m.readBy) m.readBy = [];
        if (!m.readBy.some((r: any) => r.userId.toString() === session.user!.id)) {
          m.readBy.push({ userId: userObjectId, readAt: new Date() } as any);
        }
      });
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
    const { receiverId, chatId, content, type = "text", fileUrl, fileName, fileSize, isEncrypted, encAesKey, encAesKeyForSender, iv, replyTo, voiceDuration } = body;

    if (!receiverId && !chatId) {
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
    let chat;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, users: session.user.id });
      if (!chat) {
        return NextResponse.json(
          { message: "Chat not found or access denied" },
          { status: 404 }
        );
      }
    } else {
      chat = await Chat.findOne({
        isGroup: false,
        users: { $all: [session.user.id, receiverId] },
      });

      if (!chat) {
        chat = await Chat.create({
          users: [session.user.id, receiverId],
          isGroup: false,
        });
      }
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
      voiceDuration,
      expiresAt,
      replyTo: replyTo || undefined,
      isEncrypted: !!isEncrypted,
      encAesKey,
      encAesKeyForSender,
      iv,
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name image")
      .populate({
        path: "replyTo",
        select: "content sender type fileName",
        populate: { path: "sender", select: "name" },
      });

    chat.latestMessage = newMessage._id;
    await chat.save();

    // Send push notifications to other participants asynchronously
    const senderName = session.user.name || "Zline User";
    const notificationTitle = chat.isGroup ? (chat.groupName || "Group Message") : senderName;
    let notificationBody = content || "";
    if (type === "image") notificationBody = "📷 Photo";
    else if (type === "file") notificationBody = "📎 File: " + (fileName || "Attachment");
    else if (type === "voice") notificationBody = "🎤 Voice message";
    else if (type === "poll") notificationBody = "📊 Poll: " + (newMessage.poll?.question || "New poll");

    const usersToNotify = chat.users.filter((u: any) => u.toString() !== session.user!.id);
    if (usersToNotify.length > 0) {
      import("@/lib/push").then(({ sendPushNotification }) => {
        sendPushNotification(usersToNotify, {
          title: notificationTitle,
          body: notificationBody,
          icon: "/Fevicon final.svg",
          data: {
            chatId: chat._id.toString(),
          }
        });
      }).catch(err => console.error("Web push dispatch error:", err));
    }

    return NextResponse.json(populatedMessage, { status: 201 });
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

    const update: any = { status };

    // When marking as "seen", also add the user to readBy
    if (status === "seen") {
      await Message.findByIdAndUpdate(messageId, {
        ...update,
        $addToSet: {
          readBy: {
            userId: new mongoose.Types.ObjectId(session.user.id),
            readAt: new Date(),
          },
        },
      });
    } else {
      await Message.findByIdAndUpdate(messageId, update);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to update message status", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
