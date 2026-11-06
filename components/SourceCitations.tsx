"use client";

import React, { useState } from "react";
import { ExternalLink, Globe, Calendar, ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { ResearchSource } from "@/lib/obscura/types";

interface SourceCitationsProps {
  sources: ResearchSource[];
  query?: string;
}

export default function SourceCitations({ sources, query }: SourceCitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  const displaySources = isExpanded ? sources : sources.slice(0, 3);
  const hasMore = sources.length > 3;

  const getDomain = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return "Web Source";
    }
  };

  return (
    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-zinc-800 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 font-medium">
          <Globe className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
          <span>Research Sources ({sources.length})</span>
          {query && (
            <span className="text-[10px] text-gray-400 dark:text-zinc-500 truncate max-w-[180px]">
              • &ldquo;{query}&rdquo;
            </span>
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
          >
            {isExpanded ? (
              <>
                Show less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                +{sources.length - 3} more <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {displaySources.map((source, index) => {
          const domain = source.siteName || getDomain(source.url);

          return (
            <a
              key={source.url + index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="group block p-2 rounded-xl bg-gray-50/90 dark:bg-zinc-850/80 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 border border-gray-200/60 dark:border-zinc-750 transition-all duration-150 relative overflow-hidden"
              title={source.title}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400 truncate">
                    {domain}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {source.browsed && (
                    <span
                      title="Rendered and extracted via Obscura headless browser"
                      className="px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 text-[9px] font-semibold flex items-center gap-0.5"
                    >
                      <Cpu className="w-2.5 h-2.5" />
                      <span>Obscura</span>
                    </span>
                  )}
                  <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>

              <p className="mt-1 text-[11px] font-semibold text-gray-900 dark:text-zinc-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {source.title}
              </p>

              {source.snippet && (
                <p className="mt-0.5 text-[10px] text-gray-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {source.snippet}
                </p>
              )}

              <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-gray-400 dark:text-zinc-500">
                {source.publishedDate ? (
                  <div className="flex items-center gap-1 truncate">
                    <Calendar className="w-2.5 h-2.5 shrink-0" />
                    <span>{source.publishedDate}</span>
                  </div>
                ) : <span />}
                {source.author && (
                  <span className="truncate max-w-[100px]">By {source.author}</span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
