"use client";

import React, { useMemo } from "react";
import { createFace, FaceArt } from "@/components/AvatarPicker";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  image?: string | null;
  name?: string | null;
  className?: string;
  textClassName?: string;
  variant?: "blue" | "gray";
}

export default function UserAvatar({
  image,
  name,
  className = "w-10 h-10",
  textClassName = "text-sm",
  variant = "blue",
}: UserAvatarProps) {
  const isUrl = useMemo(() => {
    if (!image || typeof image !== "string") return false;
    return (
      image.startsWith("http://") ||
      image.startsWith("https://") ||
      image.startsWith("data:") ||
      image.startsWith("/")
    );
  }, [image]);

  const faceData = useMemo(() => {
    if (!image || typeof image !== "string" || isUrl) return null;
    try {
      return createFace(image);
    } catch {
      return null;
    }
  }, [image, isUrl]);

  const initial = (name?.trim()?.charAt(0) || "?").toUpperCase();

  // 1. If user has chosen a photo URL
  if (isUrl && image) {
    return (
      <div className={cn("relative rounded-full overflow-hidden shrink-0", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={name || "User Avatar"}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // 2. If user has chosen a Kokonut avatar seed
  if (faceData) {
    return (
      <div className={cn("relative rounded-full overflow-hidden shrink-0 ring-1 ring-black/10 dark:ring-white/10", className)}>
        <FaceArt face={faceData} className="w-full h-full" />
      </div>
    );
  }

  // 3. If user has NOT chosen any avatar: render the exact default initial circle as before
  const defaultColors =
    variant === "gray"
      ? "bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400"
      : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";

  return (
    <div
      className={cn(
        "rounded-full font-bold flex items-center justify-center shrink-0 select-none",
        defaultColors,
        className,
        textClassName
      )}
    >
      {initial}
    </div>
  );
}
