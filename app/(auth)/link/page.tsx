"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

function LinkPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const email = searchParams?.get("email") || "";
  const provider = searchParams?.get("provider") || "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  // If no email or provider, redirect back to login
  useEffect(() => {
    if (!email || !provider) {
      router.push("/login");
    }
  }, [email, provider, router]);

  const providerLabel =
    provider === "google" ? "Google" : "email code";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Step 1: Confirm account ownership by verifying password
      const linkRes = await fetch("/api/auth/link/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, provider }),
      });

      const linkData = await linkRes.json();

      if (!linkRes.ok) {
        setError(linkData.message || "Invalid password.");
        setLoading(false);
        return;
      }

      // Step 2: Sign in with the original provider
      if (provider === "google") {
        // For Google, redirect through OAuth flow again — now it will succeed
        await signIn("google", { callbackUrl: "/" });
      } else {
        // For email-otp, sign in with credentials (password) since we just verified it
        const signInRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInRes?.error) {
          setError("Sign-in failed. Please try again.");
          setLoading(false);
          return;
        }

        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (!email || !provider) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
        <div className="flex flex-col items-center justify-center">
          <Logo className="h-16 w-auto mb-6" />
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Link your account
          </h2>
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
            An account with{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {email}
            </span>{" "}
            already exists. Enter your Zline password to link your{" "}
            {providerLabel} sign-in.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
              <p className="text-sm text-red-800 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          {/* Info banner */}
          <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              This confirms you own this account and allows you to sign in with{" "}
              {providerLabel} in the future.
            </p>
          </div>

          <div>
            <label
              htmlFor="link-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Your Zline password
            </label>
            <input
              id="link-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="relative block w-full rounded-xl border-0 py-3 px-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Link
              href="/login"
              className="flex-1 flex justify-center rounded-xl border border-gray-300 px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex justify-center rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? "Linking..." : "Link account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LinkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      }
    >
      <LinkPageContent />
    </Suspense>
  );
}
