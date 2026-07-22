import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

export interface IEmailOtp extends Document {
  email: string;
  otpHash: string;
  expiresAt: Date;
  used: boolean;
  attempts: number;
  ip: string;
  createdAt: Date;
}

const emailOtpSchema = new Schema<IEmailOtp>(
  {
    email: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    ip: { type: String, required: true },
  },
  { timestamps: true }
);

export const EmailOtp: Model<IEmailOtp> =
  mongoose.models.EmailOtp ||
  mongoose.model<IEmailOtp>("EmailOtp", emailOtpSchema);

/**
 * Hash an OTP using SHA-256.
 * This is a one-way hash — the plaintext OTP is never stored.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Generate a cryptographically secure 6-digit OTP.
 */
export function generateOtp(): string {
  // crypto.randomInt produces a uniform random integer in [min, max)
  return crypto.randomInt(100000, 1000000).toString();
}

/** Maximum number of failed verification attempts before the OTP is locked. */
export const MAX_OTP_ATTEMPTS = 5;

/** OTP validity duration in milliseconds (10 minutes). */
export const OTP_TTL_MS = 10 * 60 * 1000;
