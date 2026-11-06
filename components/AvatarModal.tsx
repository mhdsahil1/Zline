"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { X, Sparkles, Loader2 } from "lucide-react";
import AvatarPicker, { avatarSeed } from "@/components/AvatarPicker";

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (seed: string) => void;
  initialName?: string;
  isOnboarding?: boolean;
}

export default function AvatarModal({
  isOpen,
  onClose,
  onSuccess,
  initialName,
  isOnboarding = false,
}: AvatarModalProps) {
  const { data: session, update } = useSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentName = initialName || session?.user?.name || "Zline User";

  const handleSave = async (result: {
    displayName: string;
    variant: number;
    seed: string;
  }) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: result.seed,
          name: result.displayName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update profile avatar");
      }

      // Update client-side session immediately
      await update({
        image: result.seed,
        name: result.displayName,
      });

      onSuccess?.(result.seed);
      onClose();
    } catch (err: any) {
      console.error("Avatar save error:", err);
      setError(err.message || "Failed to save avatar. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to reset avatar");
      }

      // Update client-side session to null
      await update({
        image: null,
      });

      onSuccess?.("");
      onClose();
    } catch (err: any) {
      console.error("Avatar reset error:", err);
      setError(err.message || "Failed to reset avatar. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[95vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-modal-title"
      >
        {/* Close / Skip button */}
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        {isOnboarding && (
          <div className="flex items-center gap-1.5 w-fit px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to Zline</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="mb-4">
          <h2
            id="avatar-modal-title"
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            {isOnboarding ? "Choose Your Avatar" : "Update Your Avatar"}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {isOnboarding
              ? "Give your profile a unique personality! Spin the coin or choose a style that fits you."
              : "Pick or spin a new dynamic avatar generated uniquely for you."}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Avatar Picker Component */}
        <div className="flex justify-center">
          <AvatarPicker
            defaultValue={{
              displayName: currentName,
              variant: Math.floor(Math.random() * 50),
            }}
            title="Custom Avatar"
            description="Drag sideways or tap shuffle to explore faces."
            submitLabel={saving ? "Saving..." : "Save Avatar"}
            onComplete={handleSave}
            className="border-0 p-0 shadow-none bg-transparent dark:bg-transparent"
          />
        </div>

        {saving && (
          <div className="absolute inset-0 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">
              Saving your avatar...
            </p>
          </div>
        )}

        {/* Options: Use Default Initial / Dismiss */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={saving}
            className="text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Use default initial avatar
          </button>
          {isOnboarding ? (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 font-medium transition-colors"
            >
              I&apos;ll do this later
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

