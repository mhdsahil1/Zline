import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
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

    const { receiverId, content } = await req.json();

    if (!receiverId || !content) {
      return NextResponse.json(
        { message: "Missing required fields" },
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

    const newMessage = await Message.create({
      chat: chat._id,
      sender: session.user.id,
      content,
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
