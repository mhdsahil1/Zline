import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalizeEmail";
import {
  EmailOtp,
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
} from "@/lib/models/EmailOtp";
import { sendOtpEmail } from "@/lib/email";
import {
  checkEmailRateLimit,
  checkIpRateLimit,
  checkResendCooldown,
  setResendCooldown,
} from "@/lib/rateLimit";

export async function POST(req: Request) {
  // Email OTP authentication is temporarily disabled until a verified email-sending domain is configured.
  // Set EMAIL_OTP_ENABLED=true in your environment variables to re-enable this feature.
  if (process.env.EMAIL_OTP_ENABLED !== "true") {
    return NextResponse.json(
      { message: "Email OTP authentication is not available at this time." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const email = normalizeEmail(rawEmail);

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Always return uniform response — do not reveal whether the email exists
      return NextResponse.json(
        { message: "If this email is valid, you will receive a code." },
        { status: 200 }
      );
    }

    // Get client IP for rate limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : req.headers.get("x-real-ip") || "unknown";

    // Rate limiting: per-email
    const emailLimit = checkEmailRateLimit(email);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Rate limiting: per-IP
    const ipLimit = checkIpRateLimit(ip);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Resend cooldown
    const cooldown = checkResendCooldown(email);
    if (!cooldown.allowed) {
      const secondsLeft = Math.ceil((cooldown.retryAfterMs || 0) / 1000);
      return NextResponse.json(
        {
          message: `Please wait ${secondsLeft} seconds before requesting another code.`,
          retryAfterSeconds: secondsLeft,
        },
        { status: 429 }
      );
    }

    await connectDB();

    // Invalidate all previous active (unused, unexpired) OTPs for this email
    await EmailOtp.updateMany(
      { email, used: false, expiresAt: { $gt: new Date() } },
      { $set: { used: true } }
    );

    // Generate new OTP
    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    // Store hashed OTP
    await EmailOtp.create({
      email,
      otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ip,
    });

    // Set resend cooldown
    setResendCooldown(email);

    // Send the OTP email (or log to console in dev)
    await sendOtpEmail(email, otp);

    // Uniform response — never reveal whether the email has an account
    return NextResponse.json(
      { message: "If this email is valid, you will receive a code." },
      { status: 200 }
    );
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
