import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import mongoose from "mongoose";

// POST /api/polls — Create a poll in a chat
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { receiverId, question, options } = await req.json();

    if (!receiverId || !question?.trim() || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { message: "Poll requires a question and at least 2 options." },
        { status: 400 }
      );
    }

    const sanitizedOptions = options
      .map((o: string) => o?.trim())
      .filter(Boolean)
      .slice(0, 4); // max 4 options

    if (sanitizedOptions.length < 2) {
      return NextResponse.json(
        { message: "Poll requires at least 2 non-empty options." },
        { status: 400 }
      );
    }

    await connectDB();

    // Find or create chat
    let chat = await Chat.findOne({
      isGroup: false,
      users: { $all: [session.user.id, receiverId] },
    });

    if (!chat) {
      chat = await Chat.create({ users: [session.user.id, receiverId], isGroup: false });
    }

    const newMessage = await Message.create({
      chat: chat._id,
      sender: session.user.id,
      content: question,
      type: "poll",
      poll: {
        question,
        options: sanitizedOptions.map((text: string) => ({ text, votes: [] })),
        isEnded: false,
      },
    });

    chat.latestMessage = newMessage._id;
    await chat.save();

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("Poll creation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/polls — Vote on an option OR end a poll
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { messageId, optionIndex, action } = await req.json();

    if (!messageId) {
      return NextResponse.json({ message: "Missing messageId" }, { status: 400 });
    }

    await connectDB();

    const message = await Message.findById(messageId);
    if (!message || message.type !== "poll" || !message.poll) {
      return NextResponse.json({ message: "Poll not found" }, { status: 404 });
    }

    const chat = await Chat.findById(message.chat);
    if (!chat || !chat.users.some((u: any) => u.toString() === session.user.id)) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    if (action === "end") {
      // Only creator can end their poll
      if (message.sender.toString() !== session.user.id) {
        return NextResponse.json({ message: "Only the poll creator can end it." }, { status: 403 });
      }
      message.poll.isEnded = true;
      await message.save();
      return NextResponse.json(message, { status: 200 });
    }

    // Vote action
    if (typeof optionIndex !== "number" || optionIndex < 0 || optionIndex >= message.poll.options.length) {
      return NextResponse.json({ message: "Invalid option" }, { status: 400 });
    }

    if (message.poll.isEnded) {
      return NextResponse.json({ message: "This poll has ended." }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(session.user.id);

    // Remove any existing vote from this user across all options
    message.poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((v) => v.toString() !== session.user.id);
    });

    // Cast new vote
    message.poll.options[optionIndex].votes.push(userId);
    message.markModified("poll");
    await message.save();

    return NextResponse.json(message, { status: 200 });
  } catch (error) {
    console.error("Poll vote error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
