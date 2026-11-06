"use client";

import React from "react";
import OrbCoil from "@/components/originkit/ui/particle-winding";

interface LoadingAnimationProps {
  message?: string;
  submessage?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
}

export function OrbLoading({
  size = "md",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeMap = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${sizeMap[size]} ${className}`}>
      <OrbCoil />
    </div>
  );
}

export default function LoadingAnimation({
  message = "Loading Zline",
  submessage = "Establishing secure connection...",
  className = "",
  size = "fullscreen",
}: LoadingAnimationProps) {
  if (size === "fullscreen") {
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-black transition-colors ${className}`}
      >
        <div className="w-48 h-48 sm:w-60 sm:h-60 relative flex items-center justify-center">
          <OrbCoil />
        </div>
        <div className="mt-4 flex flex-col items-center gap-1.5 text-center px-4">
          <p className="text-sm font-bold tracking-widest uppercase text-gray-900 dark:text-gray-100 animate-pulse">
            {message}
          </p>
          {submessage && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">
              {submessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  const containerSize =
    size === "lg" ? "w-32 h-32" : size === "sm" ? "w-12 h-12" : "w-24 h-24";

  return (
    <div className={`flex flex-col items-center justify-center py-6 gap-3 ${className}`}>
      <div className={`${containerSize} relative flex items-center justify-center`}>
        <OrbCoil />
      </div>
      {message && (
        <p className="text-xs font-semibold text-gray-600 dark:text-zinc-400 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

