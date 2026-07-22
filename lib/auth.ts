import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { normalizeEmail } from "@/lib/normalizeEmail";
import crypto from "crypto";

export const authOptions: NextAuthOptions = {
  providers: [
    // ─── Provider 1: Existing email/password credentials ───
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const email = normalizeEmail(credentials.email);

        const { checkEmailRateLimit, checkIpRateLimit } = await import("@/lib/rateLimit");
        
        if (req && req.headers) {
          const headers = req.headers as Record<string, string>;
          const ip = headers["x-forwarded-for"] || headers["x-real-ip"] || "unknown";
          if (ip !== "unknown") {
            const ipLimit = checkIpRateLimit(ip);
            if (!ipLimit.allowed) {
              throw new Error("Too many login attempts from this IP. Please try again later.");
            }
          }
        }

        const emailLimit = checkEmailRateLimit(email);
        if (!emailLimit.allowed) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        await connectDB();

        const user = await User.findOne({ email });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isCorrectPassword) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),

    // ─── Provider 2: Google OAuth ───
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ─── Provider 3: Email OTP (as a credentials provider) ───
    // Email OTP authentication is temporarily disabled until a verified email-sending domain is configured.
    // The provider is intentionally kept here so it can be re-enabled without code changes.
    // To re-enable: set EMAIL_OTP_ENABLED=true in env vars and remove the redirect from /login/otp/page.tsx.
    // The /api/auth/otp/send and /api/auth/otp/verify routes are guarded by the same EMAIL_OTP_ENABLED flag.
    CredentialsProvider({
      id: "email-otp",
      name: "email-otp",
      credentials: {
        email: { label: "Email", type: "email" },
        verificationToken: { label: "Verification Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.verificationToken) {
          if (process.env.NODE_ENV === "development") {
            console.log("[AUTH:email-otp] Missing email or verificationToken in credentials");
          }
          throw new Error("Invalid credentials");
        }

        await connectDB();

        const email = normalizeEmail(credentials.email);

        if (process.env.NODE_ENV === "development") {
          console.log(`[AUTH:email-otp] authorize() called for ${email.substring(0, 3)}***`);
        }

        // Verify the short-lived verification token
        // The token is a HMAC signature of the email + timestamp
        const tokenValid = verifyOtpToken(
          email,
          credentials.verificationToken
        );

        if (!tokenValid) {
          if (process.env.NODE_ENV === "development") {
            console.log(`[AUTH:email-otp] Verification token INVALID for ${email.substring(0, 3)}***`);
          }
          throw new Error("Invalid or expired verification");
        }

        if (process.env.NODE_ENV === "development") {
          console.log(`[AUTH:email-otp] Verification token valid for ${email.substring(0, 3)}***`);
        }

        // Look up or create user
        let user = await User.findOne({ email });

        if (!user) {
          // Create new user — name from email prefix
          const namePart = email.split("@")[0];
          const displayName =
            namePart.charAt(0).toUpperCase() + namePart.slice(1);

          user = await User.create({
            name: displayName,
            email,
            emailVerified: true,
            authProviders: ["email-otp"],
          });

          if (process.env.NODE_ENV === "development") {
            console.log(`[AUTH:email-otp] Created new user ${user._id} for ${email.substring(0, 3)}***`);
          }
        } else {
          if (process.env.NODE_ENV === "development") {
            console.log(`[AUTH:email-otp] Found existing user ${user._id} for ${email.substring(0, 3)}***, providers: [${(user.authProviders ?? []).join(", ")}]`);
          }

          // Add email-otp to providers if not already present.
          // The linking check (password confirmation) was already handled
          // by the OTP verify endpoint before we reach this point.
          const providers = user.authProviders ?? [];
          if (!providers.includes("email-otp")) {
            user.authProviders = [...providers, "email-otp"];
            user.emailVerified = true;
            await user.save();

            if (process.env.NODE_ENV === "development") {
              console.log(`[AUTH:email-otp] Added email-otp provider to user ${user._id}`);
            }
          }
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (profile && (profile as any).email_verified === false) {
          console.log("[AUTH] Google email is not verified. Rejecting login.");
          return false;
        }

        await connectDB();

        const email = normalizeEmail(
          (profile?.email || user.email) as string
        );

        if (!email) {
          return false;
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
          if (existingUser.authProviders.includes("google")) {
            // Already linked — allow sign-in
            return true;
          }

          if (
            existingUser.password &&
            !existingUser.authProviders.includes("google")
          ) {
            // Existing credential user without Google linked
            // Redirect to linking page for password confirmation
            return `/link?email=${encodeURIComponent(email)}&provider=google`;
          }

          const updatePayload: any = {};
          if (profile && "picture" in profile && !existingUser.image) {
            updatePayload.image = (profile as any).picture;
          }
          if (profile && "name" in profile && profile.name) {
            updatePayload.name = profile.name as string;
          }

          await User.updateOne(
            { _id: existingUser._id },
            {
              $addToSet: { authProviders: "google" },
              $set: { emailVerified: true, ...updatePayload },
            }
          );
          return true;
        }

        // New user — create account
        await User.create({
          name:
            (profile as any)?.name || (user.name as string) || "User",
          email,
          image: (profile as any)?.picture || user.image,
          emailVerified: true,
          authProviders: ["google"],
        });

        return true;
      }

      // For credentials and email-otp providers, allow by default
      return true;
    },

    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        // For Google OAuth, look up the MongoDB user by email
        await connectDB();
        const email = normalizeEmail(
          (token.email || profile?.email || user?.email) as string
        );
        const dbUser = await User.findOne({ email });
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      } else if (user) {
        // For credentials and email-otp providers
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ─── OTP Verification Token Utilities ───

const OTP_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a short-lived signed token that proves OTP verification succeeded.
 * This prevents replay attacks — the OTP verify endpoint issues this token,
 * and the NextAuth authorize function consumes it.
 */
export function createOtpVerificationToken(email: string): string {
  const timestamp = Date.now().toString();
  const data = `${email}:${timestamp}`;
  const secret = process.env.NEXTAUTH_SECRET!;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  // Token format: timestamp.signature
  return `${timestamp}.${signature}`;
}

/**
 * Verify an OTP verification token.
 */
function verifyOtpToken(email: string, token: string): boolean {
  try {
    const [timestampStr, signature] = token.split(".");
    if (!timestampStr || !signature) return false;

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return false;

    // Check expiry
    if (Date.now() - timestamp > OTP_TOKEN_TTL_MS) return false;

    // Verify signature
    const data = `${email}:${timestampStr}`;
    const secret = process.env.NEXTAUTH_SECRET!;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("hex");

    // Timing-safe comparison
    if (signature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
