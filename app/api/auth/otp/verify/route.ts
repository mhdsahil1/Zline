import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { connectDB } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalizeEmail";
import { EmailOtp, hashOtp, MAX_OTP_ATTEMPTS } from "@/lib/models/EmailOtp";
import { User } from "@/lib/models/User";
import { createOtpVerificationToken } from "@/lib/auth";

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
    const rawOtp = typeof body.otp === "string" ? body.otp : "";
    const email = normalizeEmail(rawEmail);
    const otp = rawOtp.trim();

    // Validate inputs
    if (!email || !otp || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { message: "Invalid code. Please try again." },
        { status: 400 }
      );
    }

    await connectDB();

    // Find the latest unused, unexpired OTP for this email
    const otpRecord = await EmailOtp.findOne({
      email,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return NextResponse.json(
        { message: "Invalid or expired code. Please request a new one." },
        { status: 400 }
      );
    }

    // Check attempt limit
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      // Lock this OTP — mark as used
      otpRecord.used = true;
      await otpRecord.save();
      return NextResponse.json(
        {
          message:
            "Too many failed attempts. Please request a new code.",
        },
        { status: 429 }
      );
    }

    // Compare hash
    const inputHash = hashOtp(otp);
    if (inputHash !== otpRecord.otpHash) {
      // Increment attempts
      otpRecord.attempts += 1;
      await otpRecord.save();

      const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
      return NextResponse.json(
        {
          message:
            remaining > 0
              ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
              : "Too many failed attempts. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // OTP matches — mark as used (single-use)
    otpRecord.used = true;
    await otpRecord.save();

    if (process.env.NODE_ENV === "development") {
      console.log(`[OTP-VERIFY] OTP verified for ${email.substring(0, 3)}***`);
    }

    // Check if account linking is required BEFORE issuing the verification token.
    // An existing user with a password who hasn't linked email-otp needs to
    // confirm ownership via their password first.
    let linkRequired = false;
    const existingUser = await User.findOne({ email });
    if (
      existingUser &&
      existingUser.password &&
      !(existingUser.authProviders ?? []).includes("email-otp")
    ) {
      linkRequired = true;
      if (process.env.NODE_ENV === "development") {
        console.log(`[OTP-VERIFY] Link required for ${email.substring(0, 3)}*** (has password, missing email-otp provider)`);
      }
    }

    // Create a short-lived verification token for the NextAuth authorize flow
    const verificationToken = createOtpVerificationToken(email);

    return NextResponse.json(
      {
        message: "Code verified successfully.",
        verificationToken,
        linkRequired,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
