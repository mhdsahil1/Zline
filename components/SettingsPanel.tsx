"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings, X, Shield, Bell, Palette, UserX, Lock, LogOut, Loader2,
  Eye, EyeOff, Volume2, VolumeX, Monitor, Moon, Sun, ChevronRight
} from "lucide-react";
import { signOut } from "next-auth/react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
}

export default function SettingsPanel({ isOpen, onClose, session }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
    setLoading(false);
  }, []);

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await fetch("/api/users/block");
      if (res.ok) {
        setBlockedUsers(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch blocked users:", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchBlocked();
      setActiveSection(null);
    }
  }, [isOpen, fetchSettings, fetchBlocked]);

  // Apply theme settings immediately
  useEffect(() => {
    if (!settings?.theme) return;
    const root = window.document.documentElement;
    const applyTheme = (theme: string) => {
      if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };
    applyTheme(settings.theme);

    if (settings.theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = (e: MediaQueryListEvent) => {
        if (e.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [settings?.theme]);

  const updateSetting = async (field: string, value: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error("Failed to update setting:", err);
    }
    setSaving(false);
  };

  const handleUnblock = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/block?userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBlockedUsers((prev) => prev.filter((u) => u._id !== userId));
      }
    } catch (err) {
      console.error("Failed to unblock:", err);
    }
  };

  if (!isOpen) return null;

  const ToggleSwitch = ({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!enabled)}
      disabled={saving}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 flex-shrink-0 ${
        enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-zinc-600"
      } ${saving ? "opacity-50" : ""}`}
    >
      <div
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      );
    }

    if (activeSection === "privacy") {
      return (
        <div className="py-2">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors">
            ← Back
          </button>
          <h4 className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Privacy</h4>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-900 dark:text-white">Read Receipts</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">Show when you&apos;ve read messages</p>
              </div>
            </div>
            <ToggleSwitch
              enabled={settings?.readReceipts ?? true}
              onChange={(v) => updateSetting("readReceipts", v)}
            />
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {settings?.lastSeenVisible ? <Eye className="w-4 h-4 text-gray-500" /> : <EyeOff className="w-4 h-4 text-gray-500" />}
              <div>
                <p className="text-sm text-gray-900 dark:text-white">Last Seen</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">Show your last seen time</p>
              </div>
            </div>
            <ToggleSwitch
              enabled={settings?.lastSeenVisible ?? true}
              onChange={(v) => updateSetting("lastSeenVisible", v)}
            />
          </div>
        </div>
      );
    }

    if (activeSection === "notifications") {
      return (
        <div className="py-2">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors">
            ← Back
          </button>
          <h4 className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Notifications</h4>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {settings?.notificationSound ? <Volume2 className="w-4 h-4 text-gray-500" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
              <div>
                <p className="text-sm text-gray-900 dark:text-white">Notification Sound</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">Play sounds for new messages</p>
              </div>
            </div>
            <ToggleSwitch
              enabled={settings?.notificationSound ?? true}
              onChange={(v) => updateSetting("notificationSound", v)}
            />
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-900 dark:text-white">Message Preview</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">Show message content in notifications</p>
              </div>
            </div>
            <ToggleSwitch
              enabled={settings?.notificationPreview ?? true}
              onChange={(v) => updateSetting("notificationPreview", v)}
            />
          </div>
        </div>
      );
    }

    if (activeSection === "appearance") {
      const themes = [
        { value: "system", label: "System", icon: Monitor },
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
      ];
      return (
        <div className="py-2">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors">
            ← Back
          </button>
          <h4 className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Appearance</h4>
          <div className="px-4 py-2 grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              const selected = (settings?.theme || "system") === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => updateSetting("theme", t.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-colors ${
                    selected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${selected ? "text-blue-600 dark:text-blue-400" : "text-gray-500"}`} />
                  <span className={`text-xs font-medium ${selected ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-zinc-300"}`}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeSection === "blocked") {
      return (
        <div className="py-2">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors">
            ← Back
          </button>
          <h4 className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Blocked Users</h4>
          {blockedUsers.length === 0 ? (
            <div className="text-center py-8 px-4">
              <UserX className="w-8 h-8 text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400 dark:text-zinc-500">No blocked users</p>
            </div>
          ) : (
            blockedUsers.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-gray-600 dark:text-zinc-400 font-bold text-xs">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(user._id)}
                  className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-[10px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>
      );
    }

    if (activeSection === "encryption") {
      const userId = session?.user?.id;
      const publicKeyJwk = typeof window !== "undefined" && userId
        ? localStorage.getItem(`zline_e2e_public_key_${userId}`)
        : null;

      // Generate a short fingerprint from the public key
      let fingerprint = "Not available";
      if (publicKeyJwk) {
        try {
          const hash = publicKeyJwk.slice(0, 64);
          fingerprint = hash.replace(/(.{4})/g, "$1 ").trim().toUpperCase().slice(0, 40);
        } catch {
          fingerprint = "Unable to generate";
        }
      }

      return (
        <div className="py-2">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors">
            ← Back
          </button>
          <h4 className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">End-to-End Encryption</h4>
          <div className="px-4 py-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">E2EE Active</span>
              </div>
              <p className="text-[10px] text-green-600 dark:text-green-400">
                Your messages are end-to-end encrypted. Only you and the recipient can read them.
              </p>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold uppercase tracking-wider mb-1">
              Your Public Key Fingerprint
            </p>
            <p className="text-xs font-mono text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 rounded-lg p-2 break-all">
              {fingerprint}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              Your private key is stored only on this device and is never sent to the server.
              If you clear browser data, your key will be regenerated and old encrypted messages may become unreadable.
            </p>
          </div>
        </div>
      );
    }

    // Main menu
    const menuItems = [
      { id: "privacy", label: "Privacy", icon: Shield, desc: "Read receipts, last seen" },
      { id: "notifications", label: "Notifications", icon: Bell, desc: "Sounds, previews" },
      { id: "appearance", label: "Appearance", icon: Palette, desc: "Theme settings" },
      { id: "blocked", label: "Blocked Users", icon: UserX, desc: `${blockedUsers.length} blocked` },
      { id: "encryption", label: "Encryption", icon: Lock, desc: "E2EE information" },
    ];

    return (
      <div className="py-2">
        {/* Profile Section */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-lg">
            {session?.user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{session?.user?.name}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{session?.user?.email}</p>
          </div>
        </div>

        {/* Menu */}
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4.5 h-4.5 text-gray-500 dark:text-zinc-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          );
        })}

        {/* Logout */}
        <div className="border-t border-gray-100 dark:border-zinc-800 mt-2 pt-2">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
