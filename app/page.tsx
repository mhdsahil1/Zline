"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import {
  MessageCircle, LogOut, Send, Loader2, Check, CheckCheck,
  Search, ArrowLeft, Plus, X, Paperclip, Mic, StopCircle, Download, FileText,
  Phone, Video, BarChart2, ChevronRight, CheckCircle2
} from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import CallModal from "@/components/CallModal";
import Logo from "@/components/Logo";

function formatChatTime(date: string | Date) {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yy");
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { socket, isConnected } = useSocket();

  // Sidebar state
  const [chats, setChats] = useState<any[]>([]);
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
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollLoading, setPollLoading] = useState(false);

  // Attachment menu
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Local chat search state
  const [localSearchMode, setLocalSearchMode] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to always have the latest values inside stable socket listeners
  const selectedChatRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const fetchChatsRef = useRef<() => void>(() => {});

  // Keep refs in sync with latest state/session
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Auth redirect
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Fetch recent chats
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (error) {
      console.error("Failed to fetch chats");
    }
  }, []);

  // Keep fetchChatsRef in sync
  useEffect(() => { fetchChatsRef.current = fetchChats; }, [fetchChats]);

  useEffect(() => {
    if (session?.user?.id) fetchChats();
  }, [session, fetchChats]);

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
  const fetchMessages = useCallback(async (receiverId: string) => {
    try {
      const res = await fetch(`/api/messages?receiverId=${receiverId}`);
      if (res.ok) {
        setMessages(await res.json());
        scrollToBottom();
        if (socket) {
          socket.emit("mark_seen", { senderId: receiverId, receiverId: session?.user?.id });
        }
        // Clear unread in sidebar
        setChats((prev) =>
          prev.map((c) =>
            c.otherUser?._id === receiverId ? { ...c, unreadCount: 0 } : c
          )
        );
      }
    } catch (error) { console.error("Failed to fetch messages"); }
  }, [socket, session]);

  useEffect(() => {
    if (selectedChat?.otherUser?._id) {
      fetchMessages(selectedChat.otherUser._id);
    }
  }, [selectedChat?.otherUser?._id, fetchMessages]);

  // Socket listeners — registered once per socket instance.
  // Use refs to read the latest selectedChat/session without re-registering.
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: any) => {
      const currentChat = selectedChatRef.current;
      const currentSession = sessionRef.current;
      const otherUserId = currentChat?.otherUser?._id;

      if (otherUserId && (message.sender === otherUserId || message.sender === currentSession?.user?.id)) {
        if (message.sender === otherUserId) {
          message.status = "seen";
          socket.emit("mark_seen", { senderId: message.sender, receiverId: currentSession?.user?.id });
          fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: message._id, status: "seen" }),
          });
        }
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      } else if (message.sender !== currentSession?.user?.id) {
        // Message from someone we're not chatting with — increment unread
        socket.emit("message_delivered", { messageId: message._id, senderId: message.sender });
        fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: message._id, status: "delivered" }),
        });
        setChats((prev) =>
          prev.map((c) =>
            c.otherUser?._id === message.sender
              ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
              : c
          )
        );
      }

      // Update latest message in chat list and re-sort
      setChats((prev) => {
        const currentSession2 = sessionRef.current;
        const currentChat2 = selectedChatRef.current;
        const isFromOther = message.sender !== currentSession2?.user?.id;
        const relevantUserId = isFromOther ? message.sender : currentChat2?.otherUser?._id;
        
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
              latestMessage: { content: message.content, sender: message.sender, createdAt: message.createdAt, type: message.type || "text" },
              updatedAt: message.createdAt || new Date().toISOString(),
            };
          }
          return c;
        });
        return updated.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    };

    const handleMessagesSeen = ({ receiverId }: { receiverId: string }) => {
      if (selectedChatRef.current?.otherUser?._id === receiverId) {
        setMessages((prev) => prev.map((m) => ({ ...m, status: "seen" })));
      }
    };

    const handleStatusUpdate = ({ messageId, status }: { messageId: string; status: string }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, status } : m));
    };

    const handleTyping = ({ senderId }: { senderId: string }) => {
      if (selectedChatRef.current?.otherUser?._id === senderId) setTypingUser(senderId);
    };

    const handleStopTyping = ({ senderId }: { senderId: string }) => {
      if (selectedChatRef.current?.otherUser?._id === senderId) setTypingUser(null);
    };

    // Poll live update
    const handlePollUpdated = (updatedMessage: any) => {
      setMessages((prev) => prev.map((m) => m._id === updatedMessage._id ? updatedMessage : m));
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("messages_seen", handleMessagesSeen);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);
    socket.on("poll_updated", handlePollUpdated);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("messages_seen", handleMessagesSeen);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
      socket.off("poll_updated", handlePollUpdated);
    };
  }, [socket]); // stable — never re-registers due to selectedChat/session changes

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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

  // Core: send a message object (text or media) to the API + socket
  const dispatchMessage = async (payload: {
    content?: string;
    type?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  }) => {
    if (!selectedChat?.otherUser) return;
    setMediaError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedChat.otherUser._id, ...payload }),
      });
      if (!res.ok) {
        const err = await res.json();
        setMediaError(err.message || "Failed to send");
        return;
      }
      const message = await res.json();
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
      if (socket) {
        socket.emit("send_message", { receiverId: selectedChat.otherUser._id, message });
      }
      // Update sidebar
      setChats((prev) => {
        const exists = prev.some((c) => c.otherUser?._id === selectedChat.otherUser._id);
        const previewContent = payload.content || "";
        const previewType = (payload.type as string) || "text";
        let updated;
        if (exists) {
          updated = prev.map((c) =>
            c.otherUser?._id === selectedChat.otherUser._id
              ? { ...c, latestMessage: { content: previewContent, sender: session?.user?.id, createdAt: new Date().toISOString(), type: previewType }, updatedAt: new Date().toISOString() }
              : c
          );
        } else {
          updated = [
            {
              _id: message.chat,
              isGroup: false,
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

  // Send text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat?.otherUser) return;
    const content = newMessage;
    setNewMessage("");
    setIsTyping(false);
    if (socket) {
      socket.emit("stop_typing", { receiverId: selectedChat.otherUser._id, senderId: session?.user?.id });
    }
    await dispatchMessage({ content, type: "text" });
  };

  // Upload a file/image and send
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat?.otherUser) return;
    e.target.value = "";
    setMediaError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        setMediaError(err.message || "Upload failed");
        return;
      }
      const { fileUrl, fileName, fileSize, type } = await res.json();
      await dispatchMessage({ content: "", type, fileUrl, fileName, fileSize });
    } catch {
      setMediaError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Voice recording
  const startRecording = async () => {
    if (!selectedChat?.otherUser) return;
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 100 * 1024 * 1024) {
          setMediaError("Voice message exceeds 100MB.");
          return;
        }
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
          await dispatchMessage({ content: "", type, fileUrl, fileName, fileSize });
        } catch {
          setMediaError("Failed to send voice message.");
        } finally {
          setIsUploading(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setMediaError("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // Typing
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!socket || !selectedChat?.otherUser) return;
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { receiverId: selectedChat.otherUser._id, senderId: session?.user?.id });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("stop_typing", { receiverId: selectedChat.otherUser._id, senderId: session?.user?.id });
    }, 2000);
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
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

  const filteredMessages = messages.filter(m => 
    !localSearchQuery.trim() || 
    m.content?.toLowerCase().includes(localSearchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen-mobile bg-gray-100 dark:bg-black overflow-hidden">
      {/* ===== SIDEBAR ===== */}
      {/* Mobile: full-screen when mobileView=="sidebar", hidden when mobileView=="chat" */}
      {/* Tablet+: fixed w-72, always visible alongside chat */}
      <div className={`
        flex-shrink-0 bg-white border-r border-gray-200 dark:bg-zinc-950 dark:border-zinc-800 flex flex-col
        ${
          mobileView === "sidebar"
            ? "flex w-full md:w-72 lg:w-80"
            : "hidden md:flex md:w-72 lg:w-80"
        }
      `}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-zinc-800">
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
              <div className="flex items-center">
                <Logo className="h-7 w-auto" />
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setSearchMode(true)} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="New chat">
                  <Plus className="h-5 w-5" />
                </button>
                <button onClick={() => signOut()} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Log out">
                  <LogOut className="h-5 w-5" />
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

        {/* Profile card */}
        {!searchMode && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm dark:bg-blue-900/30">
                {session?.user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{session?.user?.name}</p>
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Online
                </p>
              </div>
            </div>
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
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold dark:bg-zinc-800 dark:text-gray-400">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
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
              {chats.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="h-10 w-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 dark:text-zinc-500">No chats yet</p>
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
                      selectedChat?.otherUser?._id === chat.otherUser?._id
                        ? "bg-blue-50 dark:bg-zinc-900"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-900/50 active:bg-gray-100 dark:active:bg-zinc-900"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold dark:bg-zinc-800 dark:text-gray-400">
                        {chat.chatInitial}
                      </div>
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
      </div>

      {/* ===== MAIN CHAT AREA ===== */}
      {/* Mobile: full-screen when mobileView=="chat", hidden when mobileView=="sidebar" */}
      {/* Tablet+: fills remaining space beside the sidebar */}
      <div className={`
        flex-1 flex flex-col bg-[#F0F2F5] dark:bg-[#0B141A]
        ${
          mobileView === "chat"
            ? "flex w-full"
            : "hidden md:flex"
        }
      `}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-14 md:h-16 bg-white flex flex-col justify-center px-3 md:px-6 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm z-10 relative flex-shrink-0">
              {localSearchMode ? (
                <div className="flex items-center gap-2 w-full">
                  <button onClick={() => { setLocalSearchMode(false); setLocalSearchQuery(""); }}>
                    <ArrowLeft className="h-5 w-5 text-gray-500 hover:text-gray-700 dark:text-zinc-400" />
                  </button>
                  <input
                    autoFocus
                    type="text"
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    placeholder="Search in conversation..."
                    className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm outline-none dark:text-white"
                  />
                  {localSearchQuery && (
                    <button onClick={() => setLocalSearchQuery("")}>
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Back button — only on mobile */}
                    <button
                      className="md:hidden p-1 -ml-1 text-gray-500 active:text-blue-600"
                      onClick={() => setMobileView("sidebar")}
                      aria-label="Back to chats"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold dark:bg-zinc-800 dark:text-gray-400">
                        {selectedChat.chatInitial}
                      </div>
                      {selectedChat.isOnline && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-zinc-900"></div>
                      )}
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedChat.chatName}
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
                    {/* Audio Call */}
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("zline:initiate_call", { detail: { calleeId: selectedChat.otherUser?._id, calleeName: selectedChat.chatName, callType: "audio" } }))}
                      className="p-2 text-gray-500 hover:text-green-600 transition-colors"
                      title="Audio call"
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    {/* Video Call — hide on very small phones to save space */}
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("zline:initiate_call", { detail: { calleeId: selectedChat.otherUser?._id, calleeName: selectedChat.chatName, callType: "video" } }))}
                      className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Video call"
                    >
                      <Video className="h-5 w-5" />
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
            <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 scroll-touch">
              {filteredMessages.map((message, index) => {
                const isMe = message.sender === session?.user?.id;
                const isHighlighted = localSearchQuery.trim() &&
                  message.content?.toLowerCase().includes(localSearchQuery.toLowerCase());
                const expiresAt = message.expiresAt ? new Date(message.expiresAt) : null;
                const isExpired = expiresAt && expiresAt < new Date();

                if (message.deletedForEveryone) {
                  return (
                    <div key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
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
                    <div key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
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

                return (
                  <div key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl overflow-hidden ${
                      isMe
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-white text-gray-900 rounded-bl-sm shadow-sm dark:bg-zinc-800 dark:text-white"
                    } ${isHighlighted ? "ring-2 ring-yellow-400 shadow-md" : ""}`}>

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
                            <FileText className={`w-4 h-4 ${isMe ? "text-blue-100" : "text-gray-500 dark:text-zinc-300"}`} />
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

                      {/* Voice */}
                      {message.type === "voice" && message.fileUrl && !isExpired && (
                        <div className="px-4 py-3">
                          <audio controls src={message.fileUrl} className="h-9 w-[220px] max-w-full" />
                        </div>
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
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
                          <span>{format(new Date(message.createdAt || Date.now()), "HH:mm")}</span>
                          {message.isEdited && <span className="italic">edited</span>}
                          {isMe && (
                            <span className="ml-0.5">
                              {message.status === "seen" ? (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                              ) : message.status === "delivered" ? (
                                <CheckCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
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
                    className="w-full text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => { const o = [...pollOptions]; o[idx] = e.target.value; setPollOptions(o); }}
                        className="flex-1 text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Attach menu */}
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
                  disabled={isUploading || isRecording}
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 flex-shrink-0 ${
                    showAttachMenu ? "bg-blue-600 text-white" : "text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800"
                  }`}
                  title="Attach / Poll"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  disabled={isRecording}
                  placeholder={isRecording ? "Recording... release to send" : "Type a message..."}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 dark:text-white outline-none disabled:opacity-50"
                />

                {/* Voice record button */}
                <button
                  type="button"
                  disabled={isUploading}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                    isRecording
                      ? "bg-red-500 text-white animate-pulse"
                      : "text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800"
                  } disabled:opacity-40`}
                  title="Hold to record voice message"
                >
                  {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Send text */}
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isRecording || isUploading}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
              </div>
            </div>
          </>
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
    </div>
  );
}
