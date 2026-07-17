import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { messageId, content, isEncrypted, encAesKey, encAesKeyForSender, iv } = await req.json();

    if (!messageId || (!content && content !== "")) {
      return NextResponse.json(
        { message: "messageId and content are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ message: "Message not found" }, { status: 404 });
    }

    // Only the sender can edit their own messages
    if (message.sender.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "You can only edit your own messages" },
        { status: 403 }
      );
    }

    // Only text messages can be edited
    if (message.type !== "text") {
      return NextResponse.json(
        { message: "Only text messages can be edited" },
        { status: 400 }
      );
    }

    // Check if the message was deleted for everyone
    if (message.deletedForEveryone) {
      return NextResponse.json(
        { message: "Cannot edit a deleted message" },
        { status: 400 }
      );
    }

    // Enforce 15-minute edit window
    const elapsed = Date.now() - new Date(message.createdAt).getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      return NextResponse.json(
        { message: "Edit window has expired (15 minutes)" },
        { status: 400 }
      );
    }

    // Update the message content
    message.content = content;
    message.isEdited = true;

    // Handle E2EE re-encryption
    if (isEncrypted) {
      message.isEncrypted = true;
      message.encAesKey = encAesKey;
      message.encAesKeyForSender = encAesKeyForSender;
      message.iv = iv;
    }

    await message.save();

    const populated = await Message.findById(message._id).populate("sender", "name image");

    // Determine the chat to identify the target for socket relay
    const chat = await Chat.findById(message.chat);

    return NextResponse.json({
      message: populated,
      chatId: chat?.isGroup ? chat._id.toString() : null,
      isGroup: chat?.isGroup || false,
      chatUsers: chat?.users?.map((u: any) => u.toString()) || [],
    }, { status: 200 });
  } catch (error) {
    console.error("Edit message error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
