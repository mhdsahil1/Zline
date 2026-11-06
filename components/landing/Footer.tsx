import Link from "next/link";
import Logo from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-[#121010] border-t border-gray-200/80 dark:border-white/10 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 pb-12 border-b border-gray-100 dark:border-zinc-800">
          {/* Brand Col */}
          <div className="md:col-span-6 space-y-4">
            <Link href="/" className="inline-block" aria-label="Zline Homepage">
              <Logo className="h-8 w-auto" />
            </Link>
            <p className="text-sm text-gray-600 dark:text-zinc-400 max-w-sm leading-relaxed">
              Fast, secure real-time messaging, HD WebRTC calling, and client-side encryption right in your browser.
            </p>
            <div className="text-xs text-gray-400 dark:text-zinc-500">
              Built on WebSockets, WebRTC, and the W3C Web Cryptography API.
            </div>
          </div>

          {/* Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              Platform
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-zinc-400">
              <li>
                <a href="#features" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#product" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Product Preview
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Security & Encryption
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  About Zline
                </a>
              </li>
            </ul>
          </div>

          {/* Account Links */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              Access
            </div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-zinc-400">
              <li>
                <Link href="/chat" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Open Web App
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-zinc-500">
          <div>
            © {new Date().getFullYear()} Zline. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

