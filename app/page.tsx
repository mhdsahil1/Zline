"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import {
  MessageCircle, LogOut, Send, Loader2, Check, CheckCheck,
  Search, ArrowLeft, Plus, X
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

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

  // Chat state
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  
  // Local chat search state
  const [localSearchMode, setLocalSearchMode] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: any) => {
      const otherUserId = selectedChat?.otherUser?._id;

      if (otherUserId && (message.sender === otherUserId || message.sender === session?.user?.id)) {
        if (message.sender === otherUserId) {
          message.status = "seen";
          socket.emit("mark_seen", { senderId: message.sender, receiverId: session?.user?.id });
          fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: message._id, status: "seen" }),
          });
        }
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      } else if (message.sender !== session?.user?.id) {
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
        const updated = prev.map((c) => {
          const isThisChat =
            c.otherUser?._id === message.sender ||
            c.otherUser?._id === (selectedChat?.otherUser?._id);
          if (isThisChat && (message.sender !== session?.user?.id || c.otherUser?._id === selectedChat?.otherUser?._id)) {
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
      if (selectedChat?.otherUser?._id === receiverId) {
        setMessages((prev) => prev.map((m) => ({ ...m, status: "seen" })));
      }
    };

    const handleStatusUpdate = ({ messageId, status }: { messageId: string; status: string }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, status } : m));
    };

    const handleTyping = ({ senderId }: { senderId: string }) => {
      if (selectedChat?.otherUser?._id === senderId) setTypingUser(senderId);
    };

    const handleStopTyping = ({ senderId }: { senderId: string }) => {
      if (selectedChat?.otherUser?._id === senderId) setTypingUser(null);
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("messages_seen", handleMessagesSeen);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("messages_seen", handleMessagesSeen);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
    };
  }, [socket, selectedChat, session]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat?.otherUser) return;
    const content = newMessage;
    setNewMessage("");
    setIsTyping(false);
    if (socket) {
      socket.emit("stop_typing", { receiverId: selectedChat.otherUser._id, senderId: session?.user?.id });
    }
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedChat.otherUser._id, content }),
      });
      if (res.ok) {
        const message = await res.json();
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
        if (socket) {
          socket.emit("send_message", { receiverId: selectedChat.otherUser._id, message });
        }
        // Update sidebar
        setChats((prev) => {
          const exists = prev.some((c) => c.otherUser?._id === selectedChat.otherUser._id);
          let updated;
          if (exists) {
            updated = prev.map((c) =>
              c.otherUser?._id === selectedChat.otherUser._id
                ? { ...c, latestMessage: { content, sender: session?.user?.id, createdAt: new Date().toISOString(), type: "text" }, updatedAt: new Date().toISOString() }
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
                latestMessage: { content, sender: session?.user?.id, createdAt: new Date().toISOString(), type: "text" },
                unreadCount: 0,
                updatedAt: new Date().toISOString(),
              },
              ...prev,
            ];
          }
          return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        });
        // Update selectedChat _id if it was null (new chat)
        if (!selectedChat._id) {
          setSelectedChat((prev: any) => ({ ...prev, _id: message.chat }));
        }
      }
    } catch (error) { console.error("Failed to send message"); }
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
    <div className="flex h-screen bg-gray-100 dark:bg-black">
      {/* ===== SIDEBAR ===== */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
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
              <div className="flex items-center gap-2">
                <MessageCircle className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Zline</h1>
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
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full flex items-center gap-3 px-3 py-3 transition-colors border-b border-gray-50 dark:border-zinc-800/50 ${
                      selectedChat?.otherUser?._id === chat.otherUser?._id
                        ? "bg-blue-50 dark:bg-zinc-900"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-900/50"
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
      <div className="flex-1 flex flex-col bg-[#F0F2F5] dark:bg-[#0B141A]">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white flex flex-col justify-center px-6 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm z-10 relative">
              {localSearchMode ? (
                <div className="flex items-center gap-3 w-full">
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
                  <div className="flex items-center gap-3">
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
                  <div className="flex items-center">
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredMessages.map((message, index) => {
                const isMe = message.sender === session?.user?.id;
                
                // Determine if this message matches local search to highlight it
                const isHighlighted = localSearchQuery.trim() && 
                                    message.content?.toLowerCase().includes(localSearchQuery.toLowerCase());

                if (message.deletedForEveryone) {
                  return (
                    <div key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className="bg-gray-200 dark:bg-zinc-800 rounded-2xl px-4 py-2 opacity-60 italic text-xs text-gray-500">
                        This message was deleted
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={message._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isMe
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-white text-gray-900 rounded-bl-sm shadow-sm dark:bg-zinc-800 dark:text-white"
                    } ${isHighlighted ? "ring-2 ring-yellow-400 shadow-md" : ""}`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      <div className={`text-[10px] mt-1 flex justify-end items-center gap-1 ${
                        isMe ? "text-blue-100" : "text-gray-400 dark:text-zinc-400"
                      }`}>
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
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-[#F0F2F5] dark:bg-zinc-900">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-white dark:bg-zinc-950 p-2 rounded-full shadow-sm">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 dark:text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 dark:bg-blue-900/20">
              <MessageCircle className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2 dark:text-white">
              Welcome to Zline
            </h2>
            <p className="text-gray-500 max-w-sm dark:text-zinc-400">
              Select a chat or search for a user to start messaging.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
