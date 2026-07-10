import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { PushSubscription } from "@/lib/models/PushSubscription";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST: Save or update subscription
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { endpoint, keys } = await req.json();

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json(
        { message: "Invalid subscription payload" },
        { status: 400 }
      );
    }

    await connectDB();

    // Store or update subscription
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: session.user.id,
        endpoint,
        keys,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to subscribe push notification:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove subscription
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json(
        { message: "Endpoint is required" },
        { status: 400 }
      );
    }

    await connectDB();

    await PushSubscription.deleteOne({ endpoint, userId: session.user.id });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to unsubscribe push notification:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
