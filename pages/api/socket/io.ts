import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: any) => {
  if (!res.socket.server.io) {
    const path = "/api/socket/io";
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: path,
      addTrailingSlash: false,
    });
    
    io.on("connection", (socket) => {
      console.log("Client connected", socket.id);
      
      socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their personal room`);
        // We could also broadcast presence here
        socket.broadcast.emit("user_online", userId);
      });

      socket.on("send_message", (data) => {
        // data: { receiverId, message }
        io.to(data.receiverId).emit("receive_message", data.message);
      });

      socket.on("typing", (data) => {
        // data: { receiverId, senderId }
        io.to(data.receiverId).emit("typing", { senderId: data.senderId });
      });
      
      socket.on("stop_typing", (data) => {
        io.to(data.receiverId).emit("stop_typing", { senderId: data.senderId });
      });

      socket.on("mark_seen", (data) => {
        // data: { senderId, receiverId }
        // Let senderId know that receiverId has seen their messages
        io.to(data.senderId).emit("messages_seen", { receiverId: data.receiverId });
      });
      
      socket.on("message_delivered", (data) => {
        // Let sender know message was delivered
        io.to(data.senderId).emit("message_status_update", { messageId: data.messageId, status: "delivered" });
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
        // Could handle user offline status
      });
    });

    res.socket.server.io = io;
  }
  res.end();
};

export default ioHandler;
