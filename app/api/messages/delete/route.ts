import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await req.json();

    if (!messageId) {
      return NextResponse.json(
        { message: "messageId is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ message: "Message not found" }, { status: 404 });
    }

    // Only the sender can delete for everyone
    if (message.sender.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "You can only delete your own messages for everyone" },
        { status: 403 }
      );
    }

    message.deletedForEveryone = true;
    message.content = "";
    message.fileUrl = undefined;
    message.fileName = undefined;
    await message.save();

    // Get chat info for socket relay
    const chat = await Chat.findById(message.chat);

    return NextResponse.json({
      messageId: message._id.toString(),
      chatId: chat?.isGroup ? chat._id.toString() : null,
      isGroup: chat?.isGroup || false,
      chatUsers: chat?.users?.map((u: any) => u.toString()) || [],
    }, { status: 200 });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
