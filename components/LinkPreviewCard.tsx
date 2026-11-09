"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";

interface PreviewData {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  siteName: string;
  favicon: string | null;
}

const previewCache = new Map<string, PreviewData | null>();

export default function LinkPreviewCard({
  url,
  isMe = false,
}: {
  url: string;
  isMe?: boolean;
}) {
  const [data, setData] = useState<PreviewData | null>(previewCache.get(url) || null);
  const [loading, setLoading] = useState<boolean>(!previewCache.has(url));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (previewCache.has(url)) {
      setData(previewCache.get(url) || null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Status " + res.status);
        return res.json();
      })
      .then((preview: PreviewData) => {
        if (isMounted) {
          previewCache.set(url, preview);
          setData(preview);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          previewCache.set(url, null);
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (loading || !data || !data.title) {
    return null;
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 block rounded-xl overflow-hidden border transition-all text-left no-underline group ${
        isMe
          ? "bg-blue-700/40 hover:bg-blue-700/60 border-blue-400/30 text-white"
          : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-700/80 text-gray-900 dark:text-zinc-100"
      }`}
    >
      {data.image && !imgError && (
        <div className="relative w-full h-32 sm:h-36 bg-black/5 dark:bg-black/20 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.image}
            alt={data.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-2.5">
        <div className="flex items-center gap-1.5 text-[11px] mb-1 font-medium opacity-75">
          {data.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.favicon}
              alt=""
              className="w-3.5 h-3.5 rounded-sm object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <Globe className="w-3.5 h-3.5" />
          )}
          <span className="truncate flex-1">{data.siteName}</span>
          <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
        <p className="text-xs font-semibold line-clamp-1 group-hover:underline">
          {data.title}
        </p>
        {data.description && (
          <p
            className={`text-[11px] mt-0.5 line-clamp-2 ${
              isMe ? "text-blue-100" : "text-gray-500 dark:text-zinc-400"
            }`}
          >
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}

