import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { Chat } from "@/lib/models/Chat";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST: Create a new group chat
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name, userIds } = await req.json();

    if (!name || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { message: "Group name and member IDs are required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Ensure current user is in the group members
    const members = [...new Set([...userIds, session.user.id])];

    const group = await Chat.create({
      users: members,
      isGroup: true,
      groupName: name,
      groupAdmin: session.user.id,
    });

    // Populate members details for the response
    const populatedGroup = await Chat.findById(group._id).populate(
      "users",
      "name email image isOnline lastSeen"
    );

    return NextResponse.json(populatedGroup, { status: 201 });
  } catch (error) {
    console.error("Create group error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Edit group (add/remove members, rename group)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { chatId, name, userIds } = await req.json();

    if (!chatId) {
      return NextResponse.json(
        { message: "chatId is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const group = await Chat.findById(chatId);
    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    if (!group.isGroup) {
      return NextResponse.json({ message: "Chat is not a group" }, { status: 400 });
    }

    // Only admin can edit or manage members
    if (group.groupAdmin?.toString() !== session.user.id) {
      return NextResponse.json(
        { message: "Only group admins can update groups" },
        { status: 403 }
      );
    }

    if (name) group.groupName = name;
    if (userIds && Array.isArray(userIds)) {
      // Ensure the admin stays in the group
      group.users = [...new Set([...userIds, session.user.id])] as any;
    }

    await group.save();

    const populatedGroup = await Chat.findById(group._id).populate(
      "users",
      "name email image isOnline lastSeen"
    );

    return NextResponse.json(populatedGroup, { status: 200 });
  } catch (error) {
    console.error("Update group error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
