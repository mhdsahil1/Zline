import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: Fetch current user's settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.user.id).select("settings name email image");
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      image: user.image,
      settings: user.settings,
    }, { status: 200 });
  } catch (error) {
    console.error("Fetch settings error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update user settings
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Whitelist allowed fields to prevent injection
    const allowedFields = [
      "readReceipts",
      "lastSeenVisible",
      "theme",
      "notificationSound",
      "notificationPreview",
    ];

    const updateObj: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) {
        // Validate theme value
        if (field === "theme" && !["light", "dark", "system"].includes(body[field])) {
          return NextResponse.json(
            { message: "Invalid theme value" },
            { status: 400 }
          );
        }
        // Validate boolean fields
        if (field !== "theme" && typeof body[field] !== "boolean") {
          return NextResponse.json(
            { message: `${field} must be a boolean` },
            { status: 400 }
          );
        }
        updateObj[`settings.${field}`] = body[field];
      }
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });
    }

    await connectDB();

    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: updateObj },
      { new: true }
    ).select("settings");

    return NextResponse.json({ settings: user?.settings }, { status: 200 });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
