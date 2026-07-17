"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Star, X, Loader2, ArrowRight, MessageCircle } from "lucide-react";
import { format } from "date-fns";

interface StarredMessagesProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToChat: (chatId: string, messageId: string) => void;
}

export default function StarredMessages({
  isOpen,
  onClose,
  onNavigateToChat,
}: StarredMessagesProps) {
  const [starred, setStarred] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStarred = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages/star");
      if (res.ok) {
        setStarred(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch starred messages:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) fetchStarred();
  }, [isOpen, fetchStarred]);

  const handleUnstar = async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages/star?messageId=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStarred((prev) => prev.filter((s) => s.messageId?._id !== messageId));
      }
    } catch (err) {
      console.error("Failed to unstar:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Starred Messages
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
          ) : starred.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Star className="w-8 h-8 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-zinc-500">
                No starred messages
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                Long-press a message and tap Star to save it here.
              </p>
            </div>
          ) : (
            starred.map((item) => {
              const msg = item.messageId;
              const chat = item.chatId;
              if (!msg) return null;

              const chatName = chat?.isGroup
                ? chat.groupName || "Group"
                : chat?.users
                    ?.filter((u: any) => u._id !== msg.sender?._id)
                    ?.map((u: any) => u.name)
                    ?.join(", ") || "Chat";

              return (
                <div
                  key={item._id}
                  className="px-4 py-3 border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageCircle className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 truncate">
                      {chatName}
                    </span>
                  </div>
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
                          onNavigateToChat(chat?._id, msg._id);
                          onClose();
                        }}
                        className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Go to message"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleUnstar(msg._id)}
                        className="p-1.5 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-500 hover:text-yellow-600 transition-colors"
                        title="Unstar"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
