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
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "";
      if (!socketUrl) {
        try {
          await fetch("/api/socket/io");
        } catch (error) {
          console.error("Socket initialization failed", error);
        }
      }

      socketInstance = io(socketUrl || undefined, {
        path: "/api/socket/io",
        addTrailingSlash: false,
      });

      socketInstance.on("connect", () => {
        console.log("Socket connected!");
        setIsConnected(true);
        if (session?.user?.id) {
          socketInstance?.emit("join", session.user.id);
        }
      });

      socketInstance.on("disconnect", () => {
        console.log("Socket disconnected!");
        setIsConnected(false);
      });

      setSocket(socketInstance);
    };

    initSocket();

    return () => {
      if (socketInstance) {
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
