import { Zap, Globe, Sparkles, Code2, Users } from "lucide-react";

export default function About() {
  const stats = [
    { label: "Delivery Latency", value: "< 10ms" },
    { label: "Key Encryption", value: "2048-bit RSA" },
    { label: "Payload Cipher", value: "256-bit AES" },
    { label: "Required Installs", value: "0 MB" },
  ];

  return (
    <section id="about" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Main Story */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold tracking-wide uppercase">
              About Zline
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Reimagining the Browser-Native Messenger
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              Modern chat apps have become heavy, bloated, and proprietary. Zline was born from a simple belief: secure, instant communication should run effortlessly in any browser with zero compromise on calling quality or cryptographic privacy.
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1a1717] border border-gray-200/80 dark:border-white/10 shadow-xs text-center">
            {stats.map((stat, i) => (
              <div key={i} className="space-y-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  {stat.value}
                </div>
                <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Key Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mb-3">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Frictionless Speed</h3>
              <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                No 200MB desktop app downloads or background battery drains. Zline loads instantly and syncs seamlessly across devices.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center mb-3">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Open Web Standards</h3>
              <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                Built strictly on standardized W3C and IETF protocols: WebRTC, WebSockets, and the W3C Web Cryptography API.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-3">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Human-Centered UI</h3>
              <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                A distraction-free interface with intentional typography, accessible contrast, and zero intrusive ads or tracking telemetry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

