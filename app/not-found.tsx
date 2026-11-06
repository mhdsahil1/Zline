import Link from "next/link";
import Logo from "@/components/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you are looking for does not exist on Zline.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950 text-center">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex flex-col items-center">
        <Logo className="h-16 w-auto mb-6" />
        <span className="text-sm font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase mb-2">
          Error 404
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Page Not Found
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8 max-w-xs">
          Sorry, the page you requested does not exist or has been moved to a new URL.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link
            href="/chat"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
          >
            Go to Chats
          </Link>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 font-medium text-sm transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

