"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback, Fragment } from "react";
import { useSocket } from "@/components/SocketProvider";
import {
  MessageCircle, Send, Loader2, Check, CheckCheck,
  Search, ArrowLeft, Plus, X, Paperclip, Download, FileText,
  Phone, Video, BarChart2, ChevronRight, CheckCircle2, SmilePlus,
  Image as ImageIcon, Music, Film, Code2, Archive, File, Users,
  PhoneCall, PhoneMissed, PhoneIncoming, PhoneOutgoing, MessageSquare,
  Pin, Star, Settings, User, UserX, RotateCcw, Globe,
  SlidersHorizontal, Type, Columns, Clock, Sparkles, Languages, Copy
} from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import CallModal from "@/components/CallModal";
import GroupCallModal from "@/components/GroupCallModal";
import Logo from "@/components/Logo";
import {
  getOrCreateLocalDevice,
  getStoredLocalDevice,
  encryptMultiRecipientMessage,
  decryptMultiRecipientMessage,
  type LocalDeviceIdentity,
  type RecipientDeviceTarget,
} from "@/lib/crypto";

// Import custom components for the 7 features
import MessageActions from "@/components/MessageActions";
import ReplyPreview from "@/components/ReplyPreview";
import VoicePlayer from "@/components/VoicePlayer";
import VoiceRecorder from "@/components/VoiceRecorder";
import ChatSearch from "@/components/ChatSearch";
import PinnedMessages from "@/components/PinnedMessages";
import StarredMessages from "@/components/StarredMessages";
import SettingsPanel from "@/components/SettingsPanel";
import UserAvatar from "@/components/UserAvatar";
import AvatarModal from "@/components/AvatarModal";
import SourceCitations from "@/components/SourceCitations";
import ProfileDropdown, { type AccountTheme } from "@/components/ProfileDropdown";
import { useTheme } from "@/components/ThemeProvider";
import LoadingAnimation, { OrbLoading } from "@/components/LoadingAnimation";
import AiIcon from "@/components/AiIcon";
import LinkPreviewCard from "@/components/LinkPreviewCard";

function formatChatTime(date: string | Date) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yy");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const AI_CHAT_ID = "zline_ai_assistant";
const MAX_TOTAL_FILES_BYTES = 50 * 1024 * 1024; // 50MB per selection limit

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
}

const TIMER_OPTIONS = [
  { label: "1 hour", seconds: 3600, short: "1h", description: "Quick ephemeral chats" },
  { label: "6 hours", seconds: 21600, short: "6h", description: "Half-day retention" },
  { label: "12 hours", seconds: 43200, short: "12h", description: "Same-day retention" },
  { label: "24 hours (1 day)", seconds: 86400, short: "24h", description: "Daily clean sweep" },
  { label: "3 days", seconds: 259200, short: "3d", description: "Short-term storage" },
  { label: "7 days (Max retention)", seconds: 604800, short: "7d", description: "Default maximum storage lifecycle" },
];

function formatTimerLabel(seconds?: number) {
  if (!seconds || seconds >= 604800) return "7d";
  if (seconds >= 259200) return "3d";
  if (seconds >= 86400) return "24h";
  if (seconds >= 43200) return "12h";
  if (seconds >= 21600) return "6h";
  if (seconds >= 3600) return "1h";
  return `${Math.round(seconds / 3600)}h`;
}

function getFirstUrl(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/(https?:\/\/[^\s]+)/);
  return match ? match[1] : null;
}

function renderTextWithLinks(text: string, isMe: boolean) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline break-all font-medium transition-colors ${
            isMe
              ? "text-blue-100 hover:text-white decoration-blue-200"
              : "text-blue-600 dark:text-blue-400 hover:underline decoration-blue-400"
          }`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function FormattedAiContent({ content, fontSize = "md" }: { content: string; fontSize?: "sm" | "md" | "lg" | "xl" }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  const sizeClasses = {
    sm: "text-xs space-y-1.5",
    md: "text-sm space-y-2",
    lg: "text-base space-y-2.5",
    xl: "text-lg space-y-3",
  }[fontSize] || "text-sm space-y-2";

  return (
    <div className={`${sizeClasses} leading-relaxed break-words min-w-0`}>
      {parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const firstLineEnd = part.indexOf("\n");
          const lang = firstLineEnd !== -1 ? part.slice(3, firstLineEnd).trim() : "";
          const code = firstLineEnd !== -1 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);
          return (
            <div key={idx} className="my-2 rounded-lg bg-zinc-900 text-zinc-100 dark:bg-black/90 p-3 font-mono text-xs overflow-x-auto border border-zinc-800">
              {lang && <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 font-semibold">{lang}</div>}
              <pre className="whitespace-pre overflow-x-auto">{code}</pre>
            </div>
          );
        }

        const lines = part.split("\n");
        return (
          <div key={idx} className="space-y-1">
            {lines.map((line, lIdx) => {
              if (!line.trim()) return <div key={lIdx} className="h-1.5" />;
              
              const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ");
              const cleanedLine = isBullet ? line.trim().slice(2) : line;
              const segments = cleanedLine.split(/(\*\*.*?\*\*|`.*?`|\[\d+\])/g);

              return (
                <p key={lIdx} className={`break-words ${isBullet ? "flex items-start gap-1.5 pl-2" : ""}`}>
                  {isBullet && <span className="text-indigo-500 font-bold shrink-0">•</span>}
                  <span>
                    {segments.map((seg, sIdx) => {
                      if (seg.startsWith("**") && seg.endsWith("**")) {
                        return <strong key={sIdx} className="font-semibold text-gray-900 dark:text-white">{seg.slice(2, -2)}</strong>;
                      }
                      if (seg.startsWith("`") && seg.endsWith("`")) {
                        return <code key={sIdx} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700/60 font-mono text-xs text-indigo-600 dark:text-indigo-300">{seg.slice(1, -1)}</code>;
                      }
                      if (/^\[\d+\]$/.test(seg)) {
                        return (
                          <sup
                            key={sIdx}
                            className="inline-flex items-center justify-center px-1 py-0.5 mx-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-mono text-[10px] font-bold select-none cursor-default"
                            title={`Source Citation ${seg}`}
                          >
                            {seg}
                          </sup>
                        );
                      }
                      return seg;
                    })}
                  </span>
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const { socket } = useSocket();

  // Register Service Worker and subscribe to Push notifications
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    const registerPush = async () => {
      try {
        const register = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log("Service Worker registered successfully:", register);

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.warn("VAPID public key not found in env");
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("Notification permission denied");
          return;
        }

        let subscription = await register.pushManager.getSubscription();
        if (!subscription) {
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
          subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }

        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });
        console.log("Push subscription saved successfully");
      } catch (err) {
        console.error("Service Worker/Push subscription registration failed:", err);
      }
    };

    registerPush();
  }, []);

  // Sidebar state
  const [chats, setChats] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "calls">("chats");
  const [calls, setCalls] = useState<any[]>([]);
  const [callsSearchQuery, setCallsSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{users: any[], messages: any[]}>({ users: [], messages: [] });
  const [searchLoading, setSearchLoading] = useState(false);

  // Mobile navigation — "sidebar" shows list, "chat" shows conversation
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");

  // Chat state
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  // Media & voice state
  const [isUploading, setIsUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll state
  const [showPollForm, setShowPollForm] = useState(false);

  // Avatar modal & onboarding state
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isAvatarOnboarding, setIsAvatarOnboarding] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollLoading, setPollLoading] = useState(false);

  // Attachment menu
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Local chat search state
  const [localSearchMode, setLocalSearchMode] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  // Reaction state
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // File sharing enhanced states (multiple files, max 50MB per selection)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  // Group creation states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);

  // E2EE States
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [localDevice, setLocalDevice] = useState<LocalDeviceIdentity | null>(null);
  const [targetRecipientDevices, setTargetRecipientDevices] = useState<RecipientDeviceTarget[]>([]);

  // New features states
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [activeMessageActionId, setActiveMessageActionId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showStarredPanel, setShowStarredPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [starredMessageIds, setStarredMessageIds] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  // Disappearing messages & chat export states
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerLoading, setTimerLoading] = useState(false);

  // Catch Me Up AI briefing states
  const [showCatchMeUpModal, setShowCatchMeUpModal] = useState(false);
  const [catchMeUpLoading, setCatchMeUpLoading] = useState(false);
  const [catchMeUpSummary, setCatchMeUpSummary] = useState<string>("");
  const [catchMeUpCopied, setCatchMeUpCopied] = useState(false);

  // Inline translation state
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, { text: string; loading?: boolean; error?: string }>>({});

  // Layout & Sizing customization (Chat Size & Chat List Size)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const savedWidth = localStorage.getItem("zline_sidebar_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 650) {
          return parsed;
        }
      }
    }
    return 360;
  });
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const [chatFontSize, setChatFontSize] = useState<"sm" | "md" | "lg" | "xl">(() => {
    if (typeof window !== "undefined") {
      const savedFontSize = localStorage.getItem("zline_chat_font_size") as "sm" | "md" | "lg" | "xl" | null;
      if (savedFontSize && ["sm", "md", "lg", "xl"].includes(savedFontSize)) {
        return savedFontSize;
      }
    }
    return "md";
  });
  const [chatListDensity, setChatListDensity] = useState<"compact" | "normal" | "spacious">(() => {
    if (typeof window !== "undefined") {
      const savedDensity = localStorage.getItem("zline_chat_list_density") as "compact" | "normal" | "spacious" | null;
      if (savedDensity && ["compact", "normal", "spacious"].includes(savedDensity)) {
        return savedDensity;
      }
    }
    return "normal";
  });
  const [showSizeControls, setShowSizeControls] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const check = () => setIsDesktop(window.innerWidth >= 768);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }
  }, []);

  // Sync size changes from Settings or other components
  useEffect(() => {
    const handleSizeChanged = (e: any) => {
      if (e?.detail?.fontSize) setChatFontSize(e.detail.fontSize);
      if (e?.detail?.density) setChatListDensity(e.detail.density);
      if (e?.detail?.sidebarWidth) setSidebarWidth(e.detail.sidebarWidth);
    };
    window.addEventListener("zline:chat_size_changed", handleSizeChanged);
    return () => window.removeEventListener("zline:chat_size_changed", handleSizeChanged);
  }, []);

  // Draggable sidebar resizing logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const maxAllowed = Math.min(window.innerWidth * 0.55, 620);
      const newWidth = Math.min(Math.max(e.clientX, 260), maxAllowed);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setSidebarWidth((w) => {
          try {
            localStorage.setItem("zline_sidebar_width", w.toString());
          } catch {}
          return w;
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Zline AI Assistant states
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiLatestMessage, setAiLatestMessage] = useState<{ content: string; createdAt: string } | null>(null);
  const [aiSearchMode, setAiSearchMode] = useState<"auto" | "always" | "off">(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("zline_ai_search_mode") as "auto" | "always" | "off" | null;
      if (savedMode === "auto" || savedMode === "always" || savedMode === "off") {
        return savedMode;
      }
    }
    return "auto";
  });
  const [aiSearchStatus, setAiSearchStatus] = useState<{
    stage: "idle" | "searching" | "finding" | "browsing" | "extracting" | "analyzing" | "reasoning" | "generating";
    query?: string;
    sourceCount?: number;
    url?: string;
    siteName?: string;
  }>({ stage: "idle" });

  // Refs for message elements for scrolling
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Load or generate E2EE keys (v3.0 Multi-Device Identity)
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    const setupE2EKeys = async () => {
      try {
        const dev = await getOrCreateLocalDevice(session.user.id);
        setLocalDevice(dev);

        // Register device with /api/devices
        await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: dev.deviceId,
            deviceName: dev.deviceName,
            deviceType: dev.deviceType,
            publicKey: dev.publicKeyJwk,
            fingerprint: dev.fingerprint,
          }),
        });

        // Sync legacy /api/keys for backwards compatibility
        await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: dev.publicKeyJwk }),
        });

        if (socket && socket.connected) {
          socket.emit("join_device", { deviceId: dev.deviceId, userId: session.user.id });
        }
        console.log("Zline v3.0 device initialized:", dev.deviceId, dev.fingerprint);
      } catch (err) {
        console.error("Failed to setup E2EE device keys:", err);
      }
    };

    setupE2EKeys();
  }, [status, session?.user?.id, socket]);

  // Fetch active device public keys for all recipients when selected chat changes
  useEffect(() => {
    if (selectedChat?.isAi) {
      setRecipientPublicKey(null);
      setTargetRecipientDevices([]);
      return;
    }

    if (!selectedChat || !session?.user?.id) {
      setRecipientPublicKey(null);
      setTargetRecipientDevices([]);
      return;
    }

    // Determine target user IDs
    let targetUserIds: string[] = [];
    if (selectedChat.isGroup && Array.isArray(selectedChat.users)) {
      targetUserIds = selectedChat.users
        .map((u: any) => (typeof u === "object" ? u._id : u))
        .filter((uid: string) => uid && uid !== session.user.id);
    } else if (selectedChat.otherUser?._id) {
      targetUserIds = [selectedChat.otherUser._id];
    }

    if (targetUserIds.length === 0) {
      setRecipientPublicKey(null);
      setTargetRecipientDevices([]);
      return;
    }

    fetch(`/api/devices/keys?userIds=${targetUserIds.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.devices && Array.isArray(data.devices)) {
          const currentDevId = localDevice?.deviceId;
          // Filter to only other devices (not current sender device)
          const validTargets: RecipientDeviceTarget[] = data.devices
            .filter((d: any) => d.deviceId !== currentDevId)
            .map((d: any) => ({
              deviceId: d.deviceId,
              userId: typeof d.userId === "object" ? d.userId._id || d.userId : d.userId,
              publicKey: d.publicKey,
            }));
          setTargetRecipientDevices(validTargets);

          // For backwards compatibility indicator
          const firstOther = validTargets.find((d) => d.userId !== session.user.id);
          setRecipientPublicKey(firstOther?.publicKey || null);
        }
      })
      .catch((err) => console.error("Error fetching device public keys:", err));
  }, [
    selectedChat,
    session?.user?.id,
    localDevice?.deviceId,
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom helper — declared early so it is accessible across all effects & handlers
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    // Scroll the messages container vertically directly to avoid any document-level horizontal shift
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end", inline: "nearest" });
    }
  }, []);

  // Refs to always have the latest values inside stable socket listeners
  const selectedChatRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const fetchChatsRef = useRef<() => void>(() => {});
  const fetchCallsRef = useRef<() => void>(() => {});

  // Keep refs in sync with latest state/session
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Auth redirect
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Fetch settings, blocked users, and starred messages on load
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      // 1. Settings
      fetch("/api/users/settings")
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data) => {
          if (data?.settings?.theme) {
            setTheme(data.settings.theme);
          }
        })
        .catch((err) => console.error("Error fetching settings:", err));

      // 2. Blocked Users
      fetch("/api/users/block")
        .then((res) => {
          if (res.ok) return res.json();
          return [];
        })
        .then((data) => {
          if (Array.isArray(data)) setBlockedUsers(data.map((u: any) => u._id));
        })
        .catch((err) => console.error("Error fetching blocked users:", err));

      // 3. Starred Messages
      fetch("/api/messages/star")
        .then((res) => {
          if (res.ok) return res.json();
          return [];
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setStarredMessageIds(data.map((item: any) => item.messageId?._id).filter(Boolean));
          }
        })
        .catch((err) => console.error("Error fetching starred messages:", err));
    }
  }, [status, session?.user?.id, setTheme]);

  // Scroll to a specific message and flash highlight it
  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-4", "ring-yellow-400", "transition-all", "duration-500");
      setTimeout(() => {
        el.classList.remove("ring-4", "ring-yellow-400");
      }, 2000);
    }
  }, []);

  // Decrypts an array of messages using v3.0 Multi-Device E2EE
  const decryptMessagesArray = useCallback(async (msgs: any[]) => {
    if (typeof window === "undefined") return msgs;
    if (!session?.user?.id) return msgs;

    let device = localDevice;
    if (!device) {
      device = await getStoredLocalDevice(session.user.id);
      if (device) setLocalDevice(device);
    }
    if (!device) return msgs;

    return await Promise.all(
      msgs.map(async (m) => {
        if (m.isEncrypted && m.iv) {
          try {
            const senderId = typeof m.sender === "object" && m.sender !== null ? m.sender._id : m.sender;
            const isSender = senderId === session.user.id;

            const plaintext = await decryptMultiRecipientMessage(
              m.content,
              m.iv,
              m.keyEnvelopes,
              device.deviceId,
              device.privateKeyJwk,
              {
                encAesKey: m.encAesKey,
                encAesKeyForSender: m.encAesKeyForSender,
                isSender,
              }
            );
            return { ...m, content: plaintext };
          } catch (err: any) {
            console.error("Failed to decrypt message:", m._id, err?.code || err);
            if (err?.code === "NO_ENVELOPE_FOR_DEVICE") {
              return { ...m, content: "🔒 Message encrypted for other devices" };
            }
            return { ...m, content: "🔒 Decryption failed" };
          }
        }
        return m;
      })
    );
  }, [session?.user?.id, localDevice]);

  // Fetch recent chats
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();

        // Extract all latestMessages that exist and are encrypted
        const messagesToDecrypt = data
          .map((c: any) => c.latestMessage)
          .filter((m: any) => m && m.isEncrypted);

        if (messagesToDecrypt.length > 0) {
          try {
            const decryptedMessages = await decryptMessagesArray(messagesToDecrypt);
            const decryptedMap = new Map(decryptedMessages.map((m: any) => [m._id, m]));
            data.forEach((c: any) => {
              if (c.latestMessage && decryptedMap.has(c.latestMessage._id)) {
                c.latestMessage = decryptedMap.get(c.latestMessage._id);
              }
            });
          } catch (decryptErr) {
            console.error("Failed to decrypt latest messages:", decryptErr);
          }
        }

        setChats(data);
      }
    } catch {
      console.error("Failed to fetch chats");
    }
  }, [decryptMessagesArray]);

  // Keep fetchChatsRef in sync
  useEffect(() => { fetchChatsRef.current = fetchChats; }, [fetchChats]);

  useEffect(() => {
    if (session?.user?.id) fetchChats();
  }, [session, fetchChats]);

  // Fetch call history
  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/calls");
      if (res.ok) {
        setCalls(await res.json());
      }
    } catch {
      console.error("Failed to fetch calls");
    }
  }, []);

  // Keep fetchCallsRef in sync
  useEffect(() => { fetchCallsRef.current = fetchCalls; }, [fetchCalls]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchCalls();
    }
  }, [session?.user?.id, fetchCalls]);

  // Search globally (users + messages)
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) { setSearchResults({ users: [], messages: [] }); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { console.error("Search failed"); }
      setSearchLoading(false);
    }, 300);
  };

  // Start or open a chat with a user
  const openChatWithUser = async (user: any) => {
    if (user._id === AI_CHAT_ID) {
      openAiChat();
      return;
    }
    // Check if chat already exists in our list
    const existing = chats.find(
      (c) => !c.isGroup && c.otherUser?._id === user._id
    );
    if (existing) {
      setSelectedChat(existing);
    } else {
      // Create a temporary chat object
      setSelectedChat({
        _id: null,
        isGroup: false,
        chatName: user.name,
        chatInitial: user.name.charAt(0).toUpperCase(),
        isOnline: user.isOnline,
        otherUser: user,
        latestMessage: null,
        unreadCount: 0,
      });
    }
    setMobileView("chat");
    setSearchMode(false);
    setSearchQuery("");
    setSearchResults({ users: [], messages: [] });
    setLocalSearchMode(false);
    setLocalSearchQuery("");
  };

  // Jump to a specific chat and highlight message (from global search)
  const jumpToMessage = (messageObj: any) => {
    // Find the chat locally
    const chatObj = chats.find(c => c._id === messageObj.chat?._id);
    if (chatObj) {
      setSelectedChat(chatObj);
      setMobileView("chat");
      setLocalSearchMode(true);
      setLocalSearchQuery(searchQuery);
      setSearchMode(false);
      setSearchQuery("");
      setSearchResults({ users: [], messages: [] });
    }
  };

  // Fetch messages for selected chat
  const fetchMessages = useCallback(async (receiverId: string | null, chatId?: string | null) => {
    if (receiverId === AI_CHAT_ID || chatId === AI_CHAT_ID) return;
    try {
      const query = chatId ? `chatId=${chatId}` : `receiverId=${receiverId}`;
      const res = await fetch(`/api/messages?${query}`);
      if (res.ok) {
        const rawMsgs = await res.json();
        const decrypted = await decryptMessagesArray(rawMsgs);
        setMessages(decrypted);
        scrollToBottom();
        if (socket) {
          if (chatId) {
            socket.emit("mark_seen", { chatId, receiverId: session?.user?.id });
          } else if (receiverId) {
            socket.emit("mark_seen", { senderId: receiverId, receiverId: session?.user?.id });
          }
        }
        // Clear unread in sidebar
        setChats((prev) =>
          prev.map((c) => {
            if (chatId && c._id === chatId) {
              return { ...c, unreadCount: 0 };
            } else if (!chatId && c.otherUser?._id === receiverId) {
              return { ...c, unreadCount: 0 };
            }
            return c;
          })
        );
      }
    } catch { console.error("Failed to fetch messages"); }
  }, [socket, session, decryptMessagesArray, scrollToBottom]);

  useEffect(() => {
    if (selectedChat?.isAi) return;
    if (selectedChat?.isGroup && selectedChat?._id) {
      fetchMessages(null, selectedChat._id);
    } else if (selectedChat?.otherUser?._id) {
      fetchMessages(selectedChat.otherUser._id, null);
    }
  }, [selectedChat?._id, selectedChat?.isGroup, selectedChat?.otherUser?._id, selectedChat?.isAi, fetchMessages]);

  // Load saved AI latest message on session auth
  useEffect(() => {
    if (session?.user?.id && typeof window !== "undefined") {
      const saved = localStorage.getItem(`zline_ai_messages_${session.user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const last = parsed[parsed.length - 1];
            setAiLatestMessage({
              content: last.content,
              createdAt: last.createdAt || new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error("Failed to parse saved AI messages:", e);
        }
      }
    }
  }, [session?.user?.id]);

  // Load active AI conversation when selectedChat is AI
  useEffect(() => {
    if (!selectedChat?.isAi) return;
    if (typeof window === "undefined" || !session?.user?.id) return;

    const saved = localStorage.getItem(`zline_ai_messages_${session.user.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          scrollToBottom();
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved AI messages:", e);
      }
    }

    const initial = [
      {
        _id: "welcome_ai_msg",
        content: "👋 Hello! I am **Zino**, your built-in intelligent assistant in Zline.\n\nAsk me anything: how Zline features and v3.0 end-to-end encryption work, how to link devices, reasoning puzzles, coding & debugging, or real-time web research!",
        sender: { _id: AI_CHAT_ID, name: "Zino" },
        createdAt: new Date().toISOString(),
        type: "text",
        isAi: true,
      },
    ];
    setMessages(initial);
    scrollToBottom();
  }, [selectedChat?.isAi, session?.user?.id, scrollToBottom]);

  // Open Zline AI conversation
  const openAiChat = useCallback(() => {
    setSelectedChat({
      _id: AI_CHAT_ID,
      isGroup: false,
      isAi: true,
      chatName: "Zino",
      chatInitial: "AI",
      isOnline: true,
      otherUser: {
        _id: AI_CHAT_ID,
        name: "Zino",
        email: "ai@zline.app",
        image: "/ai-platform.svg",
      },
      latestMessage: aiLatestMessage,
      unreadCount: 0,
    });
    setMobileView("chat");
    setSearchMode(false);
    setSearchQuery("");
  }, [aiLatestMessage]);

  // Clear Zline AI conversation
  const handleClearAiChat = useCallback(() => {
    if (!session?.user?.id) return;
    localStorage.removeItem(`zline_ai_messages_${session.user.id}`);
    const initial = [
      {
        _id: "welcome_ai_msg",
        content: "👋 Hello! I am **Zino**, your built-in intelligent assistant in Zline.\n\nAsk me anything: how Zline features and v3.0 end-to-end encryption work, how to link devices, reasoning puzzles, coding & debugging, or real-time web research!",
        sender: { _id: AI_CHAT_ID, name: "Zino" },
        createdAt: new Date().toISOString(),
        type: "text",
        isAi: true,
      },
    ];
    setMessages(initial);
    setAiLatestMessage({
      content: initial[0].content,
      createdAt: initial[0].createdAt,
    });
  }, [session?.user?.id]);

  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => {
        if (p.previewUrl) {
          URL.revokeObjectURL(p.previewUrl);
        }
      });
    };
  }, [pendingFiles]);

  useEffect(() => {
    setPendingFiles((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) {
          URL.revokeObjectURL(p.previewUrl);
        }
      });
      return [];
    });
  }, [selectedChat?.otherUser?._id, selectedChat?._id]);

  // Socket listeners — registered once per socket instance.
  // Use refs to read the latest selectedChat/session without re-registering.
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = async (message: any) => {
      const currentChat = selectedChatRef.current;
      const currentSession = sessionRef.current;
      const currentUserId = String(currentSession?.user?.id || "");
      const currentChatId = String(currentChat?._id || "");
      const otherUserId = String(currentChat?.otherUser?._id || "");

      let decryptedMsg = message;
      if (message.isEncrypted) {
        const decryptedArr = await decryptMessagesArray([message]);
        decryptedMsg = decryptedArr[0];
      }

      // Normalize senderId: handle both populated object ({ _id, name, ... }) and string ID
      const senderId =
        typeof decryptedMsg.sender === "object" && decryptedMsg.sender !== null
          ? String(decryptedMsg.sender._id || decryptedMsg.sender.id || "")
          : String(decryptedMsg.sender || "");

      // Normalize messageChatId: handle both populated object ({ _id, ... }) and string ID
      const messageChatId =
        typeof decryptedMsg.chat === "object" && decryptedMsg.chat !== null
          ? String(decryptedMsg.chat._id || decryptedMsg.chat.id || "")
          : String(decryptedMsg.chat || "");

      // Determine if message belongs to the currently active conversation
      const isCurrentChat = Boolean(
        currentChat && (
          (currentChatId && messageChatId && currentChatId === messageChatId) ||
          (!currentChat.isGroup && otherUserId && senderId === otherUserId)
        )
      );

      if (isCurrentChat) {
        // Prevent duplicate messages in active chat state
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(decryptedMsg._id))) {
            return prev;
          }
          return [...prev, decryptedMsg];
        });
        scrollToBottom();

        // If message is from someone else, mark it as seen immediately
        if (senderId && senderId !== currentUserId) {
          decryptedMsg.status = "seen";
          if (currentChat.isGroup) {
            socket.emit("mark_seen", { chatId: messageChatId || currentChatId, receiverId: currentUserId });
          } else {
            socket.emit("mark_seen", { senderId: senderId, receiverId: currentUserId });
          }
          fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: decryptedMsg._id, status: "seen" }),
          }).catch((err) => console.error("Failed to mark message as seen:", err));
        }
      } else if (senderId && senderId !== currentUserId) {
        // Message from someone we're not currently chatting with — emit delivery & increment unread
        socket.emit("message_delivered", { messageId: decryptedMsg._id, senderId: senderId });
        fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: decryptedMsg._id, status: "delivered" }),
        }).catch((err) => console.error("Failed to mark message as delivered:", err));

        // Increment unread count for matching chat in the list
        setChats((prev) =>
          prev.map((c) => {
            const isMatch = Boolean(
              (messageChatId && String(c._id) === messageChatId) ||
              (!c.isGroup && c.otherUser?._id && String(c.otherUser._id) === senderId)
            );
            return isMatch ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c;
          })
        );
      }

      // Update latest message in chat list and re-sort (for both active and inactive conversations)
      setChats((prev) => {
        const isFromOther = senderId !== currentUserId;

        // Find if this chat already exists in our chat list
        const exists = prev.some((c) =>
          Boolean(
            (messageChatId && String(c._id) === messageChatId) ||
            (!c.isGroup && c.otherUser?._id && (
              String(c.otherUser._id) === senderId ||
              (otherUserId && String(c.otherUser._id) === otherUserId && senderId === currentUserId)
            ))
          )
        );

        if (!exists && isFromOther) {
          // New conversation from someone not yet in our chat list
          fetchChatsRef.current();
          return prev;
        }

        const previewContent = decryptedMsg.content || (
          decryptedMsg.type === "image" ? "📷 Photo" :
          decryptedMsg.type === "file" ? "📎 Attachment" :
          decryptedMsg.type === "voice" ? "🎤 Voice message" :
          decryptedMsg.type === "poll" ? "📊 Poll" : ""
        );

        const updated = prev.map((c) => {
          const isThisChat = Boolean(
            (messageChatId && String(c._id) === messageChatId) ||
            (!c.isGroup && c.otherUser?._id && (
              String(c.otherUser._id) === senderId ||
              (otherUserId && String(c.otherUser._id) === otherUserId && senderId === currentUserId)
            ))
          );
          if (isThisChat) {
            return {
              ...c,
              latestMessage: {
                content: previewContent,
                sender: senderId,
                createdAt: decryptedMsg.createdAt || new Date().toISOString(),
                type: decryptedMsg.type || "text",
                _id: decryptedMsg._id,
              },
              updatedAt: decryptedMsg.createdAt || new Date().toISOString(),
            };
          }
          return c;
        });

        return [...updated].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    };

    const handleMessagesSeen = ({ chatId, receiverId, readAt }: { chatId?: string; receiverId: string; readAt?: string }) => {
      const currentChat = selectedChatRef.current;
      const isMatch = Boolean(
        currentChat && (
          (chatId && String(currentChat._id) === String(chatId)) ||
          (currentChat.otherUser?._id && String(currentChat.otherUser._id) === String(receiverId))
        )
      );
      if (isMatch) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.status !== "seen") {
              const updatedReadBy = [...(m.readBy || [])];
              const dateVal = readAt ? new Date(readAt) : new Date();
              if (!updatedReadBy.some((r: any) => {
                const rUserId = typeof r.userId === "object" && r.userId !== null
                  ? String(r.userId._id || r.userId.id || "")
                  : String(r.userId || "");
                return rUserId === String(receiverId);
              })) {
                updatedReadBy.push({ userId: receiverId, readAt: dateVal } as any);
              }
              return { ...m, status: "seen", readBy: updatedReadBy };
            }
            return m;
          })
        );
      }
    };

    const handleReadReceipt = ({ messageId, userId, readAt }: { messageId: string; userId: string; readAt: string }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id === messageId) {
            const updatedReadBy = [...(m.readBy || [])];
            if (!updatedReadBy.some((r: any) => (r.userId?.toString() === userId || r.userId?._id?.toString() === userId))) {
              updatedReadBy.push({ userId, readAt: new Date(readAt) } as any);
            }
            return { ...m, status: "seen", readBy: updatedReadBy };
          }
          return m;
        })
      );
    };

    const handleStatusUpdate = ({ messageId, status }: { messageId: string; status: string }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, status } : m));
    };

    const handleTyping = ({ chatId, senderId }: { chatId?: string; senderId: string }) => {
      if (chatId) {
        if (selectedChatRef.current?.isGroup && selectedChatRef.current?._id === chatId) {
          const member = selectedChatRef.current.users?.find((u: any) => u._id === senderId);
          setTypingUser(member ? member.name : "Someone");
        }
      } else {
        if (selectedChatRef.current?.otherUser?._id === senderId) setTypingUser(senderId);
      }
    };

    const handleStopTyping = ({ chatId, senderId }: { chatId?: string; senderId: string }) => {
      if (chatId) {
        if (selectedChatRef.current?.isGroup && selectedChatRef.current?._id === chatId) setTypingUser(null);
      } else {
        if (selectedChatRef.current?.otherUser?._id === senderId) setTypingUser(null);
      }
    };

    // Poll live update
    const handlePollUpdated = (updatedMessage: any) => {
      setMessages((prev) => prev.map((m) => m._id === updatedMessage._id ? updatedMessage : m));
    };

    // Reaction live update
    const handleReactionUpdated = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m));
    };

    const handleGroupAdded = ({ chatId }: { chatId: string }) => {
      fetchChatsRef.current();
      if (socket) {
        socket.emit("join_group_room", { chatId });
      }
    };

    // Message edit socket handler
    const handleMessageEdited = async ({ chatId, message }: { chatId?: string; message: any }) => {
      let decryptedMsg = message;
      if (message.isEncrypted) {
        const decryptedArr = await decryptMessagesArray([message]);
        decryptedMsg = decryptedArr[0];
      }
      const editedSenderId =
        typeof decryptedMsg.sender === "object" && decryptedMsg.sender !== null
          ? String(decryptedMsg.sender._id || decryptedMsg.sender.id || "")
          : String(decryptedMsg.sender || "");
      const editedChatId =
        chatId ||
        (typeof decryptedMsg.chat === "object" && decryptedMsg.chat !== null
          ? String(decryptedMsg.chat._id || decryptedMsg.chat.id || "")
          : String(decryptedMsg.chat || ""));

      setMessages((prev) => prev.map((m) => m._id === decryptedMsg._id ? decryptedMsg : m));
      setChats((prev) => prev.map((c) => {
        const isThisChat = editedChatId
          ? String(c._id) === editedChatId
          : Boolean(c.otherUser?._id && String(c.otherUser._id) === editedSenderId);
        if (isThisChat && c.latestMessage?._id === decryptedMsg._id) {
          return {
            ...c,
            latestMessage: { ...c.latestMessage, content: decryptedMsg.content },
          };
        }
        return c;
      }));
    };

    // Message delete socket handler
    const handleMessageDeleted = ({ messageId }: { chatId?: string; messageId: string }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, deletedForEveryone: true, content: "" } : m));
      setChats((prev) => prev.map((c) => {
        if (c.latestMessage?._id === messageId) {
          return {
            ...c,
            latestMessage: { ...c.latestMessage, content: "This message was deleted", deletedForEveryone: true },
          };
        }
        return c;
      }));
    };

    // Message pin/unpin socket handlers
    const handleMessagePinned = ({ chatId, message }: { chatId?: string; message: any }) => {
      const pinSenderId =
        typeof message.sender === "object" && message.sender !== null
          ? String(message.sender._id || message.sender.id || "")
          : String(message.sender || "");
      const pinChatId =
        chatId ||
        (typeof message.chat === "object" && message.chat !== null
          ? String(message.chat._id || message.chat.id || "")
          : String(message.chat || ""));

      setSelectedChat((prev: any) => {
        const isThisChat = prev && (pinChatId ? String(prev._id) === pinChatId : Boolean(prev.otherUser?._id && String(prev.otherUser._id) === pinSenderId));
        if (isThisChat) {
          const list = prev.pinnedMessages || [];
          if (!list.includes(message._id)) {
            return { ...prev, pinnedMessages: [...list, message._id] };
          }
        }
        return prev;
      });
    };

    const handleMessageUnpinned = ({ messageId }: { messageId: string }) => {
      setSelectedChat((prev: any) => {
        if (prev) {
          return { ...prev, pinnedMessages: (prev.pinnedMessages || []).filter((id: string) => id !== messageId) };
        }
        return prev;
      });
    };

    const handleRefreshCalls = () => {
      fetchCallsRef.current();
    };

    const handleTimerUpdated = ({ chatId, timer }: { chatId?: string; timer: number }) => {
      setSelectedChat((prev: any) => {
        if (prev && (!chatId || String(prev._id) === String(chatId))) {
          return { ...prev, disappearingTimer: timer };
        }
        return prev;
      });
      setChats((prev) =>
        prev.map((c) => (String(c._id) === String(chatId) ? { ...c, disappearingTimer: timer } : c))
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("messages_seen", handleMessagesSeen);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);
    socket.on("poll_updated", handlePollUpdated);
    socket.on("reaction_updated", handleReactionUpdated);
    socket.on("read_receipt", handleReadReceipt);
    socket.on("group_added", handleGroupAdded);
    socket.on("incoming_call", handleRefreshCalls);
    socket.on("call_answered", handleRefreshCalls);
    socket.on("call_rejected", handleRefreshCalls);
    socket.on("call_ended", handleRefreshCalls);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_pinned", handleMessagePinned);
    socket.on("message_unpinned", handleMessageUnpinned);
    socket.on("timer_updated", handleTimerUpdated);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("messages_seen", handleMessagesSeen);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
      socket.off("poll_updated", handlePollUpdated);
      socket.off("reaction_updated", handleReactionUpdated);
      socket.off("read_receipt", handleReadReceipt);
      socket.off("group_added", handleGroupAdded);
      socket.off("incoming_call", handleRefreshCalls);
      socket.off("call_answered", handleRefreshCalls);
      socket.off("call_rejected", handleRefreshCalls);
      socket.off("call_ended", handleRefreshCalls);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_pinned", handleMessagePinned);
      socket.off("message_unpinned", handleMessageUnpinned);
      socket.off("timer_updated", handleTimerUpdated);
    };
  }, [socket, decryptMessagesArray, scrollToBottom]); // stable — never re-registers due to selectedChat/session changes

  // ── Reaction handler ──────────────────────────────────────────────────
  const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  const handleReaction = async (messageId: string, emoji: string) => {
    setActiveReactionMsgId(null);
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      if (res.ok) {
        const { reactions } = await res.json();
        setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m));
        // Broadcast to the other user
        if (socket && selectedChat?.otherUser?._id) {
          socket.emit("reaction_update", {
            targetUserId: selectedChat.otherUser._id,
            messageId,
            reactions,
          });
        }
      }
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  // ── Poll handlers ──────────────────────────────────────────────────────
  const handleVote = async (messageId: string, optionIndex: number) => {
    const res = await fetch("/api/polls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, optionIndex }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => m._id === updated._id ? updated : m));
      // Broadcast to other user
      if (socket && selectedChat?.otherUser?._id) {
        socket.emit("poll_update", { receiverId: selectedChat.otherUser._id, updatedMessage: updated });
      }
    }
  };

  const handleEndPoll = async (messageId: string) => {
    const res = await fetch("/api/polls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, action: "end" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => m._id === updated._id ? updated : m));
      if (socket && selectedChat?.otherUser?._id) {
        socket.emit("poll_update", { receiverId: selectedChat.otherUser._id, updatedMessage: updated });
      }
    }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    if (!selectedChat?.otherUser?._id) return;
    setPollLoading(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedChat.otherUser._id,
          question: pollQuestion,
          options: pollOptions.filter(o => o.trim()),
        }),
      });
      if (res.ok) {
        const message = await res.json();
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
        if (socket) {
          socket.emit("send_message", { receiverId: selectedChat.otherUser._id, message });
        }
        setShowPollForm(false);
        setPollQuestion("");
        setPollOptions(["", ""]);
      }
    } finally {
      setPollLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch("/api/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? { ...m, deletedForEveryone: true, content: "", fileUrl: undefined, fileName: undefined }
              : m
          )
        );
        if (socket) {
          if (selectedChat.isGroup) {
            socket.emit("message_deleted", { chatId: selectedChat._id, messageId });
          } else if (selectedChat.otherUser?._id) {
            socket.emit("message_deleted", { targetUserId: selectedChat.otherUser._id, messageId });
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!selectedChat) return;
    try {
      const res = await fetch("/api/messages/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, chatId: selectedChat._id }),
      });
      if (res.ok) {
        setSelectedChat((prev: any) => {
          if (!prev) return prev;
          const pins = prev.pinnedMessages || [];
          if (!pins.includes(messageId)) {
            return { ...prev, pinnedMessages: [...pins, messageId] };
          }
          return prev;
        });
        if (socket) {
          if (selectedChat.isGroup) {
            socket.emit("message_pinned", { chatId: selectedChat._id, messageId });
          } else if (selectedChat.otherUser?._id) {
            socket.emit("message_pinned", { targetUserId: selectedChat.otherUser._id, messageId, chatId: selectedChat._id });
          }
        }
      } else {
        const err = await res.json();
        alert(err.message || "Failed to pin message");
      }
    } catch (err) {
      console.error("Failed to pin message:", err);
    }
  };

  const handleUnpinMessage = async (messageId: string) => {
    if (!selectedChat) return;
    try {
      const res = await fetch(`/api/messages/pin?messageId=${messageId}&chatId=${selectedChat._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedChat((prev: any) => {
          if (!prev) return prev;
          return { ...prev, pinnedMessages: (prev.pinnedMessages || []).filter((id: string) => id !== messageId) };
        });
        if (socket) {
          if (selectedChat.isGroup) {
            socket.emit("message_unpinned", { chatId: selectedChat._id, messageId });
          } else if (selectedChat.otherUser?._id) {
            socket.emit("message_unpinned", { targetUserId: selectedChat.otherUser._id, messageId, chatId: selectedChat._id });
          }
        }
      }
    } catch (err) {
      console.error("Failed to unpin message:", err);
    }
  };

  const handleStarMessage = async (messageId: string) => {
    if (!selectedChat) return;
    try {
      const res = await fetch("/api/messages/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, chatId: selectedChat._id }),
      });
      if (res.ok) {
        setStarredMessageIds((prev) => [...prev, messageId]);
      }
    } catch (err) {
      console.error("Failed to star message:", err);
    }
  };

  const handleUnstarMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages/star?messageId=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStarredMessageIds((prev) => prev.filter((id) => id !== messageId));
      }
    } catch (err) {
      console.error("Failed to unstar message:", err);
    }
  };

  // Configure disappearing message timer for active chat
  const handleSetDisappearingTimer = async (seconds: number) => {
    if (!selectedChat?._id) return;
    setTimerLoading(true);
    try {
      const res = await fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selectedChat._id, disappearingTimer: seconds }),
      });
      if (res.ok) {
        setSelectedChat((prev: any) => (prev ? { ...prev, disappearingTimer: seconds } : prev));
        setChats((prev) =>
          prev.map((c) => (String(c._id) === String(selectedChat._id) ? { ...c, disappearingTimer: seconds } : c))
        );
        if (socket) {
          if (selectedChat.isGroup) {
            socket.emit("timer_updated", { chatId: selectedChat._id, timer: seconds });
          } else if (selectedChat.otherUser?._id) {
            socket.emit("timer_updated", { receiverId: selectedChat.otherUser._id, timer: seconds, chatId: selectedChat._id });
          }
        }
        setShowTimerModal(false);
      }
    } catch (err) {
      console.error("Failed to update disappearing timer:", err);
    } finally {
      setTimerLoading(false);
    }
  };

  // Export clean decrypted plaintext chat history as a downloadable .txt file
  const handleExportChat = () => {
    if (!selectedChat) return;
    if (messages.length === 0) {
      alert("No messages to export in this conversation.");
      return;
    }

    const currentChatName = selectedChat.chatName || "Chat";
    const nowStr = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const separator = "=".repeat(64);

    let exportContent = `${separator}\n`;
    exportContent += `ZLINE CHAT HISTORY EXPORT\n`;
    exportContent += `Conversation: ${currentChatName}\n`;
    exportContent += `Exported At:  ${nowStr}\n`;
    exportContent += `Messages:     ${messages.length}\n`;
    exportContent += `Security:     End-to-End Encrypted (v3.0 Multi-Device)\n`;
    exportContent += `Decryption:   Plaintext Export generated locally by account owner\n`;
    exportContent += `Retention:    Maximum 7 days / Chat disappearing timer: ${formatTimerLabel(selectedChat.disappearingTimer)}\n`;
    exportContent += `${separator}\n\n`;

    messages.forEach((msg) => {
      const msgDate = msg.createdAt ? format(new Date(msg.createdAt), "yyyy-MM-dd HH:mm:ss") : "Unknown Date";
      const isMe = msg.sender === session?.user?.id || msg.sender?._id === session?.user?.id;
      const senderName = isMe ? "You" : (msg.sender?.name || selectedChat.chatName || "Participant");

      let bodyText = msg.content || "";
      if (msg.type === "image") {
        bodyText = `[📷 Photo: ${msg.fileName || "Image"}${msg.fileSize ? ` (${(msg.fileSize / 1024 / 1024).toFixed(2)} MB)` : ""}]${bodyText ? ` - Caption: ${bodyText}` : ""}`;
      } else if (msg.type === "file") {
        bodyText = `[📎 File: ${msg.fileName || "Attachment"}${msg.fileSize ? ` (${(msg.fileSize / 1024 / 1024).toFixed(2)} MB)` : ""}]${bodyText ? ` - Caption: ${bodyText}` : ""}`;
      } else if (msg.type === "voice") {
        bodyText = `[🎤 Voice Message${msg.voiceDuration ? ` (${msg.voiceDuration}s)` : ""}]`;
      } else if (msg.type === "poll") {
        bodyText = `[📊 Poll: ${msg.poll?.question || "Poll"}]`;
      }

      if (msg.deletedForEveryone) {
        bodyText = `[This message was deleted]`;
      }

      exportContent += `[${msgDate}] ${senderName}:\n${bodyText}\n\n`;
    });

    exportContent += `${separator}\n`;
    exportContent += `End of Chat Export • Zline Messaging System\n`;
    exportContent += `${separator}\n`;

    const blob = new Blob([exportContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = currentChatName.toLowerCase().replace(/[^a-z0-9]/gi, "_");
    link.href = url;
    link.download = `zline_chat_${safeName}_${format(new Date(), "yyyyMMdd_HHmmss")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Catch Me Up - Instant AI Conversation Briefing
  const handleCatchMeUp = useCallback(async () => {
    if (!selectedChat || messages.length === 0) return;
    setShowCatchMeUpModal(true);
    setCatchMeUpLoading(true);
    setCatchMeUpSummary("");
    setCatchMeUpCopied(false);

    try {
      const recentMsgs = messages.slice(-25).map((m) => {
        const isMe = m.sender === session?.user?.id || m.sender?._id === session?.user?.id;
        const name = isMe ? "You" : (m.sender?.name || selectedChat.chatName || "User");
        return `${name}: ${m.content || "[Media/Attachment]"}`;
      }).join("\n");

      const prompt = `You are Zino, Zline's intelligent assistant. Provide an executive 'Catch Me Up' briefing for the conversation "${selectedChat.chatName}".
Here is the recent decrypted conversation snippet:
${recentMsgs}

Please generate a structured, easy-to-read briefing with the following markdown sections:
### 📌 Executive Summary
(1-2 clear, punchy sentences summarizing the discussion)

### 💡 Key Takeaways
- Bullet points of important updates, decisions, or shared information

### ✅ Action Items & Tasks
- Bullet points of next steps, responsibilities, or tasks agreed upon (or write "None identified" if none).

Keep it concise, professional, and directly useful.`;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json();
      setCatchMeUpSummary(data.content || "Unable to summarize conversation at this time.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error summarizing";
      setCatchMeUpSummary(`⚠️ Could not generate briefing: ${msg}`);
    } finally {
      setCatchMeUpLoading(false);
    }
  }, [selectedChat, messages, session?.user?.id]);

  // Inline Message Translation with Zino AI
  const handleTranslateMessage = useCallback(async (msg: any) => {
    if (!msg?._id || !msg?.content) return;
    const msgId = msg._id;

    if (translatedMessages[msgId]?.text) {
      setTranslatedMessages((prev) => {
        const copy = { ...prev };
        delete copy[msgId];
        return copy;
      });
      return;
    }

    setTranslatedMessages((prev) => ({
      ...prev,
      [msgId]: { text: "", loading: true },
    }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: false,
          messages: [
            {
              role: "user",
              content: `Translate the following text into English (or if it is already in English, translate it into Spanish). Return ONLY the direct translated text without explanations, labels, or quotation marks:\n\n${msg.content}`,
            },
          ],
        }),
      });

      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      setTranslatedMessages((prev) => ({
        ...prev,
        [msgId]: { text: data.content || "Translation unavailable.", loading: false },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Translation error";
      setTranslatedMessages((prev) => ({
        ...prev,
        [msgId]: { text: "", loading: false, error: message },
      }));
    }
  }, [translatedMessages]);

  // Core: send a message object (text or media) to the API + socket
  const dispatchMessage = async (payload: {
    content?: string;
    type?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    replyTo?: string;
    voiceDuration?: number;
  }) => {
    if (!selectedChat) return;
    setMediaError(null);
    try {
      const body: any = { ...payload };
      if (selectedChat.isGroup) {
        body.chatId = selectedChat._id;
      } else {
        if (!selectedChat.otherUser?._id) return;
        body.receiverId = selectedChat.otherUser._id;
      }

      // Perform v3.0 Multi-Device E2EE if recipient devices are available and message is text type
      if (payload.type === "text" && payload.content && targetRecipientDevices.length > 0 && localDevice) {
        try {
          const encrypted = await encryptMultiRecipientMessage(
            payload.content,
            targetRecipientDevices,
            {
              deviceId: localDevice.deviceId,
              userId: session?.user?.id,
              publicKey: localDevice.publicKeyJwk,
            }
          );
          body.content = encrypted.ciphertext;
          body.isEncrypted = true;
          body.keyEnvelopes = encrypted.keyEnvelopes;
          body.encAesKey = encrypted.encAesKey;
          body.encAesKeyForSender = encrypted.encAesKeyForSender;
          body.iv = encrypted.iv;
          body.senderDeviceId = localDevice.deviceId;
          body.cryptographicVersion = "3.0";
        } catch (cryptoErr: any) {
          console.error("Encryption failed:", cryptoErr);
          // RULE 13: Never silently bypass encryption when an error occurs
          setMediaError("Encryption failed: " + (cryptoErr?.message || "Failed to wrap message keys"));
          return;
        }
      }

      if (replyingTo) {
        body.replyTo = replyingTo._id;
        setReplyingTo(null);
      }

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        setMediaError(err.message || "Failed to send");
        return;
      }
      const message = await res.json();

      let decryptedMsg = message;
      if (message.isEncrypted) {
        const decryptedArr = await decryptMessagesArray([message]);
        decryptedMsg = decryptedArr[0];
      }

      setMessages((prev) => [...prev, decryptedMsg]);
      scrollToBottom();
      if (socket) {
        if (selectedChat.isGroup) {
          socket.emit("send_message", { chatId: selectedChat._id, message });
        } else {
          // Emit the original encrypted message to preserve End-to-End Encryption in transit
          socket.emit("send_message", { receiverId: selectedChat.otherUser._id, message });
        }
      }
      // Update sidebar
      setChats((prev) => {
        const chatIdVal = selectedChat.isGroup ? selectedChat._id : selectedChat.otherUser?._id;
        const exists = prev.some((c) => selectedChat.isGroup ? c._id === chatIdVal : c.otherUser?._id === chatIdVal);
        const previewContent = decryptedMsg.content || "";
        const previewType = (payload.type as string) || "text";
        let updated;
        if (exists) {
          updated = prev.map((c) => {
            const isMatch = selectedChat.isGroup ? c._id === chatIdVal : c.otherUser?._id === chatIdVal;
            if (isMatch) {
              return { ...c, latestMessage: { content: previewContent, sender: session?.user?.id, createdAt: new Date().toISOString(), type: previewType }, updatedAt: new Date().toISOString() };
            }
            return c;
          });
        } else {
          updated = [
            {
              _id: message.chat,
              isGroup: selectedChat.isGroup,
              chatName: selectedChat.chatName,
              chatInitial: selectedChat.chatInitial,
              isOnline: selectedChat.isOnline,
              otherUser: selectedChat.otherUser,
              latestMessage: { content: previewContent, sender: session?.user?.id, createdAt: new Date().toISOString(), type: previewType },
              unreadCount: 0,
              updatedAt: new Date().toISOString(),
            },
            ...prev,
          ];
        }
        return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
      if (!selectedChat._id) {
        setSelectedChat((prev: any) => ({ ...prev, _id: message.chat }));
      }
    } catch {
      console.error("Failed to send message");
      setMediaError("Failed to send message.");
    }
  };

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "voice-message.webm");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        setMediaError(err.message || "Upload failed");
        return;
      }
      const { fileUrl, fileName, fileSize, type } = await res.json();
      await dispatchMessage({ content: "", type, fileUrl, fileName, fileSize, voiceDuration: duration });
    } catch {
      setMediaError("Failed to send voice message.");
    } finally {
      setIsUploading(false);
    }
  };

  // Send message (text or pending files)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingFiles.length > 0) {
      uploadAndSendPendingFiles();
      return;
    }
    if (!newMessage.trim() || !selectedChat) return;
    const content = newMessage;
    setNewMessage("");
    setIsTyping(false);

    // Route to Zline AI if chatting with AI Assistant
    if (selectedChat.isAi) {
      const userMsg = {
        _id: "user_" + Date.now(),
        content,
        sender: { _id: session?.user?.id, name: session?.user?.name || "You" },
        createdAt: new Date().toISOString(),
        type: "text",
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsAiThinking(true);
      setAiSearchStatus({ stage: "idle" });
      scrollToBottom();

      try {
        const payload = {
          messages: updatedMessages.map((m) => ({
            role: m.sender?._id === session?.user?.id || m.sender === session?.user?.id ? "user" : "assistant",
            content: m.content || "",
          })),
          searchMode: aiSearchMode,
          stream: true,
        };

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to get AI response");
        }

        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream") && res.body) {
          const aiMsgId = "ai_" + new Date().getTime();
          const streamContext = {
            text: "",
            sources: [] as any[],
            query: undefined as string | undefined,
          };

          // Placeholder AI message being populated via stream
          const initialAiMsg = {
            _id: aiMsgId,
            content: "",
            sender: { _id: AI_CHAT_ID, name: "Zino" },
            createdAt: new Date().toISOString(),
            type: "text",
            isAi: true,
            sources: [],
          };

          setMessages([...updatedMessages, initialAiMsg]);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() || "";

            for (const chunk of chunks) {
              const eventMatch = chunk.match(/^event:\s*(\w+)/);
              const dataMatch = chunk.match(/data:\s*(.+)$/m);
              if (!dataMatch) continue;

              const eventType = eventMatch ? eventMatch[1] : "message";
              try {
                const eventData = JSON.parse(dataMatch[1]);

                if (eventType === "status") {
                  setAiSearchStatus(eventData);
                  scrollToBottom();
                } else if (eventType === "reasoning") {
                  setAiSearchStatus({ stage: "reasoning" });
                  scrollToBottom();
                } else if (eventType === "sources") {
                  streamContext.sources = eventData.sources || [];
                  streamContext.query = eventData.query;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m._id === aiMsgId
                        ? { ...m, sources: streamContext.sources, searchQuery: streamContext.query }
                        : m
                    )
                  );
                } else if (eventType === "delta") {
                  streamContext.text += eventData.text || "";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m._id === aiMsgId ? { ...m, content: streamContext.text } : m
                    )
                  );
                  scrollToBottom();
                } else if (eventType === "done") {
                  if (eventData.content) streamContext.text = eventData.content;
                  if (eventData.sources) streamContext.sources = eventData.sources;
                  if (eventData.searchQuery) streamContext.query = eventData.searchQuery;
                } else if (eventType === "error") {
                  throw new Error(eventData.message || "Streaming error");
                }
              } catch {
                // Ignore incomplete JSON chunks
              }
            }
          }

          const finalizedAiMsg = {
            _id: aiMsgId,
            content: streamContext.text,
            sender: { _id: AI_CHAT_ID, name: "Zino" },
            createdAt: new Date().toISOString(),
            type: "text",
            isAi: true,
            sources: streamContext.sources,
            searchQuery: streamContext.query,
          };

          const finalMsgs = [...updatedMessages, finalizedAiMsg];
          setMessages(finalMsgs);
          if (session?.user?.id) {
            localStorage.setItem(
              `zline_ai_messages_${session.user.id}`,
              JSON.stringify(finalMsgs)
            );
          }
          setAiLatestMessage({
            content: streamContext.text,
            createdAt: finalizedAiMsg.createdAt,
          });
        } else {
          // Fallback to standard JSON
          const data = await res.json();
          const aiMsg = {
            _id: "ai_" + Date.now(),
            content: data.content,
            sender: { _id: AI_CHAT_ID, name: "Zino" },
            createdAt: new Date().toISOString(),
            type: "text",
            isAi: true,
            sources: data.sources || [],
            searchQuery: data.searchQuery,
          };

          const finalMsgs = [...updatedMessages, aiMsg];
          setMessages(finalMsgs);
          if (session?.user?.id) {
            localStorage.setItem(
              `zline_ai_messages_${session.user.id}`,
              JSON.stringify(finalMsgs)
            );
          }
          setAiLatestMessage({
            content: data.content,
            createdAt: aiMsg.createdAt,
          });
        }
      } catch (err: any) {
        console.error("AI error:", err);
        const errorMsg = {
          _id: "ai_err_" + Date.now(),
          content: `⚠️ Sorry, I encountered an issue: ${
            err.message || "Please try again later."
          }`,
          sender: { _id: AI_CHAT_ID, name: "Zino" },
          createdAt: new Date().toISOString(),
          type: "text",
          isAi: true,
        };
        const finalMsgs = [...updatedMessages, errorMsg];
        setMessages(finalMsgs);
      } finally {
        setIsAiThinking(false);
        setAiSearchStatus({ stage: "idle" });
        scrollToBottom();
      }
      return;
    }

    if (socket) {
      if (selectedChat.isGroup) {
        socket.emit("stop_typing", { chatId: selectedChat._id, senderId: session?.user?.id });
      } else if (selectedChat.otherUser?._id) {
        socket.emit("stop_typing", { receiverId: selectedChat.otherUser._id, senderId: session?.user?.id });
      }
    }

    if (editingMessage) {
      const msgToEdit = editingMessage;
      setEditingMessage(null);
      try {
        const body: any = { messageId: msgToEdit._id, content };
        
        // Handle E2EE re-encryption for edited message
        if (msgToEdit.isEncrypted && targetRecipientDevices.length > 0 && localDevice) {
          try {
            const encrypted = await encryptMultiRecipientMessage(
              content,
              targetRecipientDevices,
              {
                deviceId: localDevice.deviceId,
                userId: session?.user?.id,
                publicKey: localDevice.publicKeyJwk,
              }
            );
            body.content = encrypted.ciphertext;
            body.isEncrypted = true;
            body.keyEnvelopes = encrypted.keyEnvelopes;
            body.encAesKey = encrypted.encAesKey;
            body.encAesKeyForSender = encrypted.encAesKeyForSender;
            body.iv = encrypted.iv;
            body.senderDeviceId = localDevice.deviceId;
            body.cryptographicVersion = "3.0";
          } catch (cryptoErr) {
            console.error("Encryption failed for E2EE edit:", cryptoErr);
            setMediaError("Encryption failed while updating edited message.");
            return;
          }
        }

        const res = await fetch("/api/messages/edit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          let decryptedMsg = data.message;
          if (decryptedMsg.isEncrypted) {
            const decryptedArr = await decryptMessagesArray([decryptedMsg]);
            decryptedMsg = decryptedArr[0];
          }
          setMessages((prev) =>
            prev.map((m) => (m._id === decryptedMsg._id ? decryptedMsg : m))
          );
          // Broadcast socket event
          if (socket) {
            if (selectedChat.isGroup) {
              socket.emit("message_edited", { chatId: selectedChat._id, message: data.message });
            } else if (selectedChat.otherUser?._id) {
              socket.emit("message_edited", { targetUserId: selectedChat.otherUser._id, message: data.message });
            }
          }
        }
      } catch (err) {
        console.error("Failed to edit message:", err);
      }
    } else {
      await dispatchMessage({ content, type: "text" });
    }
  };

  // Multiple files selection with max 50MB per selection limit
  const selectFiles = (files: FileList | File[]) => {
    setMediaError(null);
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    setPendingFiles((prev) => {
      const currentTotal = prev.reduce((acc, p) => acc + p.file.size, 0);
      const newSelectionTotal = fileList.reduce((acc, f) => acc + f.size, 0);
      const combinedTotal = currentTotal + newSelectionTotal;

      if (combinedTotal > MAX_TOTAL_FILES_BYTES) {
        const totalMb = (combinedTotal / (1024 * 1024)).toFixed(1);
        setMediaError(`Selection exceeds 50MB limit (${totalMb}MB total). Please select fewer or smaller files.`);
        return prev;
      }

      const newAttachments: PendingAttachment[] = fileList.map((file) => ({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      }));

      return [...prev, ...newAttachments];
    });
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearPendingFiles = () => {
    setPendingFiles((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
    setMediaError(null);
  };

  // Upload and send all pending files with overall and per-file progress tracking
  const uploadAndSendPendingFiles = async () => {
    if (pendingFiles.length === 0 || !selectedChat) return;
    const filesToUpload = [...pendingFiles];
    const caption = newMessage.trim();
    setNewMessage("");
    setPendingFiles([]);
    setIsUploading(true);
    setMediaError(null);
    setUploadProgress({ current: 1, total: filesToUpload.length, percent: 0 });

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const item = filesToUpload[i];

        const uploadResult = await new Promise<{
          fileUrl: string;
          fileName: string;
          fileSize: number;
          type: "image" | "voice" | "file";
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append("file", item.file);

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const filePercent = event.loaded / event.total;
              const overallPercent = Math.round(((i + filePercent) / filesToUpload.length) * 100);
              setUploadProgress({
                current: i + 1,
                total: filesToUpload.length,
                percent: Math.min(overallPercent, 99),
              });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch {
                reject(new Error("Failed to parse server upload response."));
              }
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err.message || `Upload failed with status ${xhr.status}`));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Upload failed due to a network error."));
          });

          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        // Revoke object URL
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }

        // Send the message into chat (caption attached to first file)
        const fileCaption = i === 0 ? caption : "";
        await dispatchMessage({
          content: fileCaption,
          type: uploadResult.type,
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
        });
      }
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setMediaError(err instanceof Error ? err.message : "Failed to upload file(s).");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Upload multiple files/images and send (trigger for input change)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedChat) return;
    selectFiles(files);
    e.target.value = "";
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedChat) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!selectedChat) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      selectFiles(files);
    }
  };

  // Rich icons for file attachments
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "")) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (["mp3", "wav", "ogg", "m4a", "webm"].includes(ext || "")) return <Music className="w-4 h-4 text-emerald-500" />;
    if (["mp4", "webm", "avi", "mov", "mkv"].includes(ext || "")) return <Film className="w-4 h-4 text-rose-500" />;
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext || "")) return <Archive className="w-4 h-4 text-amber-500" />;
    if (["js", "ts", "jsx", "tsx", "html", "css", "py", "json", "go", "java", "cpp", "c", "sh"].includes(ext || "")) return <Code2 className="w-4 h-4 text-indigo-500" />;
    if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(ext || "")) return <FileText className="w-4 h-4 text-blue-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };



  // Typing
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!socket || !selectedChat) return;
    if (!isTyping) {
      setIsTyping(true);
      if (selectedChat.isGroup) {
        socket.emit("typing", { chatId: selectedChat._id, senderId: session?.user?.id });
      } else if (selectedChat.otherUser?._id) {
        socket.emit("typing", { receiverId: selectedChat.otherUser._id, senderId: session?.user?.id });
      }
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (selectedChat.isGroup) {
        socket.emit("stop_typing", { chatId: selectedChat._id, senderId: session?.user?.id });
      } else if (selectedChat.otherUser?._id) {
        socket.emit("stop_typing", { receiverId: selectedChat.otherUser._id, senderId: session?.user?.id });
      }
    }, 2000);
  };

  // Group helpers
  const openCreateGroup = async () => {
    setShowCreateGroupModal(true);
    setGroupNameInput("");
    setSelectedGroupMembers([]);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setAllUsers(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch group contacts:", err);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupNameInput.trim() || selectedGroupMembers.length === 0) return;
    setGroupLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupNameInput.trim(),
          userIds: selectedGroupMembers,
        }),
      });
      if (res.ok) {
        const group = await res.json();
        
        if (socket) {
          socket.emit("create_group", {
            chatId: group._id,
            userIds: group.users.map((u: any) => u._id || u),
          });
        }
        
        await fetchChats();
        setSelectedChat(group);
        setMobileView("chat");
        setShowCreateGroupModal(false);
      }
    } catch (err) {
      console.error("Create group error:", err);
    } finally {
      setGroupLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <LoadingAnimation
        message="Zline"
        submessage="Initializing secure encrypted session..."
      />
    );
  }
  if (status === "unauthenticated") return null;

  // Helper: get preview text for latest message
  const getPreview = (chat: any) => {
    if (!chat.latestMessage) return "No messages yet";
    const msg = chat.latestMessage;
    const isMe = msg.sender === session?.user?.id || msg.sender?._id === session?.user?.id;
    const prefix = isMe ? "You: " : "";
    if (msg.type === "image") return prefix + "📷 Photo";
    if (msg.type === "file") return prefix + "📎 File";
    if (msg.type === "voice") return prefix + "🎤 Voice";
    const text = msg.content || "";
    return prefix + (text.length > 35 ? text.slice(0, 35) + "…" : text);
  };

  const filteredMessages = messages;

  // Density styles for chat list items
  const densityStyles = {
    compact: {
      itemPadding: "px-2.5 py-1.5",
      avatarSize: "w-8 h-8",
      titleSize: "text-xs font-semibold",
      previewSize: "text-[11px]",
      timeSize: "text-[9px]",
      gap: "gap-2.5",
    },
    normal: {
      itemPadding: "px-3 py-3",
      avatarSize: "w-11 h-11",
      titleSize: "text-sm font-semibold",
      previewSize: "text-xs",
      timeSize: "text-[10px]",
      gap: "gap-3",
    },
    spacious: {
      itemPadding: "px-3.5 py-4",
      avatarSize: "w-12 h-12",
      titleSize: "text-base font-semibold",
      previewSize: "text-sm",
      timeSize: "text-xs",
      gap: "gap-3.5",
    },
  }[chatListDensity] || {
    itemPadding: "px-3 py-3",
    avatarSize: "w-11 h-11",
    titleSize: "text-sm font-semibold",
    previewSize: "text-xs",
    timeSize: "text-[10px]",
    gap: "gap-3",
  };

  const renderSizeControlsPopover = () => (
    <div className="relative">
      <button
        onClick={() => setShowSizeControls(!showSizeControls)}
        className={`p-2 transition-colors rounded-lg cursor-pointer ${
          showSizeControls
            ? "text-blue-600 bg-blue-50 dark:bg-blue-950/40"
            : "text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800"
        }`}
        title="Adjust chat size & list density"
        aria-label="Adjust chat size and list density"
      >
        <SlidersHorizontal className="h-5 w-5" />
      </button>

      {showSizeControls && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSizeControls(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Display & Sizing
                </span>
              </div>
              <button
                onClick={() => setShowSizeControls(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Message Font Size */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-gray-500" /> Chat Text Size
                </span>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                  {chatFontSize}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                {(["sm", "md", "lg", "xl"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setChatFontSize(s);
                      try {
                        localStorage.setItem("zline_chat_font_size", s);
                        window.dispatchEvent(new CustomEvent("zline:chat_size_changed", { detail: { fontSize: s } }));
                      } catch {}
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      chatFontSize === s
                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-xs"
                        : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat List Density */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Columns className="w-3.5 h-3.5 text-gray-500" /> Chat List Density
                </span>
                <span className="text-[10px] capitalize font-bold text-blue-600 dark:text-blue-400">
                  {chatListDensity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                {(["compact", "normal", "spacious"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setChatListDensity(d);
                      try {
                        localStorage.setItem("zline_chat_list_density", d);
                        window.dispatchEvent(new CustomEvent("zline:chat_size_changed", { detail: { density: d } }));
                      } catch {}
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all capitalize cursor-pointer ${
                      chatListDensity === d
                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-xs"
                        : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat List Width Presets (Desktop) */}
            <div className="hidden md:block">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                  Sidebar Width
                </span>
                <span className="text-[10px] font-mono font-semibold text-gray-500 dark:text-zinc-400">
                  {sidebarWidth}px
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                {[300, 360, 420, 500].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setSidebarWidth(w);
                      try {
                        localStorage.setItem("zline_sidebar_width", w.toString());
                        window.dispatchEvent(new CustomEvent("zline:chat_size_changed", { detail: { sidebarWidth: w } }));
                      } catch {}
                    }}
                    className={`py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      Math.abs(sidebarWidth - w) < 20
                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-xs font-bold"
                        : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-2 text-center">
                Drag the divider between panels to resize freely
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex w-full max-w-full h-screen-mobile bg-gray-100 dark:bg-black overflow-hidden relative">
      {/* Primary Semantic H1 for SEO & Accessibility */}
      <h1 className="sr-only">Zline — Real-Time Messaging & HD Calling</h1>

      {/* ===== SIDEBAR ===== */}
      {/* Mobile: full-screen when mobileView=="sidebar", hidden when mobileView=="chat" */}
      {/* Tablet+ / Desktop: consistent stable width whether chat is open or not */}
      <div 
        style={{
          width: isDesktop ? `${sidebarWidth}px` : undefined,
          minWidth: isDesktop ? `${sidebarWidth}px` : undefined,
          maxWidth: isDesktop ? `${sidebarWidth}px` : undefined,
        }}
        className={`
        flex-shrink-0 bg-white border-r border-gray-200 dark:bg-zinc-950 dark:border-zinc-800 flex flex-col h-full relative
        ${
          mobileView === "sidebar"
            ? "flex w-full md:w-auto"
            : "hidden md:flex md:w-auto"
        }
      `}>
        {sidebarTab === "chats" ? (
          <>
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-3 md:px-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0 min-w-0">
              {searchMode ? (
                <div className="flex items-center gap-2 w-full">
                  <button onClick={() => { setSearchMode(false); setSearchQuery(""); setSearchResults({ users: [], messages: [] }); }}>
                    <ArrowLeft className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:text-zinc-400" />
                  </button>
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search..."
                    className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none dark:text-white"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setSearchResults({ users: [], messages: [] }); }}>
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center min-w-0 flex-shrink-0">
                    <Logo className="h-7 w-auto" />
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <button 
                      onClick={() => setSearchMode(true)} 
                      className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" 
                      title="New chat"
                      aria-label="New chat"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={() => setShowStarredPanel(true)} 
                      className="p-1.5 text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors" 
                      title="Starred messages"
                      aria-label="Starred messages"
                    >
                      <Star className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={openCreateGroup} 
                      className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" 
                      title="New group"
                      aria-label="New group"
                    >
                      <Users className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={() => setShowSettingsPanel(true)} 
                      className="p-1.5 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" 
                      title="Settings"
                      aria-label="Settings"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Search bar (always visible when not in search mode) */}
            {!searchMode && (
              <div className="px-3 py-2">
                <div
                  onClick={() => setSearchMode(true)}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <Search className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Search or start new chat</span>
                </div>
              </div>
            )}

            {/* Kokonut Profile Dropdown */}
            {!searchMode && (
              <div className="px-3 py-2 bg-gray-50/80 dark:bg-zinc-900/60 border-b border-gray-100 dark:border-zinc-800 flex justify-center">
                {session?.user ? (
                  <ProfileDropdown
                    accounts={[
                      {
                        id: session.user.id || "me",
                        name: session.user.name || "User",
                        email: session.user.email || "",
                        image: session.user.image,
                        plan: "E2EE",
                      },
                    ]}
                    defaultAccountId={session.user.id || "me"}
                    align="left"
                    triggerClassName="w-full justify-between"
                    theme={theme as AccountTheme}
                    onThemeChange={(newTheme) => setTheme(newTheme)}
                    items={[
                      {
                        label: "Change Avatar",
                        icon: <User className="size-4" />,
                        onSelect: () => {
                          setIsAvatarOnboarding(false);
                          setShowAvatarPicker(true);
                        },
                      },
                      {
                        label: "Settings",
                        icon: <Settings className="size-4" />,
                        value: "⌘,",
                        onSelect: () => setShowSettingsPanel(true),
                      },
                      {
                        label: "Starred Messages",
                        icon: <Star className="size-4" />,
                        onSelect: () => setShowStarredPanel(true),
                      },
                    ]}
                    onSignOut={() => signOut({ callbackUrl: "/login" })}
                    className="w-full"
                  />
                ) : (
                  <div className="w-full h-11 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/50 animate-pulse" />
                )}
              </div>
            )}

            {/* Content: Search results OR Recent chats */}
            <div className="flex-1 overflow-y-auto">
              {searchMode ? (
                <>
                  {searchLoading && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  )}
                  {!searchLoading && searchResults.users.length === 0 && searchResults.messages.length === 0 && searchQuery && (
                    <p className="text-center text-sm text-gray-400 py-8">No results found</p>
                  )}
                  
                  {/* Users Results */}
                  {searchResults.users.length > 0 && (
                    <div className="py-2">
                      <p className="px-4 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Contacts</p>
                      {searchResults.users.map((user) => (
                        <button
                          key={user._id}
                          onClick={() => openChatWithUser(user)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                        >
                          <UserAvatar
                            image={user.image}
                            name={user.name}
                            className="w-10 h-10"
                            variant="gray"
                          />
                          <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Messages Results */}
                  {searchResults.messages.length > 0 && (
                    <div className="py-2 border-t border-gray-100 dark:border-zinc-800">
                      <p className="px-4 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Messages</p>
                      {searchResults.messages.map((msg) => {
                        // Figure out chat name
                        const chatObj = msg.chat;
                        const otherUsers = chatObj?.users?.filter((u: any) => u._id !== session?.user?.id) || [];
                        const chatName = chatObj?.isGroup ? chatObj.groupName : (otherUsers[0]?.name || "Unknown");
                        
                        return (
                          <button
                            key={msg._id}
                            onClick={() => jumpToMessage(msg)}
                            className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-600 dark:bg-blue-900/30">
                              <MessageCircle className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{chatName}</p>
                                <span className="text-[10px] text-gray-400">{formatChatTime(msg.createdAt)}</span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-zinc-300 mt-0.5 break-words line-clamp-2">
                                {msg.sender?._id === session?.user?.id ? "You: " : `${msg.sender?.name}: `}
                                {msg.content}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Pinned Zline AI Assistant Item */}
                  <button
                    onClick={openAiChat}
                    className={`w-full flex items-center ${densityStyles.gap} ${densityStyles.itemPadding} transition-colors border-b border-indigo-100/70 dark:border-indigo-950/60 ${
                      selectedChat?.isAi
                        ? "bg-indigo-50/80 dark:bg-indigo-950/50"
                        : "bg-indigo-50/20 hover:bg-indigo-50/50 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/30"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`${densityStyles.avatarSize} rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center p-1.5 shadow-sm ring-2 ring-indigo-200 dark:ring-indigo-900 border border-gray-100 dark:border-zinc-700`}>
                        <AiIcon className="w-5 h-5" />
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-zinc-950 animate-pulse"></div>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-baseline">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={`${densityStyles.titleSize} text-gray-900 dark:text-white truncate`}>
                            Zino
                          </p>
                        </div>
                        {aiLatestMessage?.createdAt && (
                          <span className={`${densityStyles.timeSize} text-indigo-600 dark:text-indigo-400 flex-shrink-0 ml-2`}>
                            {formatChatTime(aiLatestMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className={`${densityStyles.previewSize} text-gray-500 dark:text-zinc-400 truncate mt-0.5`}>
                        {aiLatestMessage?.content
                          ? aiLatestMessage.content.replace(/[\n#*`]/g, " ")
                          : "Ask reasoning puzzles, coding, math & more"}
                      </p>
                    </div>
                  </button>

                  {chats.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <MessageCircle className="h-10 w-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 dark:text-zinc-500">No other chats yet</p>
                      <button onClick={() => setSearchMode(true)} className="text-sm text-blue-600 mt-2 hover:underline">
                        Start a new chat
                      </button>
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <button
                        key={chat._id || chat.otherUser?._id}
                        onClick={() => { setSelectedChat(chat); setMobileView("chat"); }}
                        className={`w-full flex items-center ${densityStyles.gap} ${densityStyles.itemPadding} transition-colors border-b border-gray-50 dark:border-zinc-800/50 ${
                          !selectedChat?.isAi && selectedChat?.otherUser?._id === chat.otherUser?._id
                            ? "bg-blue-50 dark:bg-zinc-900"
                            : "hover:bg-gray-50 dark:hover:bg-zinc-900/50 active:bg-gray-100 dark:active:bg-zinc-900"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <UserAvatar
                            image={chat.chatImage || chat.otherUser?.image}
                            name={chat.chatName}
                            className={densityStyles.avatarSize}
                            variant="gray"
                          />
                          {chat.isOnline && (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-zinc-950"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex justify-between items-baseline">
                            <p className={`${densityStyles.titleSize} text-gray-900 dark:text-white truncate`}>
                              {chat.chatName}
                            </p>
                            {chat.latestMessage?.createdAt && (
                              <span className={`${densityStyles.timeSize} flex-shrink-0 ml-2 ${
                                chat.unreadCount > 0 ? "text-blue-600 font-semibold" : "text-gray-400 dark:text-zinc-500"
                              }`}>
                                {formatChatTime(chat.latestMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-0.5">
                            <p className={`${densityStyles.previewSize} text-gray-500 dark:text-zinc-400 truncate pr-2`}>
                              {getPreview(chat)}
                            </p>
                            {chat.unreadCount > 0 && (
                              <span className="bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full flex-shrink-0">
                                {chat.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Calls Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Calls</h2>
              </div>
            </div>

            {/* Search Calls Bar */}
            <div className="px-3 py-2 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={callsSearchQuery}
                  onChange={(e) => setCallsSearchQuery(e.target.value)}
                  placeholder="Search calls..."
                  className="flex-1 bg-transparent text-sm outline-none dark:text-white"
                />
                {callsSearchQuery && (
                  <button onClick={() => setCallsSearchQuery("")}>
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Profile card */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarOnboarding(false);
                    setShowAvatarPicker(true);
                  }}
                  className="relative group cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shrink-0"
                  title="Change avatar"
                >
                  <UserAvatar
                    image={session?.user?.image}
                    name={session?.user?.name}
                    className="w-9 h-9"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-medium">
                    Spin
                  </div>
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{session?.user?.name}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Online
                  </p>
                </div>
              </div>
            </div>

            {/* Calls List */}
            <div className="flex-1 overflow-y-auto">
              {calls.filter((call) => {
                if (!callsSearchQuery.trim()) return true;
                const isGroup = !!call.chatId;
                const name = isGroup
                  ? (call.chatId?.groupName || "Group Call")
                  : (call.caller?._id === session?.user?.id
                      ? (call.participants?.[0]?.name || "Unknown")
                      : (call.caller?.name || "Unknown"));
                return name.toLowerCase().includes(callsSearchQuery.toLowerCase());
              }).length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Phone className="h-10 w-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 dark:text-zinc-500">No calls logged</p>
                </div>
              ) : (
                calls
                  .filter((call) => {
                    if (!callsSearchQuery.trim()) return true;
                    const isGroup = !!call.chatId;
                    const name = isGroup
                      ? (call.chatId?.groupName || "Group Call")
                      : (call.caller?._id === session?.user?.id
                          ? (call.participants?.[0]?.name || "Unknown")
                          : (call.caller?.name || "Unknown"));
                    return name.toLowerCase().includes(callsSearchQuery.toLowerCase());
                  })
                  .map((call) => {
                    const isGroup = !!call.chatId;
                    const isOutgoing = call.caller?._id === session?.user?.id;
                    const name = isGroup
                      ? (call.chatId?.groupName || "Group Call")
                      : (isOutgoing
                          ? (call.participants?.[0]?.name || "Unknown")
                          : (call.caller?.name || "Unknown"));

                    const callTimeFormatted = formatChatTime(call.startedAt) + " • " + format(new Date(call.startedAt), "hh:mm a");
                    const durationStr = call.duration
                      ? (call.duration >= 60
                          ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
                          : `${call.duration}s`)
                      : null;

                    const handleCallItemClick = () => {
                      if (isGroup) {
                        window.dispatchEvent(new CustomEvent("zline:initiate_group_call", {
                          detail: {
                            chatId: call.chatId?._id || call.chatId,
                            groupName: name,
                            callType: call.type
                          }
                        }));
                      } else {
                        const targetUser = isOutgoing ? call.participants?.[0] : call.caller;
                        if (targetUser?._id) {
                          window.dispatchEvent(new CustomEvent("zline:initiate_call", {
                            detail: {
                              calleeId: targetUser._id,
                              calleeName: name,
                              callType: call.type
                            }
                          }));
                        }
                      }
                    };

                    let statusIcon = null;
                    let statusText = "";
                    let statusColorClass = "text-gray-500 dark:text-zinc-400";
                    
                    if (call.status === "missed") {
                      statusIcon = <PhoneMissed className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
                      statusText = isOutgoing ? "Unanswered" : "Missed";
                      statusColorClass = "text-red-500 font-semibold";
                    } else if (call.status === "rejected") {
                      statusIcon = <PhoneMissed className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
                      statusText = "Declined";
                    } else if (call.status === "cancelled") {
                      statusIcon = <PhoneOutgoing className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
                      statusText = "Cancelled";
                    } else {
                      if (isOutgoing) {
                        statusIcon = <PhoneOutgoing className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
                        statusText = "Outgoing";
                      } else {
                        statusIcon = <PhoneIncoming className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
                        statusText = "Incoming";
                      }
                    }

                    return (
                      <div
                        key={call._id}
                        className="w-full flex items-center justify-between px-3 py-3 border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative flex-shrink-0">
                            <UserAvatar
                              image={isGroup ? null : (isOutgoing ? call.participants?.[0]?.image : call.caller?.image)}
                              name={name}
                              className="w-11 h-11"
                              variant="gray"
                            />
                            <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center border border-white dark:border-zinc-950">
                              {call.type === "video" ? (
                                <Video className="w-2.5 h-2.5 text-blue-500" />
                              ) : (
                                <Phone className="w-2.5 h-2.5 text-green-500" />
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {statusIcon}
                              <span className={`text-xs ${statusColorClass}`}>
                                {statusText} {isGroup ? "Group Call" : `${call.type === "video" ? "Video" : "Voice"}`}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                              {callTimeFormatted} {durationStr && `• (${durationStr})`}
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={handleCallItemClick}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex-shrink-0"
                          title="Call back"
                        >
                          {call.type === "video" ? (
                            <Video className="w-5 h-5" />
                          ) : (
                            <PhoneCall className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </>
        )}

        {/* Floating AI Action Button in bottom-right of contact list */}
        {sidebarTab === "chats" && (
          <button
            onClick={openAiChat}
            className="absolute bottom-18 right-4 z-20 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white dark:bg-zinc-855 text-gray-900 dark:text-white shadow-xl shadow-black/10 dark:shadow-black/40 border border-gray-200 dark:border-zinc-700 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Chat with Zino"
            aria-label="Chat with Zino"
          >
            <AiIcon className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide">Zino</span>
          </button>
        )}

        {/* Bottom Tab Navigation Bar */}
        <div className="h-14 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-around bg-gray-50 dark:bg-zinc-950 px-2 flex-shrink-0">
          <button
            onClick={() => setSidebarTab("chats")}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1 text-xs font-medium transition-colors cursor-pointer ${
              sidebarTab === "chats"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-400"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Chats</span>
          </button>
          <button
            onClick={() => setSidebarTab("calls")}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1 text-xs font-medium transition-colors cursor-pointer ${
              sidebarTab === "calls"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-400"
            }`}
          >
            <Phone className="w-5 h-5" />
            <span>Calls</span>
          </button>
        </div>
      </div>

      {/* Draggable Resizer Handle between Sidebar & Chat Area (Desktop only) */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => {
          setSidebarWidth(360);
          try {
            localStorage.setItem("zline_sidebar_width", "360");
            window.dispatchEvent(new CustomEvent("zline:chat_size_changed", { detail: { sidebarWidth: 360 } }));
          } catch {}
        }}
        title="Drag to resize chat list • Double-click to reset (360px)"
        className={`hidden md:flex flex-col justify-center items-center w-2 -mx-1 hover:w-2.5 active:w-2.5 transition-all cursor-col-resize select-none z-30 group relative shrink-0 ${
          isResizing ? "bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.7)]" : "bg-transparent hover:bg-blue-500/30 active:bg-blue-600"
        }`}
      >
        <div className={`w-0.5 h-8 rounded-full transition-colors ${isResizing ? "bg-white" : "bg-gray-300 dark:bg-zinc-700 group-hover:bg-blue-500"}`} />
      </div>

      {/* ===== MAIN CHAT AREA ===== */}
      {/* Mobile: full-screen when mobileView=="chat", hidden when mobileView=="sidebar" */}
      {/* Tablet+: fills remaining space beside the sidebar */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex-1 min-w-0 flex flex-col bg-[#F0F2F5] dark:bg-[#0B141A] relative h-full overflow-hidden
          ${
            mobileView === "chat"
              ? "flex w-full md:w-auto md:flex-1"
              : "hidden md:flex"
          }
        `}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-blue-600/10 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-3xl m-4 flex flex-col items-center justify-center gap-2 pointer-events-none animate-in fade-in duration-150">
            <div className="w-16 h-16 rounded-full bg-blue-50/90 dark:bg-zinc-800/90 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-lg">
              <Paperclip className="w-8 h-8 animate-pulse" />
            </div>
            <p className="text-blue-600 dark:text-blue-400 font-medium text-sm">Drop files here to send (max 50MB total)</p>
          </div>
        )}
        {selectedChat ? (
          <Fragment>
            {/* Chat Header */}
            <div className="h-14 md:h-16 bg-white flex flex-col justify-center px-3 md:px-6 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm z-10 relative flex-shrink-0 min-w-0">
              {selectedChat.isAi ? (
                <div className="flex items-center justify-between w-full min-w-0 gap-2">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <button
                      className="md:hidden p-2.5 -ml-2 text-gray-500 active:text-blue-600 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
                      onClick={() => setMobileView("sidebar")}
                      aria-label="Back to chats"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center p-1.5 shadow-sm ring-2 ring-indigo-200 dark:ring-indigo-900 border border-gray-100 dark:border-zinc-700">
                        <AiIcon className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-zinc-900 animate-pulse"></div>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                        {selectedChat.chatName}
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full font-medium border border-indigo-200 dark:border-indigo-800 hidden sm:flex items-center gap-1 flex-shrink-0">
                          <AiIcon className="w-3 h-3" /> AI Assistant
                        </span>
                      </h2>
                      {isAiThinking ? (
                        <p className="text-xs text-indigo-500 font-medium animate-pulse truncate">
                          Thinking & reasoning...
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium truncate">
                          Online • Ready to chat
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                    {/* Search Mode Selector */}
                    <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-gray-200/80 dark:border-zinc-700 text-[11px] flex-shrink-0">
                      {(
                        [
                          { id: "auto", label: "Auto" },
                          { id: "always", label: "Always" },
                          { id: "off", label: "Off" },
                        ] as const
                      ).map((m) => {
                        const isCurrent = aiSearchMode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setAiSearchMode(m.id);
                              if (typeof window !== "undefined") {
                                localStorage.setItem("zline_ai_search_mode", m.id);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                              isCurrent
                                ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                                : "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200"
                            }`}
                            title={`Search mode: ${m.label}`}
                          >
                            {m.id === "auto" && <Globe className="w-3 h-3 text-blue-500" />}
                            {m.id === "always" && <Search className="w-3 h-3 text-purple-500" />}
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleClearAiChat}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                      title="Reset conversation"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">New Session</span>
                    </button>

                    {renderSizeControlsPopover()}
                  </div>
                </div>
              ) : localSearchMode ? (
                <ChatSearch
                  messages={messages}
                  onClose={() => { setLocalSearchMode(false); setLocalSearchQuery(""); }}
                  onScrollToMessage={handleScrollToMessage}
                  initialQuery={localSearchQuery}
                />
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Back button — only on mobile */}
                    <button
                      className="md:hidden p-2.5 -ml-2 text-gray-500 active:text-blue-600 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors"
                      onClick={() => setMobileView("sidebar")}
                      aria-label="Back to chats"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="relative">
                      <UserAvatar
                        image={selectedChat.chatImage || selectedChat.otherUser?.image}
                        name={selectedChat.chatName}
                        className="w-10 h-10"
                        variant="gray"
                      />
                      {selectedChat.isOnline && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-zinc-900"></div>
                      )}
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>{selectedChat.chatName}</span>
                        {(recipientPublicKey || targetRecipientDevices.length > 0) && (
                          <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-950/20 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5" title="End-to-End Encrypted (v3.0 Multi-Device)">
                            🔒 E2EE v3.0
                          </span>
                        )}
                        {!selectedChat.isAi && (
                          <button
                            type="button"
                            onClick={() => setShowTimerModal(true)}
                            className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-colors"
                            title="Disappearing messages timer (click to configure)"
                          >
                            <Clock className="w-3 h-3" />
                            <span>⏱️ {formatTimerLabel(selectedChat.disappearingTimer)}</span>
                          </button>
                        )}
                      </h2>
                      {typingUser === selectedChat.otherUser?._id ? (
                        <p className="text-xs text-blue-500 animate-pulse">Typing...</p>
                      ) : selectedChat.isOnline ? (
                        <p className="text-xs text-green-500">Online</p>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-zinc-400">Offline</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 md:gap-1">
                    {/* Block / Unblock Button (only for 1-to-1 chats) */}
                    {!selectedChat.isGroup && selectedChat.otherUser?._id && (
                      <button
                        onClick={async () => {
                          const isBlocked = blockedUsers.includes(selectedChat.otherUser._id);
                          const method = isBlocked ? "DELETE" : "POST";
                          const res = await fetch(
                            isBlocked
                              ? `/api/users/block?userId=${selectedChat.otherUser._id}`
                              : "/api/users/block",
                            {
                              method,
                              headers: { "Content-Type": "application/json" },
                              body: isBlocked ? undefined : JSON.stringify({ userId: selectedChat.otherUser._id }),
                            }
                          );
                          if (res.ok) {
                            setBlockedUsers((prev) =>
                              isBlocked
                                ? prev.filter((id) => id !== selectedChat.otherUser._id)
                                : [...prev, selectedChat.otherUser._id]
                            );
                          }
                        }}
                        className={`p-2 transition-colors ${
                          blockedUsers.includes(selectedChat.otherUser._id)
                            ? "text-red-600 hover:text-red-700"
                            : "text-gray-500 hover:text-red-500"
                        }`}
                        title={blockedUsers.includes(selectedChat.otherUser._id) ? "Unblock user" : "Block user"}
                      >
                        <UserX className="h-5 w-5" />
                      </button>
                    )}
                    {/* Audio Call */}
                    <button
                      onClick={() => {
                        if (selectedChat.isGroup) {
                          window.dispatchEvent(new CustomEvent("zline:initiate_group_call", { detail: { chatId: selectedChat._id, groupName: selectedChat.chatName, callType: "audio" } }));
                        } else {
                          window.dispatchEvent(new CustomEvent("zline:initiate_call", { detail: { calleeId: selectedChat.otherUser?._id, calleeName: selectedChat.chatName, callType: "audio" } }));
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-green-600 transition-colors"
                      title="Audio call"
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    {/* Video Call */}
                    <button
                      onClick={() => {
                        if (selectedChat.isGroup) {
                          window.dispatchEvent(new CustomEvent("zline:initiate_group_call", { detail: { chatId: selectedChat._id, groupName: selectedChat.chatName, callType: "video" } }));
                        } else {
                          window.dispatchEvent(new CustomEvent("zline:initiate_call", { detail: { calleeId: selectedChat.otherUser?._id, calleeName: selectedChat.chatName, callType: "video" } }));
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Video call"
                    >
                      <Video className="h-5 w-5" />
                    </button>
                    {/* Pinned Messages Panel Toggle */}
                    <button
                      onClick={() => setShowPinnedPanel(true)}
                      className="p-2 text-gray-500 hover:text-orange-500 transition-colors relative"
                      title="Pinned messages"
                    >
                      <Pin className="h-5 w-5" />
                      {selectedChat.pinnedMessages?.length > 0 && (
                        <span className="absolute top-1 right-1 bg-orange-500 text-white rounded-full text-[8px] w-3.5 h-3.5 flex items-center justify-center font-bold">
                          {selectedChat.pinnedMessages.length}
                        </span>
                      )}
                    </button>
                    {/* Search */}
                    <button 
                      onClick={() => setLocalSearchMode(true)}
                      className="p-2 text-gray-500 hover:text-blue-600 transition-colors" 
                      title="Search in chat"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                    {/* Catch Me Up (AI Briefing) */}
                    {!selectedChat.isAi && messages.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleCatchMeUp}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Catch Me Up — AI Conversation Summary & Action Items"
                        aria-label="Catch Me Up AI Summary"
                      >
                        <Sparkles className="h-5 w-5" />
                      </button>
                    )}
                    {/* Export Chat */}
                    <button
                      type="button"
                      onClick={handleExportChat}
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      title="Export Chat History (Download Decrypted Conversation)"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    {/* Disappearing Timer */}
                    {!selectedChat.isAi && (
                      <button
                        type="button"
                        onClick={() => setShowTimerModal(true)}
                        className="p-2 text-gray-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                        title="Disappearing Messages Timer"
                      >
                        <Clock className="h-5 w-5" />
                      </button>
                    )}
                    {/* Display & Sizing Popover */}
                    {renderSizeControlsPopover()}
                  </div>
                </div>
              )}
            </div>

            {/* Messages — scrollable area with momentum scrolling on iOS */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 space-y-3 scroll-touch min-w-0"
            >
              {filteredMessages.map((message, index) => {
                const isMe = message.sender === session?.user?.id || message.sender?._id === session?.user?.id;
                const isHighlighted = localSearchQuery.trim() &&
                  message.content?.toLowerCase().includes(localSearchQuery.toLowerCase());
                const expiresAt = message.expiresAt ? new Date(message.expiresAt) : null;
                const isExpired = expiresAt && expiresAt < new Date();

                if (message.deletedForEveryone) {
                  return (
                    <div ref={(el) => { messageRefs.current[message._id] = el; }} key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className="bg-gray-200 dark:bg-zinc-800 rounded-2xl px-4 py-2 opacity-60 italic text-xs text-gray-500">
                        This message was deleted
                      </div>
                    </div>
                  );
                }

                // ── Poll bubble ────────────────────────────────────────
                if (message.type === "poll" && message.poll) {
                  const poll = message.poll;
                  const totalVotes = poll.options.reduce((s: number, o: any) => s + (o.votes?.length || 0), 0);
                  const myVoteIdx = poll.options.findIndex((o: any) => o.votes?.includes(session?.user?.id));

                  return (
                    <div ref={(el) => { messageRefs.current[message._id] = el; }} key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[320px] w-full rounded-2xl overflow-hidden shadow-sm ${
                        isMe ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                      }`}>
                        {/* Poll header */}
                        <div className="px-4 pt-3 pb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <BarChart2 className={`w-4 h-4 flex-shrink-0 ${isMe ? "text-blue-200" : "text-blue-500"}`} />
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMe ? "text-blue-200" : "text-blue-500"}`}>
                              {poll.isEnded ? "Poll ended" : "Poll"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold leading-snug">{poll.question}</p>
                        </div>
                        {/* Options */}
                        <div className="px-3 pb-2 space-y-2">
                          {poll.options.map((opt: any, idx: number) => {
                            const count = opt.votes?.length || 0;
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                            const isMyVote = myVoteIdx === idx;
                            const canVote = !poll.isEnded;
                            return (
                              <button
                                key={idx}
                                disabled={!canVote}
                                onClick={() => handleVote(message._id, idx)}
                                className={`w-full text-left rounded-xl overflow-hidden relative ${
                                  canVote ? "hover:opacity-90 active:scale-[0.99] cursor-pointer" : "cursor-default"
                                } ${isMyVote ? "ring-2 ring-white/50" : ""}`}
                              >
                                {/* Progress bar bg */}
                                <div
                                  className={`absolute inset-0 transition-all duration-500 ${
                                    isMe ? "bg-blue-400/40" : "bg-blue-100 dark:bg-blue-900/40"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    {isMyVote && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                                    <span className="text-xs font-medium">{opt.text}</span>
                                  </div>
                                  <span className="text-[10px] opacity-75 ml-2 flex-shrink-0">{pct}%</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {/* Footer */}
                        <div className={`px-4 pb-3 pt-1 flex items-center justify-between text-[10px] ${
                          isMe ? "text-blue-200" : "text-gray-400 dark:text-zinc-400"
                        }`}>
                          <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                          <div className="flex items-center gap-3">
                            {isMe && !poll.isEnded && (
                              <button onClick={() => handleEndPoll(message._id)} className="underline opacity-80 hover:opacity-100">
                                End poll
                              </button>
                            )}
                            <span>{message.createdAt ? format(new Date(message.createdAt), "HH:mm") : ""}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Group reactions by emoji for display
                const reactionGroups: Record<string, { count: number; users: string[]; myReaction: boolean }> = {};
                if (message.reactions?.length) {
                  for (const r of message.reactions) {
                    if (!reactionGroups[r.emoji]) {
                      reactionGroups[r.emoji] = { count: 0, users: [], myReaction: false };
                    }
                    reactionGroups[r.emoji].count++;
                    reactionGroups[r.emoji].users.push(r.userId);
                    if (r.userId === session?.user?.id || r.userId?.toString() === session?.user?.id) {
                      reactionGroups[r.emoji].myReaction = true;
                    }
                  }
                }
                const hasReactions = Object.keys(reactionGroups).length > 0;

                return (
                  <div ref={(el) => { messageRefs.current[message._id] = el; }} key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"} min-w-0`}>
                    <div className={`relative group min-w-0 ${message.isAi ? "max-w-[92%] sm:max-w-[88%] md:max-w-[80%]" : "max-w-[85%] md:max-w-[70%]"}`}>
                      {/* Reaction and Actions trigger buttons — visible on hover (desktop) */}
                      {message._id && !message.isAi && (
                        <div className={`absolute ${isMe ? "-left-16" : "-right-16"} top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10`}>
                          <button
                            onClick={() => setActiveReactionMsgId(activeReactionMsgId === message._id ? null : message._id)}
                            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 cursor-pointer"
                            title="React"
                          >
                            <SmilePlus className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                          </button>
                          <button
                            onClick={() => setActiveMessageActionId(activeMessageActionId === message._id ? null : message._id)}
                            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 cursor-pointer"
                            title="Actions"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-zinc-500 rotate-90" />
                          </button>
                        </div>
                      )}

                      {/* Emoji picker popup */}
                      {activeReactionMsgId === message._id && (
                        <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 z-20 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-gray-200 dark:border-zinc-700 px-2 py-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150`}>
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(message._id, emoji)}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 text-lg transition-transform hover:scale-125 cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Actions popup */}
                      {activeMessageActionId === message._id && (
                        <MessageActions
                          message={message}
                          isMe={isMe}
                          onReply={(msg) => setReplyingTo(msg)}
                          onEdit={(msg) => {
                            setEditingMessage(msg);
                            setNewMessage(msg.content || "");
                          }}
                          onDelete={handleDeleteMessage}
                          onPin={handlePinMessage}
                          onUnpin={handleUnpinMessage}
                          onStar={handleStarMessage}
                          onUnstar={handleUnstarMessage}
                          onTranslate={handleTranslateMessage}
                          isPinned={selectedChat?.pinnedMessages?.includes(message._id) || false}
                          isStarred={starredMessageIds.includes(message._id)}
                          onClose={() => setActiveMessageActionId(null)}
                        />
                      )}

                      <div className={`w-full rounded-2xl overflow-hidden break-words min-w-0 ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white text-gray-900 rounded-bl-sm shadow-sm dark:bg-zinc-800 dark:text-white"
                      } ${isHighlighted ? "ring-2 ring-yellow-400 shadow-md" : ""}`}>

                        {/* Sender name (for group chats, if not me) */}
                        {selectedChat.isGroup && !isMe && (
                          <div className="px-4 pt-2 pb-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-none">
                            {message.sender?.name || "Group Member"}
                          </div>
                        )}

                        {/* AI Sender header */}
                        {message.isAi && (
                          <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            <AiIcon className="w-3.5 h-3.5" />
                            <span>Zino</span>
                          </div>
                        )}

                        {/* Reply quote preview */}
                        {message.replyTo && (
                          <div className="px-4 pt-2 pb-0.5">
                            <ReplyPreview
                              replyMessage={message.replyTo}
                              currentUserId={session?.user?.id}
                              isInputStrip={false}
                              onClick={() => {
                                const targetId = typeof message.replyTo === "object" ? message.replyTo._id : message.replyTo;
                                handleScrollToMessage(targetId);
                              }}
                            />
                          </div>
                        )}

                        {/* Image */}
                        {message.type === "image" && message.fileUrl && !isExpired && (
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={message.fileUrl}
                              alt={message.fileName || "Image"}
                              className="max-w-[260px] max-h-[260px] object-cover w-full"
                            />
                            <a
                              href={message.fileUrl}
                              download={message.fileName || "image"}
                              className="absolute top-2 right-2 bg-black/50 rounded-full p-1 hover:bg-black/70 transition-colors"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5 text-white" />
                            </a>
                          </div>
                        )}

                        {/* File */}
                        {message.type === "file" && message.fileUrl && !isExpired && (
                          <div className="px-4 py-3 flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isMe ? "bg-blue-500" : "bg-gray-100 dark:bg-zinc-700"
                            }`}>
                              {getFileIcon(message.fileName || "File")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{message.fileName || "File"}</p>
                              {message.fileSize && (
                                <p className={`text-[10px] ${isMe ? "text-blue-200" : "text-gray-400 dark:text-zinc-400"}`}>
                                  {(message.fileSize / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              )}
                            </div>
                            <a
                              href={message.fileUrl}
                              download={message.fileName || "file"}
                              className={`flex-shrink-0 p-1.5 rounded-full ${
                                isMe ? "bg-blue-500 hover:bg-blue-400" : "bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                              } transition-colors`}
                              title="Download"
                            >
                              <Download className={`w-3.5 h-3.5 ${isMe ? "text-white" : "text-gray-600 dark:text-zinc-300"}`} />
                            </a>
                          </div>
                        )}

                        {/* Custom Voice Player */}
                        {message.type === "voice" && message.fileUrl && !isExpired && (
                          <VoicePlayer
                            src={message.fileUrl}
                            duration={message.voiceDuration}
                            isMe={isMe}
                          />
                        )}

                        {/* Expired media placeholder */}
                        {message.type !== "text" && isExpired && (
                          <div className="px-4 py-3 opacity-50 italic text-xs">
                            {message.type === "image" ? "📷" : message.type === "voice" ? "🎤" : "📎"} This media has expired
                          </div>
                        )}

                        {/* Text content */}
                        {(message.type === "text" || message.content) && (
                          <div className="px-4 py-2">
                            {message.isAi ? (
                              <FormattedAiContent content={message.content} fontSize={chatFontSize} />
                            ) : (
                              <p className={`${
                                {
                                  sm: "text-xs leading-relaxed",
                                  md: "text-sm leading-relaxed",
                                  lg: "text-base leading-relaxed",
                                  xl: "text-lg leading-relaxed",
                                }[chatFontSize] || "text-sm leading-relaxed"
                              } whitespace-pre-wrap break-words`}>
                                {renderTextWithLinks(message.content, isMe)}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Rich OpenGraph Link Preview */}
                        {!message.isAi && !isExpired && getFirstUrl(message.content) && (
                          <div className="px-4 pb-2">
                            <LinkPreviewCard url={getFirstUrl(message.content)!} isMe={isMe} />
                          </div>
                        )}

                        {/* Inline AI Translation */}
                        {translatedMessages[message._id] && (
                          <div className="px-4 pb-2">
                            <div className={`p-2.5 rounded-xl border text-xs ${
                              isMe
                                ? "bg-blue-700/40 border-blue-400/30 text-white"
                                : "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-gray-900 dark:text-zinc-100"
                            }`}>
                              <div className="flex items-center justify-between text-[10px] font-semibold opacity-80 mb-1">
                                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                  <Languages className="w-3 h-3" />
                                  AI Translation
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleTranslateMessage(message)}
                                  className="hover:underline opacity-70 cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                              {translatedMessages[message._id].loading ? (
                                <div className="flex items-center gap-2 py-1 text-gray-500">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Translating with Zino...</span>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{translatedMessages[message._id].text}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Source citations for web-grounded AI responses */}
                        {message.isAi && message.sources && message.sources.length > 0 && (
                          <div className="px-4 pb-2">
                            <SourceCitations sources={message.sources} query={message.searchQuery} />
                          </div>
                        )}

                        {/* Footer: time + expiry + status */}
                        <div className={`px-4 pb-2 text-[10px] flex justify-between items-center gap-2 ${
                          isMe ? "text-blue-100" : "text-gray-400 dark:text-zinc-400"
                        }`}>
                          <div className="flex items-center gap-1">
                            {expiresAt && !isExpired && (
                              <span className="opacity-75">🕐 {formatDistanceToNow(expiresAt, { addSuffix: true })}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {starredMessageIds.includes(message._id) && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 mr-0.5" />
                            )}
                            {selectedChat.pinnedMessages?.includes(message._id) && (
                              <Pin className="w-3 h-3 text-orange-500 mr-0.5 rotate-45" />
                            )}
                            <span>{message.createdAt ? format(new Date(message.createdAt), "HH:mm") : ""}</span>
                            {message.isEdited && <span className="italic">edited</span>}
                            {isMe && (() => {
                              const readEntry = message.readBy?.find((r: any) => {
                                const rId = typeof r.userId === 'object' && r.userId !== null ? r.userId._id : r.userId;
                                return rId?.toString() === selectedChat?.otherUser?._id?.toString();
                              });
                              const readAtStr = readEntry?.readAt ? format(new Date(readEntry.readAt), "HH:mm, dd/MM") : "";
                              return (
                                <span 
                                  className="ml-0.5 cursor-help" 
                                  title={readAtStr ? `Seen at ${readAtStr}` : message.status === "seen" ? "Seen" : message.status === "delivered" ? "Delivered" : "Sent"}
                                >
                                  {message.status === "seen" ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                                  ) : message.status === "delivered" ? (
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                      </div>

                      {/* Reaction badges below the message bubble */}
                      {hasReactions && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          {Object.entries(reactionGroups).map(([emoji, data]) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(message._id, emoji)}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors cursor-pointer ${
                                data.myReaction
                                  ? "bg-blue-100 border-blue-300 dark:bg-blue-900/40 dark:border-blue-700"
                                  : "bg-gray-100 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700"
                              }`}
                            >
                              <span>{emoji}</span>
                              {data.count > 1 && <span className="text-[10px] text-gray-600 dark:text-zinc-400">{data.count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {selectedChat?.isAi && isAiThinking && (
                <div className="flex justify-start my-2 min-w-0">
                  <div className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-indigo-100 dark:border-indigo-950/50 flex items-center gap-3.5 max-w-[92%] sm:max-w-[85%] md:max-w-[80%] min-w-0">
                    <div className="w-8 h-8 relative flex-shrink-0 flex items-center justify-center">
                      <OrbLoading size="sm" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {aiSearchStatus.stage === "searching"
                          ? "Searching the web..."
                          : aiSearchStatus.stage === "finding"
                          ? "Finding relevant webpages..."
                          : aiSearchStatus.stage === "browsing"
                          ? "Browsing selected websites..."
                          : aiSearchStatus.stage === "extracting"
                          ? "Extracting webpage information..."
                          : aiSearchStatus.stage === "analyzing"
                          ? `Analyzing research (${aiSearchStatus.sourceCount || "retrieved"} sources)...`
                          : aiSearchStatus.stage === "reasoning"
                          ? "Zino is reasoning..."
                          : "Generating response..."}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500 truncate max-w-xs">
                        {aiSearchStatus.stage === "searching" && aiSearchStatus.query
                          ? `Query: "${aiSearchStatus.query}"`
                          : aiSearchStatus.stage === "finding"
                          ? `Discovered ${aiSearchStatus.sourceCount || 0} candidate pages`
                          : aiSearchStatus.stage === "browsing"
                          ? aiSearchStatus.url ? `Navigating: ${aiSearchStatus.url}` : "Obscura headless browser rendering dynamic pages"
                          : aiSearchStatus.stage === "extracting"
                          ? "Cleaning DOM and parsing structured content"
                          : aiSearchStatus.stage === "analyzing"
                          ? "Synthesizing evidence and citations"
                          : aiSearchStatus.stage === "reasoning"
                          ? "Evaluating logic and formulating response"
                          : "Fast, intelligent answer powered by Zino"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {selectedChat?.isAi && messages.length <= 1 && (
                <div className="my-3 px-2 space-y-2">
                  <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">Suggested questions to try:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "How does Zline's v3.0 multi-device encryption work?",
                      "How do I link a new phone or laptop?",
                      "How do I resize the chat list and adjust font size?",
                      "Which number is larger, 9.11 or 9.8?",
                      "How do disappearing messages and voice notes work in Zline?",
                    ].map((prompt, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() => {
                          setNewMessage(prompt);
                        }}
                        className="text-left text-xs bg-white dark:bg-zinc-800/90 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500 px-3 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        💡 {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input — sticks to bottom, respects iOS safe area */}
            <div className="px-2 md:px-4 pb-2 md:pb-4 pt-2 bg-[#F0F2F5] dark:bg-zinc-900 flex-shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
              {/* Error toast */}
              {mediaError && (
                <div className="mb-2 px-3 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center justify-between gap-2">
                  <span>{mediaError}</span>
                  <button onClick={() => setMediaError(null)}><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* Multi-File Upload Progress */}
              {uploadProgress !== null && (
                <div className="mb-2 bg-white dark:bg-zinc-900 rounded-xl p-3 border border-gray-200 dark:border-zinc-700 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-gray-700 dark:text-zinc-300 font-medium mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      Uploading file {uploadProgress.current} of {uploadProgress.total}...
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{uploadProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Multi-File Pending Preview / Send Confirmation */}
              {pendingFiles.length > 0 && uploadProgress === null && (() => {
                const totalBytes = pendingFiles.reduce((acc, p) => acc + p.file.size, 0);
                const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
                const maxMb = 50;
                const isNearLimit = totalBytes > 40 * 1024 * 1024;

                return (
                  <div className="mb-2 bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-md border border-gray-200 dark:border-zinc-800 relative animate-in slide-in-from-bottom-2 duration-200">
                    {/* Header bar: Count, total size, add more, clear all */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-zinc-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 dark:text-zinc-100 flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                          {pendingFiles.length} {pendingFiles.length === 1 ? "file selected" : "files selected"}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          isNearLimit 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        }`}>
                          {totalMb} MB / {maxMb} MB
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          title="Add more files"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add more
                        </button>
                        <button
                          type="button"
                          onClick={clearPendingFiles}
                          className="text-[11px] text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="Remove all files"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    {/* Horizontal Scroll of File Cards */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 max-h-[110px] scrollbar-thin">
                      {pendingFiles.map((item) => {
                        const isImg = item.file.type.startsWith("image/");
                        const sizeStr = item.file.size > 1024 * 1024
                          ? `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`
                          : `${Math.round(item.file.size / 1024)} KB`;

                        return (
                          <div
                            key={item.id}
                            className="relative flex-shrink-0 flex items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-800/80 rounded-xl border border-gray-200/80 dark:border-zinc-700/60 max-w-[210px] group"
                          >
                            {isImg && item.previewUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                                {getFileIcon(item.file.name)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-800 dark:text-zinc-200 truncate" title={item.file.name}>
                                {item.file.name}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                                {sizeStr}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePendingFile(item.id)}
                              className="w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors flex-shrink-0 cursor-pointer"
                              title={`Remove ${item.file.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Send All Action Footer */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-zinc-800">
                      <span className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                        Add optional caption in text box below
                      </span>
                      <button
                        type="button"
                        onClick={uploadAndSendPendingFiles}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        Send All ({pendingFiles.length})
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Poll creation form */}
              {showPollForm && (
                <div className="mb-3 bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow border border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-blue-500" /> Create Poll
                    </span>
                    <button onClick={() => { setShowPollForm(false); setPollQuestion(""); setPollOptions(["", ""]); }}>
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ask a question..."
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500"
                  />
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => { const o = [...pollOptions]; o[idx] = e.target.value; setPollOptions(o); }}
                        className="flex-1 text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500"
                      />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}>
                          <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between mt-1">
                    {pollOptions.length < 4 ? (
                      <button
                        onClick={() => setPollOptions([...pollOptions, ""])}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add option
                      </button>
                    ) : <span />}
                    <button
                      onClick={handleCreatePoll}
                      disabled={pollLoading || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full disabled:opacity-50 transition-colors"
                    >
                      {pollLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Poll"}
                    </button>
                  </div>
                </div>
              )}
              {/* Reply preview banner */}
              {replyingTo && (
                <ReplyPreview
                  replyMessage={replyingTo}
                  currentUserId={session?.user?.id}
                  isInputStrip={true}
                  onCancel={() => setReplyingTo(null)}
                />
              )}

              {/* Editing Banner */}
              {editingMessage && (
                <div className="flex items-center justify-between px-3 py-2 mb-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 animate-in slide-in-from-bottom duration-150">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      Editing message
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{editingMessage.content}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingMessage(null);
                      setNewMessage("");
                    }}
                    className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-500 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Attach menu and Input form / Block banner */}
              {selectedChat.otherUser?._id && blockedUsers.includes(selectedChat.otherUser._id) ? (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs rounded-xl p-3 text-center">
                  You have blocked this contact. Unblock them to send messages.
                </div>
              ) : (
                <div className="relative">
                  {/* Hidden file input (supports multiple files, max 50MB per selection) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {showAttachMenu && (
                    <div className="absolute bottom-14 left-0 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-700 py-2 z-10 min-w-[160px]">
                      <button
                        type="button"
                        onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 cursor-pointer"
                      >
                        <Paperclip className="w-4 h-4 text-blue-500" /> Attach File(s)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowAttachMenu(false); setShowPollForm(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 cursor-pointer"
                      >
                        <BarChart2 className="w-4 h-4 text-purple-500" /> Create Poll
                      </button>
                    </div>
                  )}
                  <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 md:gap-2 bg-white dark:bg-zinc-950 p-1.5 md:p-2 rounded-full shadow-sm">
                    {/* Attach / Poll menu toggle */}
                    <button
                      type="button"
                      disabled={selectedChat?.isAi || isUploading}
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer ${
                        showAttachMenu ? "bg-blue-600 text-white" : "text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800"
                      }`}
                      title={selectedChat?.isAi ? "Attachments disabled with AI assistant" : "Attach / Poll"}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </button>

                    <input
                      type="text"
                      value={newMessage}
                      onChange={handleTyping}
                      placeholder={selectedChat?.isAi ? "Ask Zino anything..." : pendingFiles.length > 0 ? "Add a caption (optional)..." : "Type a message..."}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-sm px-2 dark:text-white outline-none"
                    />

                    {/* Custom Voice Recorder */}
                    {!selectedChat?.isAi && pendingFiles.length === 0 && (
                      <VoiceRecorder
                        onSend={handleVoiceSend}
                        disabled={isUploading}
                      />
                    )}

                    {/* Send text or pending file */}
                    <button
                      type="submit"
                      disabled={(!newMessage.trim() && pendingFiles.length === 0) || isUploading}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer"
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </Fragment>
        ) : (
          /* Welcome screen — only shows on md+ since mobile always shows sidebar */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8">
            <Logo className="h-16 w-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2 dark:text-white">
              Welcome to Zline
            </h2>
            <p className="text-gray-500 max-w-sm dark:text-zinc-400">
              Select a chat or search for a user to start messaging.
            </p>
          </div>
        )}
      </div>

      {/* ── Global Call Modal ── */}
      {session?.user?.id && (
        <CallModal
          socket={socket}
          currentUserId={session.user.id}
          currentUserName={session.user.name || "User"}
        />
      )}

      {/* ── Group Call Modal ── */}
      {session?.user?.id && (
        <GroupCallModal
          socket={socket}
          currentUserId={session.user.id}
          currentUserName={session.user.name || "User"}
        />
      )}

      {/* ── Disappearing Messages Timer Modal ── */}
      {showTimerModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="relative w-[calc(100%-2rem)] max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl m-4 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowTimerModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Disappearing Messages
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {selectedChat.chatName}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-zinc-400 my-3 leading-relaxed">
              New messages in this chat will vanish after the selected duration to protect privacy and save server storage. You can export the chat before expiry. Maximum retention is 7 days.
            </p>

            <div className="space-y-2 my-4">
              {TIMER_OPTIONS.map((opt) => {
                const isSelected = (selectedChat.disappearingTimer || 604800) === opt.seconds;
                return (
                  <button
                    key={opt.seconds}
                    disabled={timerLoading}
                    onClick={() => handleSetDisappearingTimer(opt.seconds)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-gray-900 dark:text-white ring-1 ring-blue-600"
                        : "border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-gray-700 dark:text-zinc-300"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {opt.label}
                        {opt.seconds === 604800 && (
                          <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-500 px-1.5 py-0.5 rounded font-normal">
                            Max (Default)
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400">{opt.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 dark:border-zinc-600"
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowTimerModal(false);
                  handleExportChat();
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export chat now
              </button>
              <button
                type="button"
                onClick={() => setShowTimerModal(false)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-full text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Catch Me Up AI Briefing Modal ── */}
      {showCatchMeUpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowCatchMeUpModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Catch Me Up
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  AI Briefing for {selectedChat?.chatName || "Conversation"}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-3 min-h-[160px]">
              {catchMeUpLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                    Zino is reading decrypted messages...
                  </p>
                  <p className="text-xs text-gray-400 max-w-xs">
                    Extracting key decisions, highlights, and action items with client-side zero-knowledge privacy.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-gray-800 dark:text-zinc-200 leading-relaxed">
                  <FormattedAiContent content={catchMeUpSummary} fontSize={chatFontSize} />
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">
                ⚡ Powered by Zino AI
              </p>
              <div className="flex items-center gap-2">
                {catchMeUpSummary && !catchMeUpLoading && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(catchMeUpSummary);
                      setCatchMeUpCopied(true);
                      setTimeout(() => setCatchMeUpCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {catchMeUpCopied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Briefing</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCatchMeUpModal(false)}
                  className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Group Modal ── */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="relative w-[calc(100%-2rem)] max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl m-4 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowCreateGroupModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Create New Group
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  Group Name
                </label>
                <input 
                  type="text"
                  autoComplete="off"
                  placeholder="Enter group name..."
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  className="w-full text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-zinc-500 transition-colors"
                  style={{ color: resolvedTheme === 'dark' ? '#ffffff' : '#111827' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  Select Members ({selectedGroupMembers.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-zinc-800 rounded-xl divide-y divide-gray-50 dark:divide-zinc-800">
                  {allUsers.length === 0 ? (
                    <p className="text-center py-4 text-xs text-gray-400">No other users found</p>
                  ) : (
                    allUsers.map((user) => {
                      const isSelected = selectedGroupMembers.includes(user._id);
                      return (
                        <button
                          key={user._id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== user._id));
                            } else {
                              setSelectedGroupMembers([...selectedGroupMembers, user._id]);
                            }
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              image={user.image}
                              name={user.name}
                              className="w-8 h-8"
                              textClassName="text-xs"
                            />
                            <div>
                              <p className="text-xs font-semibold text-gray-900 dark:text-white">{user.name}</p>
                              <p className="text-[10px] text-gray-500 dark:text-zinc-400 truncate max-w-[200px]">{user.email}</p>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected ? "bg-blue-600 border-blue-600 text-white animate-in zoom-in-50" : "border-gray-300 dark:border-zinc-600"
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={groupLoading || !groupNameInput.trim() || selectedGroupMembers.length === 0}
                  onClick={handleCreateGroup}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {groupLoading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Pinned Messages Panel ── */}
      <PinnedMessages
        chatId={selectedChat?._id || selectedChat?.otherUser?._id}
        isOpen={showPinnedPanel}
        onClose={() => setShowPinnedPanel(false)}
        onScrollToMessage={handleScrollToMessage}
        onUnpin={handleUnpinMessage}
        pinnedCount={selectedChat?.pinnedMessages?.length || 0}
      />

      {/* ── Starred Messages Panel ── */}
      <StarredMessages
        isOpen={showStarredPanel}
        onClose={() => setShowStarredPanel(false)}
        onNavigateToChat={(chatId, messageId) => {
          const chat = chats.find((c) => c._id === chatId);
          if (chat) {
            setSelectedChat(chat);
            setMobileView("chat");
            setTimeout(() => {
              handleScrollToMessage(messageId);
            }, 600);
          }
        }}
      />

      {/* ── Settings Panel ── */}
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => {
          setShowSettingsPanel(false);
          fetch("/api/users/block")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
              if (Array.isArray(data)) setBlockedUsers(data.map((u: any) => u._id));
            });
          fetch("/api/users/settings")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.settings?.theme) setTheme(data.settings.theme);
            });
        }}
        session={session}
      />

      {/* ── Avatar Modal (Onboarding & Quick Spin) ── */}
      <AvatarModal
        isOpen={showAvatarPicker}
        isOnboarding={isAvatarOnboarding}
        onClose={() => {
          setShowAvatarPicker(false);
          if (isAvatarOnboarding && typeof window !== "undefined") {
            localStorage.setItem("zline_avatar_dismissed", "true");
          }
        }}
        onSuccess={() => {
          setShowAvatarPicker(false);
          if (typeof window !== "undefined") {
            localStorage.setItem("zline_avatar_dismissed", "true");
          }
          fetchChats();
        }}
        initialName={session?.user?.name || "Zline User"}
      />
    </div>
  );
}
