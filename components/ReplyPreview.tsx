"use client";

import React from "react";
import { X, Reply } from "lucide-react";

interface ReplyPreviewProps {
  /** The message being replied to */
  replyMessage: any;
  /** Current user ID to determine if "You" label should be used */
  currentUserId?: string;
  /** Whether this is the strip above the input (true) or inside a message bubble (false) */
  isInputStrip?: boolean;
  /** Called when the user cancels the reply (only for input strip) */
  onCancel?: () => void;
  /** Called when clicking the reply preview inside a bubble (to scroll to original) */
  onClick?: () => void;
}

export default function ReplyPreview({
  replyMessage,
  currentUserId,
  isInputStrip = false,
  onCancel,
  onClick,
}: ReplyPreviewProps) {
  if (!replyMessage) return null;

  const senderId =
    typeof replyMessage.sender === "object" && replyMessage.sender !== null
      ? replyMessage.sender._id
      : replyMessage.sender;
  const senderName =
    typeof replyMessage.sender === "object" && replyMessage.sender !== null
      ? replyMessage.sender.name
      : "Unknown";
  const isMe = senderId === currentUserId;
  const displayName = isMe ? "You" : senderName;

  let preview = replyMessage.content || "";
  if (replyMessage.type === "image") preview = "📷 Photo";
  else if (replyMessage.type === "file") preview = `📎 ${replyMessage.fileName || "File"}`;
  else if (replyMessage.type === "voice") preview = "🎤 Voice message";
  else if (replyMessage.type === "poll") preview = "📊 Poll";
  if (preview.length > 80) preview = preview.slice(0, 80) + "…";

  if (isInputStrip) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 animate-in slide-in-from-bottom duration-150">
        <div className="w-1 h-8 rounded-full bg-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
            <Reply className="w-3 h-3 inline mr-1" />
            Replying to {displayName}
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{preview}</p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Inside a message bubble
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 border-l-2 border-blue-400 dark:border-blue-500 bg-black/5 dark:bg-white/5 rounded-r-lg mb-1 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
    >
      <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-tight">
        {displayName}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate leading-tight">
        {preview}
      </p>
    </button>
  );
}
