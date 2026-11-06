"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Phone,
  Video,
  Search,
  CheckCheck,
  Paperclip,
  Mic,
  Send,
  Pin,
  FileText,
  Download,
  Users,
  Play,
  Sparkles,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

export default function Hero() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
      {/* Background radial glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] md:w-[900px] md:h-[450px] bg-gradient-to-tr from-blue-600/15 via-orange-500/10 to-transparent blur-3xl pointer-events-none rounded-full"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Hero Copy */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-medium shadow-xs">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Next-Gen Real-Time Communication</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Conversations Without{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-orange-500">
              Boundaries.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-600 dark:text-zinc-300 leading-relaxed max-w-2xl mx-auto">
            Connect, share, and communicate in real time. Zline brings your
            conversations together with privacy, simplicity, and a seamless
            messaging experience.
          </p>

          {/* CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href={isAuthenticated ? "/chat" : "/register"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-150 transform hover:-translate-y-0.5"
            >
              <span>{isAuthenticated ? "Open Zline Web App" : "Get Started"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href={isAuthenticated ? "/chat" : "/login"}
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 text-gray-800 dark:text-zinc-200 font-medium text-base hover:bg-gray-50 dark:hover:bg-zinc-850 transition-all duration-150"
            >
              {isAuthenticated ? "Go to Messages" : "Sign In"}
            </Link>
          </div>

          {/* Trust Specs */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-green-500" /> End-to-End Encrypted
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-500" /> Sub-10ms WebSockets
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-purple-500" /> Peer-to-Peer WebRTC
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" /> Zero Download Required
            </span>
          </div>
        </div>

        {/* Realistic Desktop Product Preview */}
        <div className="mt-14 sm:mt-20 max-w-5xl mx-auto">
          <div className="rounded-2xl sm:rounded-3xl border border-gray-200/90 dark:border-white/10 bg-white dark:bg-[#181515] shadow-2xl shadow-black/10 dark:shadow-black/50 overflow-hidden">
            {/* Window title bar */}
            <div className="h-10 px-4 bg-gray-100/90 dark:bg-[#201c1c] border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="text-xs font-semibold text-gray-500 dark:text-zinc-400 tracking-wide">
                Zline Desktop • Sarah Jenkins
              </div>
              <div className="w-12 text-right">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-ping" />
              </div>
            </div>

            {/* Desktop UI Body */}
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
              {/* Left Sidebar Preview */}
              <div className="hidden md:flex md:col-span-4 border-r border-gray-200 dark:border-zinc-800 flex-col bg-gray-50/70 dark:bg-[#141212]">
                {/* Search */}
                <div className="p-3 border-b border-gray-200/60 dark:border-zinc-800">
                  <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-xs text-gray-400 border border-gray-200/80 dark:border-zinc-800">
                    <Search className="w-3.5 h-3.5" />
                    <span>Search conversations...</span>
                  </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 divide-y divide-gray-100 dark:divide-zinc-900/60">
                  {/* Active Chat Item: Sarah */}
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border-l-3 border-blue-600 flex items-center gap-3">
                    <div className="relative">
                      <UserAvatar
                        image="Sarah Jenkins:12"
                        name="Sarah Jenkins"
                        className="w-10 h-10 shadow-xs"
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-zinc-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          Sarah Jenkins
                        </span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          11:42 AM
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-zinc-300 truncate">
                        Just tested the new HD video call! It&apos;s super snappy 🚀
                      </p>
                    </div>
                  </div>

                  {/* Group Chat Item: Engineering Core */}
                  <div className="p-3 flex items-center gap-3 hover:bg-gray-100/50 dark:hover:bg-zinc-900/40 transition-colors">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-bold flex items-center justify-center text-sm">
                        <Users className="w-5 h-5 text-purple-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">
                          Engineering Core
                        </span>
                        <span className="text-[10px] text-gray-400">10:15 AM</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">
                          Alex: Deployment to prod completed
                        </p>
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                          3
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chat Item: Alex Rivera */}
                  <div className="p-3 flex items-center gap-3 hover:bg-gray-100/50 dark:hover:bg-zinc-900/40 transition-colors">
                    <UserAvatar
                      image="Alex Rivera:5"
                      name="Alex Rivera"
                      className="w-10 h-10"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">
                          Alex Rivera
                        </span>
                        <span className="text-[10px] text-gray-400">Yesterday</span>
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">
                        Let&apos;s review the PR tomorrow morning.
                      </p>
                    </div>
                  </div>

                  {/* Chat Item: Elena Rostova */}
                  <div className="p-3 flex items-center gap-3 hover:bg-gray-100/50 dark:hover:bg-zinc-900/40 transition-colors">
                    <UserAvatar
                      image="Elena Rostova:19"
                      name="Elena Rostova"
                      className="w-10 h-10"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">
                          Elena Rostova
                        </span>
                        <span className="text-[10px] text-gray-400">Thursday</span>
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate flex items-center gap-1">
                        <Mic className="w-3 h-3 text-blue-500" /> Voice message (0:48)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Conversation Window */}
              <div className="col-span-1 md:col-span-8 flex flex-col bg-white dark:bg-[#181515]">
                {/* Active Chat Header */}
                <div className="h-14 px-4 border-b border-gray-200/80 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <UserAvatar
                        image="Sarah Jenkins:12"
                        name="Sarah Jenkins"
                        className="w-9 h-9"
                      />
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border border-white dark:border-zinc-900" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                          Sarah Jenkins
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-[10px] font-semibold border border-green-200/60 dark:border-green-900/40">
                          🔒 E2EE Active
                        </span>
                      </div>
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        Online
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Start Voice Call"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Start Video Call"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pinned announcement strip */}
                <div className="px-4 py-1.5 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <Pin className="w-3.5 h-3.5 text-amber-600 rotate-45 flex-shrink-0" />
                  <span className="truncate">
                    Pinned: WebRTC HD group audio & video calling is active.
                  </span>
                </div>

                {/* Message Flow */}
                <div className="flex-1 p-4 space-y-3.5 overflow-y-auto text-xs bg-gray-50/40 dark:bg-black/20">
                  {/* Message 1 (Incoming) */}
                  <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      S
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-2xl rounded-bl-xs p-3 shadow-xs">
                      <p className="text-gray-800 dark:text-zinc-200">
                        Hey! Did you see the new end-to-end encryption update on Zline?
                      </p>
                      <div className="text-[9px] text-gray-400 text-right mt-1">11:38 AM</div>
                    </div>
                  </div>

                  {/* Message 2 (Outgoing) */}
                  <div className="flex items-end justify-end gap-2 ml-auto max-w-[85%] sm:max-w-[75%]">
                    <div className="bg-blue-600 text-white rounded-2xl rounded-br-xs p-3 shadow-xs">
                      <p>
                        Yes! 2048-bit RSA + 256-bit AES-GCM right in the browser. Zero plaintext stored on the server.
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[9px] text-blue-200 text-right mt-1">
                        <span>11:39 AM</span>
                        <CheckCheck className="w-3 h-3 text-blue-200" />
                      </div>
                    </div>
                  </div>

                  {/* Message 3 (Incoming with reactions) */}
                  <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      S
                    </div>
                    <div>
                      <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-2xl rounded-bl-xs p-3 shadow-xs">
                        <p className="text-gray-800 dark:text-zinc-200">
                          That&apos;s impressive. Check out the project architecture diagram I just sent!
                        </p>
                        <div className="text-[9px] text-gray-400 text-right mt-1">11:40 AM</div>
                      </div>
                      {/* Reaction badges */}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[10px]">
                          ❤️ <span>2</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-[10px] text-blue-600 dark:text-blue-300">
                          🚀 <span>3</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message 4 (Outgoing Voice Note Waveform Player) */}
                  <div className="flex items-end justify-end gap-2 ml-auto max-w-[85%] sm:max-w-[75%]">
                    <div className="bg-blue-600 text-white rounded-2xl rounded-br-xs p-3 shadow-xs min-w-[220px]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-xs">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                        {/* Waveform bars */}
                        <div className="flex-1 flex items-center gap-1">
                          {[14, 24, 18, 30, 22, 16, 28, 20, 12, 26, 18, 10].map((h, i) => (
                            <span
                              key={i}
                              className="w-1 bg-white/80 rounded-full"
                              style={{ height: `${h}px` }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono opacity-90">0:42</span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[9px] text-blue-200 text-right mt-1.5">
                        <span>11:41 AM</span>
                        <CheckCheck className="w-3 h-3 text-blue-200" />
                      </div>
                    </div>
                  </div>

                  {/* Message 5 (Incoming Attachment Card) */}
                  <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      S
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-2xl rounded-bl-xs p-3 shadow-xs">
                      <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-gray-200/60 dark:border-zinc-700">
                        <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">
                            Zline_Protocol_Whitepaper.pdf
                          </div>
                          <div className="text-[10px] text-gray-400">1.8 MB • PDF Document</div>
                        </div>
                        <button
                          type="button"
                          aria-label="Download attachment"
                          className="p-1.5 text-blue-600 hover:text-blue-700"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-[9px] text-gray-400 text-right mt-1">11:42 AM</div>
                    </div>
                  </div>
                </div>

                {/* Input Area Preview */}
                <div className="p-3 border-t border-gray-200/80 dark:border-zinc-800 bg-white dark:bg-[#181515]">
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-900 rounded-full px-3 py-1.5 border border-gray-200/60 dark:border-zinc-800">
                    <button
                      type="button"
                      aria-label="Attach File"
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      readOnly
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent text-xs text-gray-600 dark:text-zinc-300 outline-none"
                      value=""
                    />
                    <button
                      type="button"
                      aria-label="Voice Message"
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Send Message"
                      className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

