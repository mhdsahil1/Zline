import {
  ShieldCheck,
  Key,
  Lock,
  Cpu,
  ServerOff,
  Radio,
  FileCheck2,
} from "lucide-react";

export default function Security() {
  const securityPillars = [
    {
      icon: Cpu,
      title: "Native Web Crypto API Acceleration",
      description:
        "Cryptographic operations run directly on your device's hardware using the browser's standardized Web Crypto API (SubtleCrypto), ensuring maximum performance without third-party code tampering.",
    },
    {
      icon: Lock,
      title: "Hybrid RSA-OAEP & AES-GCM Ciphers",
      description:
        "2048-bit RSA-OAEP key exchange establishes authenticated recipient encryption, while individual message payloads are encrypted with 256-bit AES-GCM utilizing unique 12-byte initialization vectors (IV).",
    },
    {
      icon: ServerOff,
      title: "Zero Plaintext Message Storage",
      description:
        "Messages are encrypted on your local device before transmission over the network. Intermediate servers and database instances only route and persist ciphertext blobs—never legible plaintext.",
    },
    {
      icon: Radio,
      title: "Peer-to-Peer WebRTC Media Streams",
      description:
        "Voice and video calls establish direct peer-to-peer data channels secured via DTLS and SRTP protocols, minimizing relay dependencies and preventing server-side audio/video interception.",
    },
  ];

  return (
    <section id="security" className="py-20 md:py-32 bg-gray-50/50 dark:bg-[#151212] border-t border-b border-gray-200/80 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 md:mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide uppercase">
            Cryptographic Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Your conversations deserve privacy.
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Privacy shouldn&apos;t require blind faith. Zline employs open, standardized cryptographic primitives executed directly inside your browser.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {securityPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="bg-white dark:bg-[#1a1717] rounded-2xl p-6 sm:p-8 border border-gray-200/80 dark:border-white/10 shadow-xs hover:border-emerald-500/50 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/40 mb-5">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {pillar.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Responsible Transparency Disclaimer Card */}
        <div className="mt-12 max-w-3xl mx-auto bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-gray-200/80 dark:border-zinc-800 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
            <FileCheck2 className="w-4 h-4 text-emerald-500" />
            <span>Our Transparency Commitment</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            We avoid exaggerated marketing claims of absolute invulnerability. Zline implements standard cryptographic algorithms (RSA-OAEP, AES-GCM, DTLS/SRTP) to safeguard your data against unauthorized interception while keeping our architecture transparent and verifiable.
          </p>
        </div>
      </div>
    </section>
  );
}

