"use client";

import React from "react";
import {
  Reply, Edit3, Trash2, Pin, Star, Copy, X
} from "lucide-react";

interface MessageActionsProps {
  message: any;
  isMe: boolean;
  onReply: (message: any) => void;
  onEdit: (message: any) => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onStar: (messageId: string, chatId: string) => void;
  onUnstar: (messageId: string) => void;
  isPinned: boolean;
  isStarred: boolean;
  onClose: () => void;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export default function MessageActions({
  message,
  isMe,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onStar,
  onUnstar,
  isPinned,
  isStarred,
  onClose,
}: MessageActionsProps) {
  const canEdit =
    isMe &&
    message.type === "text" &&
    !message.deletedForEveryone &&
    Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS;

  const canDelete = isMe && !message.deletedForEveryone;

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    onClose();
  };

  return (
    <div className="absolute z-30 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-700 py-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
      style={{ [isMe ? "right" : "left"]: 0, bottom: "100%", marginBottom: "4px" }}
    >
      <button
        onClick={() => { onReply(message); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 transition-colors"
      >
        <Reply className="w-3.5 h-3.5 text-blue-500" />
        Reply
      </button>

      {message.content && (
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-gray-500" />
          Copy
        </button>
      )}

      {canEdit && (
        <button
          onClick={() => { onEdit(message); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-500" />
          Edit
        </button>
      )}

      <button
        onClick={() => {
          if (isPinned) { onUnpin(message._id); } else { onPin(message._id); }
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 transition-colors"
      >
        <Pin className={`w-3.5 h-3.5 ${isPinned ? "text-orange-500" : "text-gray-500"}`} />
        {isPinned ? "Unpin" : "Pin"}
      </button>

      <button
        onClick={() => {
          if (isStarred) { onUnstar(message._id); } else { onStar(message._id, message.chat); }
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 transition-colors"
      >
        <Star className={`w-3.5 h-3.5 ${isStarred ? "text-yellow-500 fill-yellow-500" : "text-gray-500"}`} />
        {isStarred ? "Unstar" : "Star"}
      </button>

      {canDelete && (
        <>
          <div className="border-t border-gray-100 dark:border-zinc-700 my-1" />
          <button
            onClick={() => { onDelete(message._id); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete for everyone
          </button>
        </>
      )}
    </div>
  );
}
