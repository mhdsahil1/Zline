"use client";

import { useState } from "react";
import {
  MessageSquare,
  Video,
  Mic,
  Pin,
  CheckCheck,
  Phone,
  PhoneOff,
  Volume2,
  FileText,
  Download,
  Play,
  Pause,
  Star,
  Trash2,
  Edit2,
  Sparkles,
} from "lucide-react";

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<"chat" | "calling" | "voice" | "management">("chat");

  const tabs = [
    { id: "chat", label: "Encrypted Chat", icon: MessageSquare },
    { id: "calling", label: "WebRTC HD Calling", icon: Video },
    { id: "voice", label: "Audio & Media", icon: Mic },
    { id: "management", label: "Message Controls", icon: Pin },
  ];

  return (
    <section id="product" className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold tracking-wide uppercase">
            Interactive Showcase
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            See Zline in Action
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Experience the thoughtful details that make chatting, calling, and collaborating feel completely effortless.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display Area */}
        <div className="max-w-4xl mx-auto rounded-3xl border border-gray-200/90 dark:border-white/10 bg-white dark:bg-[#181515] shadow-2xl p-6 sm:p-10 overflow-hidden">
          {/* TAB 1: Encrypted Chat */}
          {activeTab === "chat" && (
            <div className="space-y-6 animate-in fade-in zoom-in-98 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    End-to-End Encrypted Group & 1-on-1 Messages
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Live WebSockets socket connection with instant presence status and delivery indicators
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-xs font-semibold border border-green-200/60 dark:border-green-900/40">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live Sync
                </span>
              </div>

              {/* Chat Simulation */}
              <div className="space-y-4 max-w-2xl mx-auto py-4">
                <div className="flex items-end gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    A
                  </div>
                  <div className="bg-gray-100 dark:bg-zinc-800/90 rounded-2xl rounded-bl-xs p-3.5 max-w-[80%]">
                    <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                      Alex Rivera
                    </div>
                    <p className="text-xs text-gray-800 dark:text-zinc-200 leading-relaxed">
                      Just tested the web socket token auth. Connection handshakes are under 8ms across regions!
                    </p>
                    <div className="text-[10px] text-gray-400 text-right mt-1">10:48 AM</div>
                  </div>
                </div>

                <div className="flex items-end justify-end gap-2.5 ml-auto">
                  <div className="bg-blue-600 text-white rounded-2xl rounded-br-xs p-3.5 max-w-[80%] shadow-xs">
                    <p className="text-xs leading-relaxed">
                      Awesome. All encrypted payloads use local RSA keypairs with zero server-side plaintext storage.
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-blue-200 mt-1">
                      <span>10:49 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                    </div>
                  </div>
                </div>

                <div className="flex items-end gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    S
                  </div>
                  <div>
                    <div className="bg-gray-100 dark:bg-zinc-800/90 rounded-2xl rounded-bl-xs p-3.5 max-w-[80%]">
                      <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mb-0.5">
                        Sarah Jenkins
                      </div>
                      <p className="text-xs text-gray-800 dark:text-zinc-200 leading-relaxed">
                        The real-time typing indicators are super crisp too. Feels just like a native desktop app.
                      </p>
                      <div className="text-[10px] text-gray-400 text-right mt-1">10:50 AM</div>
                    </div>
                    {/* Reactions */}
                    <div className="flex items-center gap-1 mt-1.5 ml-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-300 font-medium">
                        👍 <span>4</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs text-gray-700 dark:text-zinc-300 font-medium">
                        🔥 <span>2</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HD WebRTC Calling */}
          {activeTab === "calling" && (
            <div className="space-y-6 animate-in fade-in zoom-in-98 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    High-Definition Peer-to-Peer Voice & Video Calls
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    WebRTC direct peer connections with adaptive audio codec & low-latency video
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200/60 dark:border-purple-900/40">
                  HD WebRTC Active
                </span>
              </div>

              {/* Calling Simulation Card */}
              <div className="relative rounded-2xl bg-gradient-to-br from-zinc-900 to-black p-8 text-center text-white overflow-hidden max-w-xl mx-auto shadow-xl">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 text-white font-bold text-3xl flex items-center justify-center mx-auto mb-4 ring-4 ring-blue-500/30 animate-pulse">
                  S
                </div>
                <div className="text-xl font-bold mb-1">Sarah Jenkins</div>
                <div className="text-xs text-green-400 font-medium flex items-center justify-center gap-1.5 mb-8">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  04:12 • 1080p WebRTC Encrypted Stream
                </div>

                {/* Call Control Buttons */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    aria-label="Mute audio"
                    className="p-3.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Toggle video"
                    className="p-3.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white transition-colors"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="End call"
                    className="p-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-colors"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Audio Notes & Media Sharing */}
          {activeTab === "voice" && (
            <div className="space-y-6 animate-in fade-in zoom-in-98 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Integrated Audio Notes & File Previews
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Record voice messages with live waveform visualization and preview media inline
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200/60 dark:border-blue-900/40">
                  Rich Media
                </span>
              </div>

              {/* Audio & Media Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto py-2">
                {/* Voice Note Demo */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-850 border border-gray-200/80 dark:border-zinc-750 space-y-3">
                  <div className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <span>Voice Message Recording</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200/60 dark:border-zinc-800">
                    <button
                      type="button"
                      aria-label="Play sample audio"
                      className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                    <div className="flex-1 flex items-center gap-1">
                      {[10, 20, 28, 14, 22, 18, 26, 12, 16, 24, 18, 10].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-blue-500 rounded-full"
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-gray-500">0:36</span>
                  </div>
                </div>

                {/* File Attachment Demo */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-850 border border-gray-200/80 dark:border-zinc-750 space-y-3">
                  <div className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span>Inline Document Preview</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200/60 dark:border-zinc-800">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        Product_Roadmap_2026.pdf
                      </div>
                      <div className="text-[10px] text-gray-400">3.4 MB • PDF</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Download document"
                      className="text-blue-600 hover:text-blue-700 p-1"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Message Controls & Management */}
          {activeTab === "management" && (
            <div className="space-y-6 animate-in fade-in zoom-in-98 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Granular Conversation Controls
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Edit sent messages, pin notices to header, star items, or delete for everyone
                  </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-200/60 dark:border-rose-900/40">
                  Full Ownership
                </span>
              </div>

              {/* Management Demos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-2xl mx-auto py-2">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-850 border border-gray-200/60 dark:border-zinc-800 text-center space-y-2">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mx-auto">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Edit Messages</div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    Fix typos after sending with clear &apos;edited&apos; history.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-850 border border-gray-200/60 dark:border-zinc-800 text-center space-y-2">
                  <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
                    <Pin className="w-4 h-4 rotate-45" />
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Pin Announcements</div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    Keep important notices pinned to the header for quick reference.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-850 border border-gray-200/60 dark:border-zinc-800 text-center space-y-2">
                  <div className="w-9 h-9 rounded-full bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 flex items-center justify-center mx-auto">
                    <Star className="w-4 h-4 fill-yellow-500" />
                  </div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Starred Messages</div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    Bookmark key conversations to review anytime from the sidebar.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

