"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback, Fragment } from "react";
import { useSocket } from "@/components/SocketProvider";
import {
  MessageCircle, LogOut, Send, Loader2, Check, CheckCheck,
  Search, ArrowLeft, Plus, X, Paperclip, Mic, StopCircle, Download, FileText,
  Phone, Video, BarChart2, ChevronRight, CheckCircle2, SmilePlus,
  Image as ImageIcon, Music, Film, Code2, Archive, File, Users,
  PhoneCall, PhoneMissed, PhoneIncoming, PhoneOutgoing, MessageSquare,
  Pin, Star, Settings, User, UserX, Sun, Moon, Sparkles, RotateCcw, Bot, Globe, Compass, Cpu, Brain
} from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import CallModal from "@/components/CallModal";
import GroupCallModal from "@/components/GroupCallModal";
import Logo from "@/components/Logo";
import { generateE2EKeypair, exportKeyToJwk, encryptMessage, decryptMessage } from "@/lib/crypto";

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

function FormattedAiContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-sm space-y-2 leading-relaxed break-words min-w-0">
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
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  const router = useRouter();
  const { socket, isConnected } = useSocket();

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
  const [isRecording, setIsRecording] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // File sharing enhanced states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);

  // Group creation states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);

  // E2EE States
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);

  // New features states
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [activeMessageActionId, setActiveMessageActionId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [showStarredPanel, setShowStarredPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [starredMessageIds, setStarredMessageIds] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [userSettings, setUserSettings] = useState<any>(null);

  // Zline AI Assistant states
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiLatestMessage, setAiLatestMessage] = useState<{ content: string; createdAt: string } | null>(null);
  const [aiSearchMode, setAiSearchMode] = useState<"auto" | "always" | "off">("auto");
  const [aiSearchStatus, setAiSearchStatus] = useState<{
    stage: "idle" | "searching" | "finding" | "browsing" | "extracting" | "analyzing" | "reasoning" | "generating";
    query?: string;
    sourceCount?: number;
    url?: string;
    siteName?: string;
  }>({ stage: "idle" });

  // Load saved AI search mode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("zline_ai_search_mode") as "auto" | "always" | "off" | null;
      if (savedMode === "auto" || savedMode === "always" || savedMode === "off") {
        setAiSearchMode(savedMode);
      }
    }
  }, []);

  // Refs for message elements for scrolling
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Load or generate E2EE keys
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    const setupE2EKeys = async () => {
      try {
        const userPrivKeyName = `zline_e2e_private_key_${session.user.id}`;
        const userPubKeyName = `zline_e2e_public_key_${session.user.id}`;

        let privateKeyJwk = localStorage.getItem(userPrivKeyName);
        let publicKeyJwk = localStorage.getItem(userPubKeyName);

        // Fallback to legacy non-user-specific keys
        if (!privateKeyJwk || !publicKeyJwk) {
          const legacyPriv = localStorage.getItem("zline_e2e_private_key");
          const legacyPub = localStorage.getItem("zline_e2e_public_key");
          if (legacyPriv && legacyPub) {
            privateKeyJwk = legacyPriv;
            publicKeyJwk = legacyPub;
            localStorage.setItem(userPrivKeyName, privateKeyJwk);
            localStorage.setItem(userPubKeyName, publicKeyJwk);
            localStorage.removeItem("zline_e2e_private_key");
            localStorage.removeItem("zline_e2e_public_key");
          }
        }

        if (!privateKeyJwk || !publicKeyJwk) {
          console.log("Generating new E2EE keys...");
          const keypair = await generateE2EKeypair();
          privateKeyJwk = await exportKeyToJwk(keypair.privateKey);
          publicKeyJwk = await exportKeyToJwk(keypair.publicKey);
          localStorage.setItem(userPrivKeyName, privateKeyJwk);
          localStorage.setItem(userPubKeyName, publicKeyJwk);
        }

        // Upload to server
        await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: publicKeyJwk }),
        });
        console.log("E2EE public key verified and updated on server");
      } catch (err) {
        console.error("Failed to setup E2EE keys:", err);
      }
    };

    setupE2EKeys();
  }, [status, session?.user?.id]);

  // Fetch recipient public key when selected chat changes
  useEffect(() => {
    if (selectedChat?.isAi) {
      setRecipientPublicKey(null);
      return;
    }
    if (selectedChat && !selectedChat.isGroup && selectedChat.otherUser?._id) {
      setRecipientPublicKey(null);
      fetch(`/api/keys?userId=${selectedChat.otherUser._id}`)
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data) => {
          if (data?.publicKey) {
            setRecipientPublicKey(data.publicKey);
          }
        })
        .catch((err) => console.error("Error fetching public key:", err));
    } else {
      setRecipientPublicKey(null);
    }
  }, [selectedChat?._id, selectedChat?.isGroup, selectedChat?.otherUser?._id, selectedChat?.isAi]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          if (data?.settings) {
            setUserSettings(data.settings);
            if (data.settings.theme) {
              setTheme(data.settings.theme);
            }
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
  }, [status, session?.user?.id]);

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

  // Decrypts an array of messages using our private key
  const decryptMessagesArray = useCallback(async (msgs: any[]) => {
    if (typeof window === "undefined") return msgs;
    if (!session?.user?.id) return msgs;
    const myPrivateKey = localStorage.getItem(`zline_e2e_private_key_${session.user.id}`);
    if (!myPrivateKey) return msgs;

    return await Promise.all(
      msgs.map(async (m) => {
        if (m.isEncrypted && m.iv) {
          try {
            // Check if current user is the sender (sender can be populated object or just ID string)
            const senderId = typeof m.sender === "object" && m.sender !== null ? m.sender._id : m.sender;
            const isSender = senderId === session.user.id;
            
            // For sender, use encAesKeyForSender (fallback to encAesKey if not present)
            const aesKeyToDecrypt = isSender ? (m.encAesKeyForSender || m.encAesKey) : m.encAesKey;

            if (!aesKeyToDecrypt) {
              throw new Error("No AES key found for decryption");
            }

            const plaintext = await decryptMessage(m.content, aesKeyToDecrypt, m.iv, myPrivateKey);
            return { ...m, content: plaintext };
          } catch (err) {
            console.error("Failed to decrypt message:", m._id, err);
            return { ...m, content: "🔒 Decryption failed" };
          }
        }
        return m;
      })
    );
  }, [session?.user?.id]);

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
    } catch (error) {
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
    } catch (error) {
      console.error("Failed to fetch calls", error);
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
      } catch (e) { console.error("Search failed"); }
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
    } catch (error) { console.error("Failed to fetch messages"); }
  }, [socket, session, decryptMessagesArray]);

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
        content: "👋 Hello! I am **Zline AI**, your built-in intelligent assistant powered by NVIDIA Nemotron.\n\nAsk me anything: reasoning puzzles (such as *which number is larger, 9.11 or 9.8?*), coding & debugging, real-time web research, or how Zline's end-to-end encryption works!",
        sender: { _id: AI_CHAT_ID, name: "Zline AI" },
        createdAt: new Date().toISOString(),
        type: "text",
        isAi: true,
      },
    ];
    setMessages(initial);
    scrollToBottom();
  }, [selectedChat?.isAi, session?.user?.id]);

  // Open Zline AI conversation
  const openAiChat = useCallback(() => {
    setSelectedChat({
      _id: AI_CHAT_ID,
      isGroup: false,
      isAi: true,
      chatName: "Zline AI",
      chatInitial: "AI",
      isOnline: true,
      otherUser: {
        _id: AI_CHAT_ID,
        name: "Zline AI",
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
        content: "👋 Hello! I am **Zline AI**, your built-in intelligent assistant powered by NVIDIA Nemotron.\n\nAsk me anything: reasoning puzzles (such as *which number is larger, 9.11 or 9.8?*), coding & debugging, real-time web research, or how Zline's end-to-end encryption works!",
        sender: { _id: AI_CHAT_ID, name: "Zline AI" },
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
      if (pendingFilePreview) {
        URL.revokeObjectURL(pendingFilePreview);
      }
    };
  }, [pendingFilePreview]);

  useEffect(() => {
    if (pendingFilePreview) {
      URL.revokeObjectURL(pendingFilePreview);
      setPendingFilePreview(null);
    }
    setPendingFile(null);
  }, [selectedChat?.otherUser?._id, selectedChat?._id]);

  // Socket listeners — registered once per socket instance.
  // Use refs to read the latest selectedChat/session without re-registering.
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = async (message: any) => {
      const currentChat = selectedChatRef.current;
      const currentSession = sessionRef.current;
      const otherUserId = currentChat?.otherUser?._id;

      let decryptedMsg = message;
      if (message.isEncrypted) {
        const decryptedArr = await decryptMessagesArray([message]);
        decryptedMsg = decryptedArr[0];
      }

      if (otherUserId && (decryptedMsg.sender === otherUserId || decryptedMsg.sender === currentSession?.user?.id)) {
        if (decryptedMsg.sender === otherUserId) {
          decryptedMsg.status = "seen";
          socket.emit("mark_seen", { senderId: decryptedMsg.sender, receiverId: currentSession?.user?.id });
          fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: decryptedMsg._id, status: "seen" }),
          });
        }
        setMessages((prev) => [...prev, decryptedMsg]);
        scrollToBottom();
      } else if (decryptedMsg.sender !== currentSession?.user?.id) {
        // Message from someone we're not chatting with — increment unread
        socket.emit("message_delivered", { messageId: decryptedMsg._id, senderId: decryptedMsg.sender });
        fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: decryptedMsg._id, status: "delivered" }),
        });
        setChats((prev) =>
          prev.map((c) =>
            c.otherUser?._id === decryptedMsg.sender
              ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
              : c
          )
        );
      }

      // Update latest message in chat list and re-sort
      setChats((prev) => {
        const currentSession2 = sessionRef.current;
        const currentChat2 = selectedChatRef.current;
        const isFromOther = decryptedMsg.sender !== currentSession2?.user?.id;
        const relevantUserId = isFromOther ? decryptedMsg.sender : currentChat2?.otherUser?._id;
        
        const exists = prev.some((c) => c.otherUser?._id === relevantUserId);
        
        if (!exists && isFromOther) {
           // New chat from someone we don't have in our list yet
           fetchChatsRef.current();
           return prev;
        }

        const updated = prev.map((c) => {
          const isThisChat = c.otherUser?._id === relevantUserId;
          if (isThisChat) {
            return {
              ...c,
              latestMessage: { content: decryptedMsg.content, sender: decryptedMsg.sender, createdAt: decryptedMsg.createdAt, type: decryptedMsg.type || "text" },
              updatedAt: decryptedMsg.createdAt || new Date().toISOString(),
            };
          }
          return c;
        });
        return updated.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    };

    const handleMessagesSeen = ({ receiverId, readAt }: { receiverId: string; readAt?: string }) => {
      if (selectedChatRef.current?.otherUser?._id === receiverId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.status !== "seen") {
              const updatedReadBy = [...(m.readBy || [])];
              const dateVal = readAt ? new Date(readAt) : new Date();
              if (!updatedReadBy.some((r: any) => (r.userId?.toString() === receiverId || r.userId?._id?.toString() === receiverId))) {
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
      setMessages((prev) => prev.map((m) => m._id === decryptedMsg._id ? decryptedMsg : m));
      setChats((prev) => prev.map((c) => {
        const isThisChat = chatId ? c._id === chatId : (c.otherUser?._id === decryptedMsg.sender || c.otherUser?._id === decryptedMsg.chat);
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
    const handleMessageDeleted = ({ chatId, messageId }: { chatId?: string; messageId: string }) => {
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
    const handleMessagePinned = ({ chatId, message, pinnedCount }: { chatId?: string; message: any; pinnedCount: number }) => {
      setSelectedChat((prev: any) => {
        const isThisChat = prev && (chatId ? prev._id === chatId : (prev.otherUser?._id === message.sender || prev.otherUser?._id === message.chat));
        if (isThisChat) {
          const list = prev.pinnedMessages || [];
          if (!list.includes(message._id)) {
            return { ...prev, pinnedMessages: [...list, message._id] };
          }
        }
        return prev;
      });
    };

    const handleMessageUnpinned = ({ chatId, messageId, pinnedCount }: { chatId?: string; messageId: string; pinnedCount: number }) => {
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
    };
  }, [socket, decryptMessagesArray]); // stable — never re-registers due to selectedChat/session changes

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

        // Perform E2EE if recipient public key is available and message is text type
        if (recipientPublicKey && payload.type === "text" && payload.content) {
          try {
            const myPublicKey = session?.user?.id ? localStorage.getItem(`zline_e2e_public_key_${session.user.id}`) : null;
            const encrypted = await encryptMessage(payload.content, recipientPublicKey, myPublicKey || undefined);
            body.content = encrypted.encryptedContent;
            body.isEncrypted = true;
            body.encAesKey = encrypted.encAesKey;
            body.encAesKeyForSender = encrypted.encAesKeyForSender;
            body.iv = encrypted.iv;
          } catch (cryptoErr) {
            console.error("Encryption failed, sending unencrypted fallback:", cryptoErr);
          }
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
    } catch (error) {
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

  // Send text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
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
          const aiMsgId = "ai_" + Date.now();
          let streamingText = "";
          let capturedSources: any[] = [];
          let capturedQuery: string | undefined = undefined;

          // Placeholder AI message being populated via stream
          const initialAiMsg = {
            _id: aiMsgId,
            content: "",
            sender: { _id: AI_CHAT_ID, name: "Zline AI" },
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
                  capturedSources = eventData.sources || [];
                  capturedQuery = eventData.query;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m._id === aiMsgId
                        ? { ...m, sources: capturedSources, searchQuery: capturedQuery }
                        : m
                    )
                  );
                } else if (eventType === "delta") {
                  streamingText += eventData.text || "";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m._id === aiMsgId ? { ...m, content: streamingText } : m
                    )
                  );
                  scrollToBottom();
                } else if (eventType === "done") {
                  if (eventData.content) streamingText = eventData.content;
                  if (eventData.sources) capturedSources = eventData.sources;
                  if (eventData.searchQuery) capturedQuery = eventData.searchQuery;
                } else if (eventType === "error") {
                  throw new Error(eventData.message || "Streaming error");
                }
              } catch (parseErr) {
                // Ignore incomplete JSON chunks
              }
            }
          }

          const finalizedAiMsg = {
            _id: aiMsgId,
            content: streamingText,
            sender: { _id: AI_CHAT_ID, name: "Zline AI" },
            createdAt: new Date().toISOString(),
            type: "text",
            isAi: true,
            sources: capturedSources,
            searchQuery: capturedQuery,
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
            content: streamingText,
            createdAt: finalizedAiMsg.createdAt,
          });
        } else {
          // Fallback to standard JSON
          const data = await res.json();
          const aiMsg = {
            _id: "ai_" + Date.now(),
            content: data.content,
            sender: { _id: AI_CHAT_ID, name: "Zline AI" },
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
          sender: { _id: AI_CHAT_ID, name: "Zline AI" },
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
        if (msgToEdit.isEncrypted && recipientPublicKey) {
          try {
            const myPublicKey = session?.user?.id ? localStorage.getItem(`zline_e2e_public_key_${session.user.id}`) : null;
            const encrypted = await encryptMessage(content, recipientPublicKey, myPublicKey || undefined);
            body.content = encrypted.encryptedContent;
            body.isEncrypted = true;
            body.encAesKey = encrypted.encAesKey;
            body.encAesKeyForSender = encrypted.encAesKeyForSender;
            body.iv = encrypted.iv;
          } catch (cryptoErr) {
            console.error("Encryption failed for E2EE edit:", cryptoErr);
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

  // File selection
  const selectFile = (file: File) => {
    setMediaError(null);
    if (file.size > 100 * 1024 * 1024) {
      setMediaError("File too large. Maximum size is 100MB.");
      return;
    }
    setPendingFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPendingFilePreview(url);
    } else {
      setPendingFilePreview(null);
    }
  };

  // Upload and send the pending file via XMLHttpRequest for progress tracking
  const uploadAndSendPendingFile = async () => {
    if (!pendingFile || !selectedChat?.otherUser) return;
    const file = pendingFile;
    setPendingFile(null);
    if (pendingFilePreview) {
      URL.revokeObjectURL(pendingFilePreview);
      setPendingFilePreview(null);
    }

    setIsUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentage);
      }
    });

    xhr.addEventListener("load", async () => {
      setUploadProgress(null);
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          const { fileUrl, fileName, fileSize, type } = response;
          await dispatchMessage({ content: "", type, fileUrl, fileName, fileSize });
        } catch (e) {
          setMediaError("Failed to parse server response.");
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          setMediaError(err.message || "Upload failed");
        } catch {
          setMediaError(`Upload failed with status ${xhr.status}`);
        }
      }
    });

    xhr.addEventListener("error", () => {
      setUploadProgress(null);
      setIsUploading(false);
      setMediaError("Upload failed due to a network error.");
    });

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  };

  // Upload a file/image and send (fallback trigger for input change)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat?.otherUser) return;
    e.target.value = "";
    selectFile(file);
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedChat?.otherUser) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!selectedChat?.otherUser) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      selectFile(file);
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

  return (
    <div className="flex w-full max-w-full h-screen-mobile bg-gray-100 dark:bg-black overflow-hidden relative">
      {/* Primary Semantic H1 for SEO & Accessibility */}
      <h1 className="sr-only">Zline — Real-Time Messaging & HD Calling</h1>

      {/* ===== SIDEBAR ===== */}
      {/* Mobile: full-screen when mobileView=="sidebar", hidden when mobileView=="chat" */}
      {/* Tablet+: fixed width, always visible alongside chat */}
      <div className={`
        flex-shrink-0 bg-white border-r border-gray-200 dark:bg-zinc-950 dark:border-zinc-800 flex flex-col h-full
        ${
          mobileView === "sidebar"
            ? "flex w-full md:w-80 lg:w-84 xl:w-96"
            : "hidden md:flex md:w-80 lg:w-84 xl:w-96"
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
                    className={`w-full flex items-center gap-3 px-3 py-3 transition-colors border-b border-indigo-100/70 dark:border-indigo-950/60 ${
                      selectedChat?.isAi
                        ? "bg-indigo-50/80 dark:bg-indigo-950/50"
                        : "bg-indigo-50/20 hover:bg-indigo-50/50 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/30"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center p-2 shadow-sm ring-2 ring-indigo-200 dark:ring-indigo-900 border border-gray-100 dark:border-zinc-700">
                        <AiIcon className="w-6 h-6" />
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-zinc-950 animate-pulse"></div>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-baseline">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            Zline AI
                          </p>
                        </div>
                        {aiLatestMessage?.createdAt && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 flex-shrink-0 ml-2">
                            {formatChatTime(aiLatestMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 truncate mt-0.5">
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
                        className={`w-full flex items-center gap-3 px-3 py-3 transition-colors border-b border-gray-50 dark:border-zinc-800/50 ${
                          !selectedChat?.isAi && selectedChat?.otherUser?._id === chat.otherUser?._id
                            ? "bg-blue-50 dark:bg-zinc-900"
                            : "hover:bg-gray-50 dark:hover:bg-zinc-900/50 active:bg-gray-100 dark:active:bg-zinc-900"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <UserAvatar
                            image={chat.chatImage || chat.otherUser?.image}
                            name={chat.chatName}
                            className="w-11 h-11"
                            variant="gray"
                          />
                          {chat.isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-zinc-950"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex justify-between items-baseline">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {chat.chatName}
                            </p>
                            {chat.latestMessage?.createdAt && (
                              <span className={`text-[10px] flex-shrink-0 ml-2 ${
                                chat.unreadCount > 0 ? "text-blue-600 font-semibold" : "text-gray-400 dark:text-zinc-500"
                              }`}>
                                {formatChatTime(chat.latestMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-0.5">
                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate pr-2">
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
                    const initials = name.charAt(0).toUpperCase();

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
            className="absolute bottom-18 right-4 z-20 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white dark:bg-zinc-850 text-gray-900 dark:text-white shadow-xl shadow-black/10 dark:shadow-black/40 border border-gray-200 dark:border-zinc-700 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Chat with Zline AI"
            aria-label="Chat with Zline AI"
          >
            <AiIcon className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <span className="text-xs font-semibold tracking-wide">Zline AI</span>
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
            <p className="text-blue-600 dark:text-blue-400 font-medium text-sm">Drop file here to send</p>
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
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {selectedChat.chatName}
                        {recipientPublicKey && (
                          <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-950/20 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5" title="End-to-End Encrypted">
                            🔒 E2EE
                          </span>
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
                            <span>{format(new Date(message.createdAt || Date.now()), "HH:mm")}</span>
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
                            <span>Zline AI</span>
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
                              <FormattedAiContent content={message.content} />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            )}
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
                            <span>{format(new Date(message.createdAt || Date.now()), "HH:mm")}</span>
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
                          ? "Nemotron is reasoning..."
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
                          : "Fast, intelligent answer powered by NVIDIA Nemotron"}
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
                      "What is the latest Next.js and React release?",
                      "Which number is larger, 9.11 or 9.8?",
                      "Who won the most recent Ballon d'Or?",
                      "How does Zline's 2048-bit RSA + AES-256 E2EE work?",
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

              {/* File Upload Progress */}
              {uploadProgress !== null && (
                <div className="mb-2 bg-white dark:bg-zinc-900 rounded-xl p-3 border border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-zinc-400 mb-1">
                    <span>Uploading {pendingFile?.name || "file"}...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Pending File Preview / Send Confirmation */}
              {pendingFile && uploadProgress === null && (
                <div className="mb-2 bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow border border-gray-200 dark:border-zinc-700 flex items-center gap-3 relative animate-in slide-in-from-bottom duration-200">
                  {pendingFilePreview ? (
                    <img 
                      src={pendingFilePreview} 
                      alt="Preview" 
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-blue-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-gray-900 dark:text-white">{pendingFile.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                      {(pendingFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview);
                        setPendingFile(null);
                        setPendingFilePreview(null);
                      }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={uploadAndSendPendingFile}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5"
                      title="Send file"
                    >
                      <Send className="w-3 h-3" /> Send
                    </button>
                  </div>
                </div>
              )}

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
                  {showAttachMenu && (
                    <div className="absolute bottom-14 left-0 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-700 py-2 z-10 min-w-[160px]">
                      <button
                        onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200"
                      >
                        <Paperclip className="w-4 h-4 text-blue-500" /> Attach File
                      </button>
                      <button
                        onClick={() => { setShowAttachMenu(false); setShowPollForm(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200"
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
                      className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
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
                      placeholder={selectedChat?.isAi ? "Ask Zline AI anything..." : "Type a message..."}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-base md:text-sm px-2 dark:text-white outline-none"
                    />

                    {/* Custom Voice Recorder */}
                    {!selectedChat?.isAi && (
                      <VoiceRecorder
                        onSend={handleVoiceSend}
                        disabled={isUploading}
                      />
                    )}

                    {/* Send text */}
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || isUploading}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="w-4 h-4 ml-0.5" />
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
            <button
              onClick={openAiChat}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <AiIcon className="w-4 h-4" />
              Chat with Zline AI
            </button>
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
                  placeholder="Enter group name..."
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  className="w-full text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 transition-colors"
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
              if (data?.settings) setUserSettings(data.settings);
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
