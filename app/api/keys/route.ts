import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { UserKey } from "@/lib/models/UserKey";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: Fetch public key of a user
export async function GET(req: Request) {
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

    const userKey = await UserKey.findOne({ userId });
    if (!userKey) {
      return NextResponse.json({ message: "Public key not found" }, { status: 404 });
    }

    return NextResponse.json({ publicKey: userKey.publicKey }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch public key:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Upload/Update public key
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { publicKey } = await req.json();

    if (!publicKey) {
      return NextResponse.json({ message: "publicKey is required" }, { status: 400 });
    }

    await connectDB();

    await UserKey.findOneAndUpdate(
      { userId: session.user.id },
      { userId: session.user.id, publicKey },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to save public key:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
