"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, X, ChevronUp, ChevronDown, Search } from "lucide-react";

interface ChatSearchProps {
  messages: any[];
  onClose: () => void;
  onScrollToMessage: (messageId: string) => void;
  initialQuery?: string;
}

export default function ChatSearch({
  messages,
  onClose,
  onScrollToMessage,
  initialQuery = "",
}: ChatSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages
      .filter(
        (m) =>
          m.content &&
          !m.deletedForEveryone &&
          m.content.toLowerCase().includes(q)
      )
      .map((m) => m._id);
  }, [query, messages]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index when matches change
  useEffect(() => {
    setCurrentIndex(0);
    if (matches.length > 0) {
      onScrollToMessage(matches[0]);
    }
  }, [matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const goNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    setCurrentIndex(next);
    onScrollToMessage(matches[next]);
  }, [currentIndex, matches, onScrollToMessage]);

  const goPrev = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prev);
    onScrollToMessage(matches[prev]);
  }, [currentIndex, matches, onScrollToMessage]);

  return (
    <div className="flex items-center gap-2 w-full">
      <button onClick={onClose}>
        <ArrowLeft className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:text-zinc-400" />
      </button>
      <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in conversation..."
          className="flex-1 bg-transparent text-sm outline-none dark:text-white"
        />
        {query && (
          <button onClick={() => setQuery("")}>
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
      {matches.length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-gray-500 dark:text-zinc-400 min-w-[45px] text-center">
            {currentIndex + 1}/{matches.length}
          </span>
          <button
            onClick={goPrev}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={goNext}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
      {query.trim() && matches.length === 0 && (
        <span className="text-[10px] text-gray-400 flex-shrink-0">No results</span>
      )}
    </div>
  );
}
