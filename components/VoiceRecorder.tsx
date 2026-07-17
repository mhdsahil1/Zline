"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Mic, X, Send, Loader2 } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
  disabled?: boolean;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceRecorder({ onSend, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Don't do anything here — send is handled by handleSend
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setDuration(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 1000);
    } catch {
      setError("Microphone access denied.");
    }
  };

  const handleSend = async () => {
    if (!mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;
    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    // Wait for the recorder to stop and collect final data
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsSending(true);

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    if (blob.size > 100 * 1024 * 1024) {
      setError("Voice message exceeds 100MB.");
      setIsSending(false);
      return;
    }

    try {
      await onSend(blob, finalDuration);
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);
    setDuration(0);
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500">
        <span>{error}</span>
        <button onClick={() => setError(null)}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-red-50 dark:bg-red-950/30 rounded-full animate-in fade-in duration-200">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400 min-w-[40px]">
          {formatTimer(duration)}
        </span>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
          title="Cancel recording"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={handleSend}
          className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          title="Send voice message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (isSending) {
    return (
      <div className="w-9 h-9 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={startRecording}
      className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 flex-shrink-0"
      title="Record voice message"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}
