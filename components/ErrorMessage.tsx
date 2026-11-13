"use client";

import React from "react";
import { AlertCircle, RotateCcw, X } from "lucide-react";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorMessage({
  title = "Something went wrong",
  message,
  onRetry,
  onDismiss,
  className = "",
}: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 p-4 text-left transition-all ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-1 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">
              {title}
            </h4>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors p-0.5 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-red-700 dark:text-red-300/90 leading-relaxed break-words">
            {message}
          </p>

          {onRetry && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

