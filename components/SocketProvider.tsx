"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

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
