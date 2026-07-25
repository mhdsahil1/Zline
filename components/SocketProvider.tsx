"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession, signOut } from "next-auth/react";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;

    let socketInstance: Socket | null = null;

    const initSocket = async () => {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
      console.log("Initializing socket connection to:", socketUrl);

      let token = "";
      try {
        const res = await fetch("/api/auth/socket-token");
        if (res.ok) {
          const data = await res.json();
          token = data.token;
        }
      } catch (e) {
        console.error("Failed to fetch socket token:", e);
      }

      socketInstance = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        auth: { token },
      });

      socketInstance.on("connect", () => {
        console.log("Socket connected successfully with ID:", socketInstance?.id);
        setIsConnected(true);
        if (session?.user?.id) {
          socketInstance?.emit("join", session.user.id);
        }
      });

      socketInstance.on("disconnect", (reason) => {
        console.warn("Socket disconnected. Reason:", reason);
        setIsConnected(false);
      });

      socketInstance.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message);
      });

      // ─── Account Deletion: Force Logout ───────────────────────────────
      // When the account is deleted (from this or another device), the socket
      // server broadcasts force_logout to all sockets in the user's room.
      // This ensures immediate multi-device logout.
      socketInstance.on("force_logout", () => {
        console.warn("Force logout received — account has been deleted.");
        // Clean up local E2EE keys
        if (session?.user?.id) {
          try {
            localStorage.removeItem(`zline_e2e_public_key_${session.user.id}`);
            localStorage.removeItem(`zline_e2e_private_key_${session.user.id}`);
          } catch {
            // localStorage may not be available
          }
        }
        signOut({ callbackUrl: "/login" });
      });

      // ─── Account Deletion: Contact Notification ───────────────────────
      // When another user's account is deleted, refresh to update the chat
      // list with the new "Deleted User #XXXX" name.
      socketInstance.on("user_deleted", () => {
        // Reload chat list to reflect deleted user's anonymized name
        window.dispatchEvent(new CustomEvent("zline:refresh_chats"));
      });

      setSocket(socketInstance);
    };

    initSocket();

    return () => {
      if (socketInstance) {
        console.log("Cleaning up socket connection...");
        socketInstance.disconnect();
      }
    };
  }, [session?.user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
