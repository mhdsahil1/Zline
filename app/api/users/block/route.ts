import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import mongoose from "mongoose";

// GET: Fetch blocked users list
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.user.id)
      .populate("blockedUsers", "name email image")
      .select("blockedUsers");

    return NextResponse.json(user?.blockedUsers || [], { status: 200 });
  } catch (error) {
    console.error("Fetch blocked users error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST: Block a user
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    // Cannot block yourself
    if (userId === session.user.id) {
      return NextResponse.json({ message: "Cannot block yourself" }, { status: 400 });
    }

    await connectDB();

    // Verify user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    await User.findByIdAndUpdate(session.user.id, {
      $addToSet: { blockedUsers: userObjectId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Block user error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Unblock a user
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    await connectDB();

    await User.findByIdAndUpdate(session.user.id, {
      $pull: { blockedUsers: new mongoose.Types.ObjectId(userId) },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Unblock user error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
