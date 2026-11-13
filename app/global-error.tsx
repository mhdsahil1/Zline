"use client";

import React, { useEffect } from "react";
import Logo from "@/components/Logo";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Zline Global Root Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="m-0 font-sans antialiased bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 flex flex-col items-center">
            <Logo className="h-16 w-auto mb-6" />

            <span className="text-sm font-bold tracking-widest text-red-600 dark:text-red-400 uppercase mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Critical Error
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Application Error
            </h1>

            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8 max-w-xs leading-relaxed">
              A critical error prevented the application from rendering. Please reload the page or try again.
            </p>

            <button
              type="button"
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

