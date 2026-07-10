import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import mongoose from "mongoose";

// POST: Toggle a reaction on a message
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { messageId, emoji } = await req.json();

    if (!messageId || !emoji) {
      return NextResponse.json(
        { message: "messageId and emoji are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ message: "Message not found" }, { status: 404 });
    }

    const userId = session.user.id;

    // Check if user already reacted with this exact emoji
    const existingIndex = message.reactions.findIndex(
      (r: any) => r.userId.toString() === userId && r.emoji === emoji
    );

    if (existingIndex !== -1) {
      // Remove the reaction (toggle off)
      message.reactions.splice(existingIndex, 1);
    } else {
      // Remove any previous reaction by this user (single reaction per user)
      message.reactions = message.reactions.filter(
        (r: any) => r.userId.toString() !== userId
      );
      // Add the new reaction
      message.reactions.push({ userId: new mongoose.Types.ObjectId(userId), emoji });
    }

    await message.save();

    return NextResponse.json({
      messageId: message._id,
      reactions: message.reactions,
    }, { status: 200 });
  } catch (error) {
    console.error("Reaction error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
