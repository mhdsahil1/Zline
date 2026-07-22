import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const timestamp = Date.now().toString();
    const data = `${userId}:${timestamp}`;
    const secret = process.env.NEXTAUTH_SECRET;
    
    if (!secret) {
      console.error("NEXTAUTH_SECRET is missing");
      return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }

    const signature = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("hex");
      
    const token = `${userId}.${timestamp}.${signature}`;

    return NextResponse.json({ token }, { status: 200 });
  } catch (error) {
    console.error("Socket token generation error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
