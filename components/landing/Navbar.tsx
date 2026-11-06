"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { Menu, X, ArrowRight, MessageSquare, Shield, Sparkles, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function Navbar() {
  const { data: session, status } = useSession();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Features", href: "#features" },
    { name: "Product", href: "#product" },
    { name: "Security", href: "#security" },
    { name: "About", href: "#about" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "bg-white/90 dark:bg-[#121010]/90 backdrop-blur-md border-b border-gray-200/80 dark:border-white/10 shadow-xs"
          : "bg-white/60 dark:bg-[#121010]/60 backdrop-blur-xs border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Left: Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg p-1"
            aria-label="Zline Homepage"
          >
            <Logo className="h-8 sm:h-9 w-auto" />
          </Link>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-zinc-300">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="hover:text-blue-600 dark:hover:text-white transition-colors duration-150 py-1"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
              aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-gray-700" />
              )}
            </button>

            {status === "authenticated" ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs text-gray-700 dark:text-zinc-200">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="max-w-[120px] truncate font-medium">
                    {session?.user?.name || "User"}
                  </span>
                </div>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs hover:shadow-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Open App</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:text-gray-900 dark:hover:text-white transition-colors duration-150 rounded-xl"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs hover:shadow-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Right: Theme Toggle & Menu Button */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 focus:outline-hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#121010]/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-base font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </nav>

          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex flex-col gap-2.5">
            {status === "authenticated" ? (
              <Link
                href="/chat"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-base shadow-xs"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Open Zline Chat</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-base shadow-xs"
                >
                  <span>Get Started — Free</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 font-medium text-base hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

