import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB single file limit

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { message: `File too large. Maximum size is 100MB (your file: ${(file.size / (1024 * 1024)).toFixed(1)}MB).` },
        { status: 413 }
      );
    }

    // Convert file to Base64 data URL
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Determine message type from MIME
    let type: "image" | "voice" | "file" = "file";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("audio/")) type = "voice";

    return NextResponse.json({
      fileUrl: dataUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      type,
    }, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}
