import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { PushSubscription } from "@/lib/models/PushSubscription";
import { UserKey } from "@/lib/models/UserKey";
import { StarredMessage } from "@/lib/models/StarredMessage";

/**
 * POST /api/users/delete-account
 *
 * Soft-deletes a user account after re-authentication.
 *
 * - Password users must provide their current password.
 * - Google-only users are verified via their existing NextAuth session
 *   (they authenticated through Google OAuth to obtain it).
 * - The user document is never physically deleted — it is anonymized
 *   in-place so that existing message sender references remain valid.
 * - Email, password hash, authProviders, and settings are preserved
 *   for potential support-assisted recovery.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { password, provider, confirmText } = body;

    // Require explicit confirmation
    if (confirmText !== "DELETE") {
      return NextResponse.json(
        { message: "Please type DELETE to confirm account deletion." },
        { status: 400 }
      );
    }

    if (!provider || !["credentials", "google"].includes(provider)) {
      return NextResponse.json(
        { message: "Invalid authentication provider." },
        { status: 400 }
      );
    }

    await connectDB();

    const userId = session.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    if (user.deleted) {
      return NextResponse.json(
        { message: "Account is already deleted." },
        { status: 400 }
      );
    }

    // ─── Re-authentication ─────────────────────────────────────────────
    if (provider === "credentials") {
      if (!password || typeof password !== "string") {
        return NextResponse.json(
          { message: "Password is required for re-authentication." },
          { status: 400 }
        );
      }

      if (!user.password) {
        return NextResponse.json(
          { message: "This account does not have a password. Use Google re-authentication." },
          { status: 400 }
        );
      }

      const isCorrectPassword = await bcrypt.compare(password, user.password);
      if (!isCorrectPassword) {
        return NextResponse.json(
          { message: "Incorrect password." },
          { status: 403 }
        );
      }
    } else if (provider === "google") {
      // For Google-only users, the valid NextAuth session is proof of identity.
      // They authenticated via Google OAuth to obtain this session.
      // We verify they don't have a password (pure Google user) or that
      // their authProviders include Google.
      if (!user.authProviders.includes("google")) {
        return NextResponse.json(
          { message: "This account is not linked to Google." },
          { status: 400 }
        );
      }
    }

    // ─── Soft-delete: anonymize the user document ──────────────────────
    // Generate a stable suffix from the last 4 hex chars of the ObjectId
    // so that multiple deleted users in a group chat remain distinguishable.
    const idSuffix = user._id.toString().slice(-4).toUpperCase();
    const deletedName = `Deleted User #${idSuffix}`;

    await User.findByIdAndUpdate(userId, {
      $set: {
        deleted: true,
        deletedAt: new Date(),
        name: deletedName,
        image: "",
        isOnline: false,
        lastSeen: new Date(),
        blockedUsers: [],
      },
    });

    // ─── Cleanup related documents ─────────────────────────────────────
    // Push subscriptions — no more notifications for a deleted account
    await PushSubscription.deleteMany({ userId });

    // Public encryption key — deleted users should not receive new encrypted messages
    await UserKey.deleteMany({ userId });

    // Starred messages — personal bookmarks, no longer needed
    await StarredMessage.deleteMany({ userId });

    // ─── Notes on what we intentionally preserve ───────────────────────
    // - email: kept for support-assisted recovery
    // - password hash: kept for recovery; login is blocked by deleted flag
    // - authProviders: historical data useful for recovery
    // - settings: no reason to destroy; inaccessible to anyone
    // - messages: sender references point to this _id → shows "Deleted User #XXXX"
    // - calls: participant/caller references preserved
    // - chats: user remains in users[] array so chat history is intact

    return NextResponse.json(
      { message: "Account deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
