"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react";

export default function Cta() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-b from-transparent to-blue-50/40 dark:to-blue-950/20 border-t border-gray-200/80 dark:border-white/5">
      {/* Background Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/10 blur-3xl pointer-events-none rounded-full"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Get Started Today</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight max-w-2xl mx-auto">
          Your next conversation starts here.
        </h2>

        <p className="text-base sm:text-lg text-gray-600 dark:text-zinc-300 max-w-xl mx-auto leading-relaxed">
          Experience a more connected way to communicate. Zero configuration required—connect directly in your browser.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          {isAuthenticated ? (
            <Link
              href="/chat"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-600/20 transition-all duration-150 transform hover:-translate-y-0.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch Zline Chat</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-150 transform hover:-translate-y-0.5"
              >
                <span>Create Your Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 text-gray-800 dark:text-zinc-200 font-medium text-base hover:bg-gray-50 dark:hover:bg-zinc-850 transition-all duration-150"
              >
                Log In
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

