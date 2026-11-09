"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings, X, Shield, Bell, Palette, UserX, Lock, LogOut, Loader2,
  Eye, EyeOff, Volume2, VolumeX, Monitor, Moon, Sun, ChevronRight,
  Trash2, AlertTriangle, CheckCircle, Camera, Sparkles, Smartphone,
  Laptop, Tablet, Globe, QrCode, Edit3, CheckCircle2, RefreshCw, Key,
  SlidersHorizontal, Type, Columns
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useSocket } from "@/components/SocketProvider";
import UserAvatar from "@/components/UserAvatar";
import AvatarModal from "@/components/AvatarModal";
import { useTheme } from "@/components/ThemeProvider";
import SwitchButton from "@/components/SwitchButton";
import DevicePairingModal from "@/components/DevicePairingModal";
import { formatDistanceToNow } from "date-fns";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
}

export default function SettingsPanel({ isOpen, onClose, session }: SettingsPanelProps) {
  const { socket } = useSocket();
  const { theme: activeTheme, resolvedTheme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Delete account state
  const [authProviders, setAuthProviders] = useState<string[]>([]);
  const [deleteStep, setDeleteStep] = useState<"info" | "confirm">("info");
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Linked Devices states (v3.0 Multi-Device E2EE)
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [deviceToRename, setDeviceToRename] = useState<any | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [deviceToRevoke, setDeviceToRevoke] = useState<any | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [viewingFingerprint, setViewingFingerprint] = useState<any | null>(null);

  // Sizing & Density state
  const [chatFontSize, setChatFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [chatListDensity, setChatListDensity] = useState<"compact" | "normal" | "spacious">("normal");
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFontSize = localStorage.getItem("zline_chat_font_size") as "sm" | "md" | "lg" | "xl" | null;
      if (savedFontSize) setChatFontSize(savedFontSize);
      const savedDensity = localStorage.getItem("zline_chat_list_density") as "compact" | "normal" | "spacious" | null;
      if (savedDensity) setChatListDensity(savedDensity);
      const savedWidth = localStorage.getItem("zline_sidebar_width");
      if (savedWidth) setSidebarWidth(parseInt(savedWidth, 10) || 360);
    }
  }, [isOpen]);

  const handleUpdateFontSize = (size: "sm" | "md" | "lg" | "xl") => {
    setChatFontSize(size);
    try {
      localStorage.setItem("zline_chat_font_size", size);
      window.dispatchEvent(new CustomEvent("zline:chat_size_changed", { detail: { fontSize: size } }));
    } catch {}
  };

  const handleUpdateDensity = (density: "compact" | "normal" | "spacious") => {
    setChatListDensity(density);
    try {
      localStorage.setItem("zline_chat_list_density", density);
      window.dispatchEvent(new CustomEvent("zline:chat_size_changed", { detail: { density } }));
    } catch {}
  };

  const handleUpdateSidebarWidth = (width: number) => {
    setSidebarWidth(width);
    try {
      localStorage.setItem("zline_sidebar_width", width.toString());
      window.dispatchEvent(new CustomEvent("zline:chat_size_changed", { detail: { sidebarWidth: width } }));
    } catch {}
  };

  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const handleRenameDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceToRename || !renameInput.trim()) return;
    try {
      const res = await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceToRename.deviceId, deviceName: renameInput.trim() }),
      });
      if (res.ok) {
        setDeviceToRename(null);
        fetchDevices();
      }
    } catch (err) {
      console.error("Failed to rename device:", err);
    }
  };

  const handleRevokeDevice = async () => {
    if (!deviceToRevoke) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/devices?deviceId=${deviceToRevoke.deviceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (socket && socket.connected) {
          socket.emit("device_revoked", {
            deviceId: deviceToRevoke.deviceId,
            userId: session?.user?.id,
          });
        }
        setDeviceToRevoke(null);
        fetchDevices();
      }
    } catch (err) {
      console.error("Failed to revoke device:", err);
    } finally {
      setRevoking(false);
    }
  };

  useEffect(() => {
    const handleDevicesUpdated = () => {
      fetchDevices();
    };
    window.addEventListener("zline:devices_updated", handleDevicesUpdated);
    return () => window.removeEventListener("zline:devices_updated", handleDevicesUpdated);
  }, [fetchDevices]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
        setAuthProviders(data.authProviders || []);
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
      fetchDevices();
      setActiveSection(null);
      // Reset delete account state when panel opens
      setDeleteStep("info");
      setDeletePassword("");
      setConfirmText("");
      setDeleteLoading(false);
      setDeleteError("");
      setDeleteSuccess(false);
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
    if (field === "theme") {
      setTheme(value);
    }
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
          
          {/* Quick Toggle using Kokonut SwitchButton */}
          <div className="mx-4 mb-3 p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-200/80 dark:border-zinc-700/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Theme Switcher</p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-400">Click to switch theme with circular reveal</p>
            </div>
            <SwitchButton
              theme={resolvedTheme as "light" | "dark"}
              onThemeChange={(newTheme) => {
                setTheme(newTheme);
                updateSetting("theme", newTheme);
              }}
              showLabel={true}
              size="default"
            />
          </div>

          <div className="px-4 py-2 grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              const selected = (activeTheme || settings?.theme || "system") === t.value;
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

          {/* Chat Message Text Size */}
          <div className="mx-4 mt-4 p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-200/80 dark:border-zinc-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">Chat Message Size</p>
              </div>
              <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                {chatFontSize}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              Adjusts message bubble font size, reading spacing, and AI response scale.
            </p>
            <div className="grid grid-cols-4 gap-1 pt-1">
              {(["sm", "md", "lg", "xl"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleUpdateFontSize(s)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    chatFontSize === s
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50"
                  }`}
                >
                  {s === "sm" ? "Small" : s === "md" ? "Medium" : s === "lg" ? "Large" : "XL"}
                </button>
              ))}
            </div>
          </div>

          {/* Chat List Density */}
          <div className="mx-4 mt-3 p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-200/80 dark:border-zinc-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">Chat List Density</p>
              </div>
              <span className="text-[10px] capitalize font-bold text-purple-600 dark:text-purple-400 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 rounded-md">
                {chatListDensity}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              Scale conversation row height and avatar sizes in your chat list.
            </p>
            <div className="grid grid-cols-3 gap-1 pt-1">
              {(["compact", "normal", "spacious"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleUpdateDensity(d)}
                  className={`py-1.5 text-xs font-semibold capitalize rounded-lg border transition-all ${
                    chatListDensity === d
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Chat List Sidebar Width */}
          <div className="mx-4 mt-3 p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl border border-gray-200/80 dark:border-zinc-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Columns className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">Chat List Width (Desktop)</p>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                {sidebarWidth}px
              </span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              You can also click and drag the divider between the chat list and conversation view.
            </p>
            <input
              type="range"
              min={260}
              max={560}
              step={10}
              value={sidebarWidth}
              onChange={(e) => handleUpdateSidebarWidth(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex gap-1 pt-1">
              {[
                { label: "Compact", w: 280 },
                { label: "Default", w: 360 },
                { label: "Wide", w: 460 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleUpdateSidebarWidth(preset.w)}
                  className={`flex-1 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                    sidebarWidth === preset.w
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-semibold"
                      : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
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
                  <UserAvatar
                    image={user.image}
                    name={user.name}
                    className="w-8 h-8"
                    textClassName="text-xs"
                  />
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

    if (activeSection === "devices") {
      const currentDevId = typeof window !== "undefined" && session?.user?.id
        ? localStorage.getItem(`zline_device_id_${session.user.id}`)
        : null;

      return (
        <div className="py-2">
          <button
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors cursor-pointer"
          >
            ← Back
          </button>

          <div className="px-4 py-2 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Linked Devices
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                Independent E2EE v3.0 identities
              </p>
            </div>
            <button
              onClick={() => setShowPairingModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Link Device</span>
            </button>
          </div>

          <div className="px-4 py-2">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 text-[11px] text-blue-700 dark:text-blue-300">
              Each device holds its own isolated private key. Messages are multi-encrypted for all active devices.
            </div>
          </div>

          <div className="px-4 py-1 divide-y divide-gray-100 dark:divide-zinc-800">
            {devicesLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">Loading authorized devices...</span>
              </div>
            ) : devices.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No linked devices found.
              </div>
            ) : (
              devices.map((dev: any) => {
                const isCurrent = dev.deviceId === currentDevId;
                let DeviceIcon = Globe;
                if (dev.deviceType === "laptop") DeviceIcon = Laptop;
                else if (dev.deviceType === "desktop") DeviceIcon = Monitor;
                else if (dev.deviceType === "mobile") DeviceIcon = Smartphone;
                else if (dev.deviceType === "tablet") DeviceIcon = Tablet;

                return (
                  <div key={dev.deviceId} className="py-3 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${isCurrent ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                        <DeviceIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {dev.deviceName}
                          </p>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                              This Device
                            </span>
                          )}
                          {dev.isVerified && !dev.isRevoked && (
                            <span className="px-1.5 py-0.2 rounded-md bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[9px] font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                            </span>
                          )}
                          {dev.isRevoked && (
                            <span className="px-1.5 py-0.2 rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[9px] font-bold">
                              Revoked
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                          Active: {formatDistanceToNow(new Date(dev.lastActiveAt), { addSuffix: true })}
                        </p>
                        <p className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 truncate mt-0.5" title={dev.fingerprint}>
                          FP: {dev.fingerprint ? dev.fingerprint.substring(0, 19) + "..." : "Available"}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingFingerprint(dev)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        title="View Full Cryptographic Fingerprint"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceToRename(dev);
                          setRenameInput(dev.deviceName);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Rename Device"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {!dev.isRevoked && (
                        <button
                          type="button"
                          onClick={() => setDeviceToRevoke(dev)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Revoke Device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rename Device Modal */}
          {deviceToRename && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <form onSubmit={handleRenameDevice} className="w-full max-w-xs bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-xl space-y-4 border border-gray-100 dark:border-zinc-800">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Rename Device</h4>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeviceToRename(null)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Revoke Device Confirmation Modal */}
          {deviceToRevoke && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-sm bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-xl space-y-3 border border-gray-100 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-center text-gray-900 dark:text-white">
                  Revoke Device Authorization?
                </h4>
                <p className="text-xs text-center text-gray-500 dark:text-zinc-400">
                  Are you sure you want to unlink <strong>{deviceToRevoke.deviceName}</strong>? It will immediately lose access, be disconnected from active sessions, and be excluded from all future encrypted messages.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={revoking}
                    onClick={() => setDeviceToRevoke(null)}
                    className="flex-1 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={revoking}
                    onClick={handleRevokeDevice}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Revoke Access"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Fingerprint Modal */}
          {viewingFingerprint && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-sm bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-xl space-y-4 border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    <span>Cryptographic Fingerprint</span>
                  </h4>
                  <button
                    onClick={() => setViewingFingerprint(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">
                    Device: <strong>{viewingFingerprint.deviceName}</strong> ({viewingFingerprint.deviceType})
                  </p>
                  <p className="text-[11px] font-mono p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white leading-relaxed break-all select-all">
                    {viewingFingerprint.fingerprint}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                  This SHA-256 fingerprint uniquely authenticates this device's RSA-OAEP public key. Verify it against the fingerprint displayed on the device itself to prevent key substitution.
                </p>
                <button
                  type="button"
                  onClick={() => setViewingFingerprint(null)}
                  className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Pairing Modal */}
          <DevicePairingModal
            isOpen={showPairingModal}
            onClose={() => setShowPairingModal(false)}
            isApprovingDevice={true}
            currentUserSession={session}
            onDeviceApproved={fetchDevices}
          />
        </div>
      );
    }

    if (activeSection === "encryption") {
      const userId = session?.user?.id;
      const localFp = typeof window !== "undefined" && userId
        ? localStorage.getItem(`zline_device_fingerprint_${userId}`)
        : null;

      return (
        <div className="py-2">
          <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors cursor-pointer">
            ← Back
          </button>
          <h4 className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">End-to-End Encryption</h4>
          <div className="px-4 py-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">E2EE v3.0 Multi-Device Active</span>
              </div>
              <p className="text-[10px] text-green-600 dark:text-green-400">
                Your messages are encrypted end-to-end with AES-256-GCM. Independent 2048-bit RSA keys wrap the message key for each of your authorized devices.
              </p>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold uppercase tracking-wider mb-1">
              Current Device Fingerprint (SHA-256)
            </p>
            <p className="text-xs font-mono text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 rounded-lg p-2.5 break-all select-all">
              {localFp || "SHA-256 Verified"}
            </p>
          </div>
          <div className="px-4 py-2">
            <button
              onClick={() => setActiveSection("devices")}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold text-gray-800 dark:text-zinc-200"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Manage Linked Devices ({devices.length})</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              Private keys are stored securely in local browser IndexedDB and are never transmitted to the server.
            </p>
          </div>
        </div>
      );
    }

    if (activeSection === "deleteAccount") {
      // Determine auth method: if user has a password, require it.
      // If Google-only, session is proof of identity.
      const hasPassword = authProviders.includes("credentials");
      const hasGoogle = authProviders.includes("google");
      // Prefer password re-auth if available, otherwise accept Google session
      const requiresPassword = hasPassword;

      const handleDeleteAccount = async () => {
        setDeleteError("");
        setDeleteLoading(true);

        try {
          const res = await fetch("/api/users/delete-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              password: requiresPassword ? deletePassword : undefined,
              provider: requiresPassword ? "credentials" : "google",
              confirmText,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            setDeleteError(data.message || "Failed to delete account.");
            setDeleteLoading(false);
            return;
          }

          setDeleteSuccess(true);

          // Signal socket server to handle cleanup (calls, multi-device, etc.)
          if (socket) {
            socket.emit("account_deleted");
          }

          // Clean up local E2EE keys
          if (session?.user?.id) {
            try {
              localStorage.removeItem(`zline_e2e_public_key_${session.user.id}`);
              localStorage.removeItem(`zline_e2e_private_key_${session.user.id}`);
            } catch {
              // localStorage may not be available
            }
          }

          // Wait briefly for the user to see the success state, then logout
          setTimeout(() => {
            signOut({ callbackUrl: "/login" });
          }, 2000);
        } catch (err) {
          setDeleteError("Something went wrong. Please try again.");
          setDeleteLoading(false);
        }
      };

      // Success state
      if (deleteSuccess) {
        return (
          <div className="py-2">
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Account Deleted</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400 text-center">
                Your account has been deleted. You will be logged out shortly.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="py-2">
          <button
            onClick={() => {
              setActiveSection(null);
              setDeleteStep("info");
              setDeletePassword("");
              setConfirmText("");
              setDeleteError("");
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-blue-600 transition-colors"
          >
            ← Back
          </button>
          <h4 className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
            Delete Account
          </h4>

          {/* Warning Banner */}
          <div className="px-4 py-3">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-900/50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">This action is permanent</span>
              </div>
              <ul className="text-[10px] text-red-600 dark:text-red-400 space-y-1 ml-6 list-disc">
                <li>Your profile will be anonymized</li>
                <li>You will not be able to log in again</li>
                <li>Your messages will remain but show as &ldquo;Deleted User&rdquo;</li>
                <li>Active calls will be ended immediately</li>
                <li>All devices will be logged out</li>
              </ul>
            </div>
          </div>

          {deleteError && (
            <div className="px-4 py-2">
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3">
                <p className="text-xs text-red-800 dark:text-red-400">{deleteError}</p>
              </div>
            </div>
          )}

          {deleteStep === "info" && (
            <div className="px-4 py-3 space-y-4">
              {/* Re-authentication */}
              {requiresPassword ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                    Enter your password to continue
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-xl border-0 py-2.5 px-3.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                  />
                </div>
              ) : hasGoogle ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-900/50">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    You&apos;re signed in with Google. Your current session will be used to verify your identity.
                  </p>
                </div>
              ) : null}

              <button
                onClick={() => {
                  if (requiresPassword && !deletePassword.trim()) {
                    setDeleteError("Please enter your password.");
                    return;
                  }
                  setDeleteError("");
                  setDeleteStep("confirm");
                }}
                disabled={requiresPassword && !deletePassword.trim()}
                className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {deleteStep === "confirm" && (
            <div className="px-4 py-3 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                  Type <span className="font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Type DELETE here"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full rounded-xl border-0 py-2.5 px-3.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDeleteStep("info");
                    setConfirmText("");
                    setDeleteError("");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleteLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete My Account"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Main menu
    const menuItems = [
      { id: "devices", label: "Linked Devices", icon: Smartphone, desc: `${devices.length} active • E2EE v3.0` },
      { id: "privacy", label: "Privacy", icon: Shield, desc: "Read receipts, last seen" },
      { id: "notifications", label: "Notifications", icon: Bell, desc: "Sounds, previews" },
      { id: "appearance", label: "Appearance", icon: Palette, desc: "Theme settings" },
      { id: "blocked", label: "Blocked Users", icon: UserX, desc: `${blockedUsers.length} blocked` },
      { id: "encryption", label: "Encryption", icon: Lock, desc: "Key fingerprints & status" },
    ];

    return (
      <div className="py-2">
        {/* Profile Section */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="relative group cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shrink-0"
              title="Change avatar"
            >
              <UserAvatar
                image={session?.user?.image}
                name={session?.user?.name}
                className="w-12 h-12"
                textClassName="text-lg"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-4 h-4" />
              </div>
            </button>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{session?.user?.name}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAvatarModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Change</span>
          </button>
        </div>

        {/* Quick Theme Switcher Item */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Palette className="w-4.5 h-4.5 text-gray-500 dark:text-zinc-400" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Theme</p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 capitalize">{resolvedTheme} mode</p>
            </div>
          </div>
          <SwitchButton
            theme={resolvedTheme as "light" | "dark"}
            onThemeChange={(newTheme) => {
              setTheme(newTheme);
              updateSetting("theme", newTheme);
            }}
            showLabel={true}
            size="sm"
          />
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

        {/* Delete Account */}
        <div className="border-t border-gray-100 dark:border-zinc-800 pt-1">
          <button
            onClick={() => setActiveSection("deleteAccount")}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500 dark:text-red-500"
          >
            <Trash2 className="w-4.5 h-4.5" />
            <div className="text-left">
              <span className="text-sm font-medium">Delete Account</span>
              <p className="text-[10px] text-red-400 dark:text-red-600">Permanently delete your account</p>
            </div>
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

      <AvatarModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        initialName={session?.user?.name}
      />
    </div>
  );
}
