import { NextResponse } from "next/dist/server/web/spec-extension/response";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { normalizeEmail } from "@/lib/normalizeEmail";
import { checkIpRateLimit, checkEmailRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/auth/link/confirm
 *
 * Confirms account ownership by verifying the user's existing password,
 * then links a new auth provider (google or email-otp) to the account.
 *
 * This prevents unauthorized account takeover — a Google/OTP sign-in
 * cannot auto-link to a credential account without proving password ownership.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const rawPassword =
      typeof body.password === "string" ? body.password : "";
    const rawProvider =
      typeof body.provider === "string" ? body.provider : "";

    const email = normalizeEmail(rawEmail);
    const password = rawPassword;
    const provider = rawProvider;

    // Validate inputs
    if (!email || !password || !provider) {
      return NextResponse.json(
        { message: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!["google", "email-otp"].includes(provider)) {
      return NextResponse.json(
        { message: "Invalid provider." },
        { status: 400 }
      );
    }

    // IP-based Rate Limiting (10 requests per 10 mins)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const ipLimit = checkIpRateLimit(ip);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: "Too many attempts from this IP. Please try again later." },
        { status: 429 }
      );
    }

    // Email-based Rate Limiting (3 requests per 10 mins)
    const emailLimit = checkEmailRateLimit(email);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { message: "Too many attempts for this email. Please try again later." },
        { status: 429 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email });

    if (!user || !user.password) {
      // Uniform error — do not reveal whether the account exists
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 400 }
      );
    }

    // Verify password
    const isCorrect = await bcrypt.compare(password, user.password);
    if (!isCorrect) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 400 }
      );
    }

    // Link the new provider using $addToSet to prevent duplicates
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { authProviders: provider },
      $set: { emailVerified: true },
    });

    return NextResponse.json(
      { message: "Account linked successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Account linking error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
