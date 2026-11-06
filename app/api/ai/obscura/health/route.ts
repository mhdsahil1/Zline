import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkObscuraHealth, getObscuraBaseUrl } from "@/lib/obscura";

/**
 * Health check endpoint for Obscura Headless Browser integration
 * GET /api/ai/obscura/health
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { message: "Authentication required to inspect Obscura status." },
        { status: 401 }
      );
    }

    const health = await checkObscuraHealth();

    return NextResponse.json(
      {
        status: health.available ? "online" : "offline",
        configuredEndpoint: getObscuraBaseUrl(),
        health,
        timestamp: new Date().toISOString(),
      },
      { status: health.available ? 200 : 503 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to query Obscura health status.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

