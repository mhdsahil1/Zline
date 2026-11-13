"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { AlertTriangle, RotateCcw, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Zline Application Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950 text-center selection:bg-red-500/20">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <Logo className="h-16 w-auto mb-6" />

        <span className="text-sm font-bold tracking-widest text-red-600 dark:text-red-400 uppercase mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          Application Error
        </span>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Something Went Wrong
        </h1>

        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6 max-w-xs leading-relaxed">
          {error?.message && !error.message.includes("digest")
            ? error.message
            : "An unexpected error occurred while processing this request. Your end-to-end encrypted keys and data remain safe and intact."}
        </p>

        {error?.digest && (
          <div className="w-full mb-6">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{showDetails ? "Hide technical details" : "Show technical details"}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDetails && (
              <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-zinc-950/80 border border-gray-200 dark:border-zinc-800 text-left font-mono text-[11px] text-gray-600 dark:text-zinc-400 break-all overflow-x-auto">
                <p className="text-gray-400 dark:text-zinc-500 text-[10px] uppercase tracking-wider mb-1">
                  Error Digest:
                </p>
                <code>{error.digest}</code>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/chat"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 font-medium text-sm transition-all cursor-pointer active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Go to Chats</span>
          </Link>
        </div>

        <Link
          href="/"
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}

