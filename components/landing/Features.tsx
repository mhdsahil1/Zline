import {
  MessageSquare,
  ShieldCheck,
  Video,
  FileUp,
  Edit3,
  Smile,
  Mic,
  Pin,
  Lock,
  PhoneCall,
  Search,
  CheckCheck,
} from "lucide-react";

export default function Features() {
  const features = [
    {
      icon: MessageSquare,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-900/40",
      title: "Real-Time Messaging",
      tagline: "Instantaneous delivery with zero lag",
      description:
        "Powered by low-latency WebSockets, messages arrive instantaneously. Enjoy live typing indicators, delivery checkmarks, and seen timestamps so you never miss a beat.",
      highlights: ["Sub-10ms delivery latency", "Live typing indicators", "Delivered & seen receipts"],
    },
    {
      icon: ShieldCheck,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40",
      title: "End-to-End Encryption",
      tagline: "Your conversations stay private",
      description:
        "Client-side cryptography utilizing the browser's native Web Crypto API. Hybrid RSA-OAEP 2048-bit key exchange combined with AES-GCM 256-bit encryption ensures zero plaintext on the server.",
      highlights: ["Native Web Crypto API", "RSA-OAEP 2048-bit keys", "AES-GCM 256-bit payload"],
    },
    {
      icon: Video,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/30 border-purple-200/60 dark:border-purple-900/40",
      title: "Voice & Video Calling",
      tagline: "Direct WebRTC audio and video streams",
      description:
        "Make crystal-clear 1-on-1 and group calls directly in your browser. WebRTC peer-to-peer data channels eliminate relay bottlenecks for pristine audio and high-definition video.",
      highlights: ["P2P WebRTC data streams", "1-on-1 and group calls", "Zero third-party plugin installs"],
    },
    {
      icon: FileUp,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40",
      title: "File & Media Sharing",
      tagline: "Transfer photos, documents, and audio",
      description:
        "Seamlessly share high-resolution images, PDF documents, spreadsheets, and audio files. Built-in inline previews and media players let you review assets without leaving the conversation.",
      highlights: ["Inline document & image viewer", "Secure multipart uploads", "Fast client downloads"],
    },
    {
      icon: Edit3,
      iconColor: "text-rose-500",
      bgColor: "bg-rose-50 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-900/40",
      title: "Message Control & Pinning",
      tagline: "Full ownership of your conversations",
      description:
        "Edit sent messages with an inline editor, delete messages for yourself or everyone, and pin critical notices to the header of any chat or group for persistent visibility.",
      highlights: ["In-place message editing", "Delete for everyone or self", "Pinned header announcements"],
    },
    {
      icon: Smile,
      iconColor: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/60 dark:border-indigo-900/40",
      title: "Reactions & Voice Notes",
      tagline: "Express yourself beyond plain text",
      description:
        "Record high-fidelity voice notes directly from your microphone with interactive waveform playback. Add instant emoji reactions to celebrate or acknowledge messages quickly.",
      highlights: ["Interactive audio waveform player", "Multi-emoji reaction groups", "Star favorite messages"],
    },
  ];

  return (
    <section id="features" className="py-20 md:py-32 bg-gray-50/50 dark:bg-[#151212] border-t border-b border-gray-200/80 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 md:mb-24">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold tracking-wide uppercase">
            Product Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Engineered for Fast, Private Communication
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Every feature in Zline is carefully crafted to deliver speed, security, and human connection without unnecessary bloat.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative bg-white dark:bg-[#1a1717] rounded-2xl p-6 sm:p-8 border border-gray-200/80 dark:border-white/10 hover:border-blue-500/50 dark:hover:border-blue-500/50 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-6 ${feature.bgColor}`}>
                    <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">
                    {feature.tagline}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-6">
                    {feature.description}
                  </p>
                </div>

                {/* Highlights List */}
                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-2">
                  {feature.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-700 dark:text-zinc-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

