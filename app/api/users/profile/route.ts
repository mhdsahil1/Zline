import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updateObj: Record<string, any> = {};

    if (body.image === null || body.image === "") {
      updateObj.image = null;
    } else if (typeof body.image === "string") {
      updateObj.image = body.image.trim();
    }

    if (typeof body.name === "string" && body.name.trim().length >= 2) {
      updateObj.name = body.name.trim().substring(0, 50);
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json(
        { message: "No valid fields to update" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: updateObj },
      { returnDocument: "after" }
    ).select("name email image");

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: "Profile updated successfully",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

