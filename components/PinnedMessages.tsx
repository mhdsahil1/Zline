"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Pin, X, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface PinnedMessagesProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onScrollToMessage: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  pinnedCount: number;
}

export default function PinnedMessages({
  chatId,
  isOpen,
  onClose,
  onScrollToMessage,
  onUnpin,
  pinnedCount,
}: PinnedMessagesProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPinned = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/messages/pin?chatId=${chatId}`);
      if (res.ok) {
        setMessages(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch pinned messages:", err);
    }
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    if (isOpen) {
      fetchPinned();
    }
  }, [isOpen, fetchPinned, pinnedCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Pinned Messages ({messages.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Pin className="w-8 h-8 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-zinc-500">
                No pinned messages yet
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg._id}
                className="px-4 py-3 border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        {msg.sender?.name || "Unknown"}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                        {msg.createdAt ? format(new Date(msg.createdAt), "dd/MM/yy HH:mm") : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-zinc-300 mt-0.5 line-clamp-3 break-words">
                      {msg.type === "image" ? "📷 Photo" :
                       msg.type === "file" ? `📎 ${msg.fileName || "File"}` :
                       msg.type === "voice" ? "🎤 Voice message" :
                       msg.content || ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        onScrollToMessage(msg._id);
                        onClose();
                      }}
                      className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Jump to message"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUnpin(msg._id)}
                      className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                      title="Unpin"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
