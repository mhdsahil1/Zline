import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import { connectDB } from "@/lib/db";
import { Chat } from "@/lib/models/Chat";

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
      
      // ─── Presence ───────────────────────────────────────────────────────
      socket.on("join", async (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their personal room`);
        socket.broadcast.emit("user_online", userId);
        
        // Auto-join all group rooms this user is in
        try {
          await connectDB();
          const groups = await Chat.find({ users: userId, isGroup: true }).select("_id");
          groups.forEach((g) => {
            socket.join(g._id.toString());
            console.log(`User ${userId} auto-joined group room ${g._id}`);
          });
        } catch (err) {
          console.error("Auto-join group rooms error:", err);
        }
      });

      socket.on("join_group_room", (data) => {
        // data: { chatId }
        socket.join(data.chatId);
        console.log(`Socket ${socket.id} joined group room ${data.chatId}`);
      });

      socket.on("create_group", (data) => {
        // data: { chatId, userIds }
        // Iterate over all active sockets and make matching users join the room
        const connectedSockets = io.sockets.sockets;
        connectedSockets.forEach((s) => {
          data.userIds.forEach((uId: string) => {
            if (s.rooms.has(uId)) {
              s.join(data.chatId);
              s.emit("group_added", { chatId: data.chatId });
              console.log(`Socket for user ${uId} joined group room ${data.chatId}`);
            }
          });
        });
      });

      // ─── Messaging ──────────────────────────────────────────────────────
      socket.on("send_message", (data) => {
        // data: { receiverId, chatId, message }
        if (data.chatId) {
          socket.to(data.chatId).emit("receive_message", data.message);
        } else if (data.receiverId) {
          io.to(data.receiverId).emit("receive_message", data.message);
        }
      });

      socket.on("typing", (data) => {
        // data: { receiverId, chatId, senderId }
        if (data.chatId) {
          socket.to(data.chatId).emit("typing", { chatId: data.chatId, senderId: data.senderId });
        } else if (data.receiverId) {
          io.to(data.receiverId).emit("typing", { senderId: data.senderId });
        }
      });
      
      socket.on("stop_typing", (data) => {
        // data: { receiverId, chatId, senderId }
        if (data.chatId) {
          socket.to(data.chatId).emit("stop_typing", { chatId: data.chatId, senderId: data.senderId });
        } else if (data.receiverId) {
          io.to(data.receiverId).emit("stop_typing", { senderId: data.senderId });
        }
      });

      socket.on("mark_seen", (data) => {
        // data: { senderId, chatId, receiverId }
        if (data.chatId) {
          socket.to(data.chatId).emit("messages_seen", { chatId: data.chatId, receiverId: data.receiverId, readAt: new Date().toISOString() });
        } else if (data.senderId) {
          io.to(data.senderId).emit("messages_seen", { receiverId: data.receiverId, readAt: new Date().toISOString() });
        }
      });

      // Per-message read receipt (for tooltip)
      // data: { targetId, chatId, messageId, userId, readAt }
      socket.on("read_receipt", (data) => {
        if (data.chatId) {
          socket.to(data.chatId).emit("read_receipt", {
            chatId: data.chatId,
            messageId: data.messageId,
            userId: data.userId,
            readAt: data.readAt,
          });
        } else if (data.targetId) {
          io.to(data.targetId).emit("read_receipt", {
            messageId: data.messageId,
            userId: data.userId,
            readAt: data.readAt,
          });
        }
      });
      
      socket.on("message_delivered", (data) => {
        io.to(data.senderId).emit("message_status_update", {
          messageId: data.messageId,
          status: "delivered",
        });
      });

      // ─── Polls ──────────────────────────────────────────────────────────
      // data: { receiverId, chatId, updatedMessage }
      socket.on("poll_update", (data) => {
        if (data.chatId) {
          socket.to(data.chatId).emit("poll_updated", data.updatedMessage);
        } else if (data.receiverId) {
          io.to(data.receiverId).emit("poll_updated", data.updatedMessage);
        }
      });

      // ─── Reactions ────────────────────────────────────────────────────────
      // data: { targetUserId, chatId, messageId, reactions }
      socket.on("reaction_update", (data) => {
        if (data.chatId) {
          socket.to(data.chatId).emit("reaction_updated", {
            chatId: data.chatId,
            messageId: data.messageId,
            reactions: data.reactions,
          });
        } else if (data.targetUserId) {
          io.to(data.targetUserId).emit("reaction_updated", {
            messageId: data.messageId,
            reactions: data.reactions,
          });
        }
      });

      // ─── WebRTC Signaling (Audio / Video Calls) ─────────────────────────
      // Caller → Callee: initiate a call
      // data: { calleeId, offer, callType: "audio"|"video", callerId, callerName }
      socket.on("call_user", (data) => {
        io.to(data.calleeId).emit("incoming_call", {
          offer: data.offer,
          callType: data.callType,
          callerId: data.callerId,
          callerName: data.callerName,
        });
      });

      // Callee → Caller: accept with SDP answer
      // data: { callerId, answer }
      socket.on("call_answer", (data) => {
        io.to(data.callerId).emit("call_answered", { answer: data.answer });
      });

      // Relay ICE candidates between peers
      // data: { targetId, candidate }
      socket.on("ice_candidate", (data) => {
        io.to(data.targetId).emit("ice_candidate", { candidate: data.candidate });
      });

      // Callee → Caller: reject incoming call
      // data: { callerId }
      socket.on("call_reject", (data) => {
        io.to(data.callerId).emit("call_rejected");
      });

      // Either side ends an active call
      // data: { targetId }
      socket.on("call_end", (data) => {
        io.to(data.targetId).emit("call_ended");
      });

      // ─── Group WebRTC Calling ────────────────────────────────────────────
      socket.on("group_call_start", (data) => {
        // data: { chatId, callerId, callerName, callType }
        socket.to(data.chatId).emit("incoming_group_call", data);
      });

      socket.on("group_call_join", (data) => {
        // data: { chatId, userId, userName }
        socket.to(data.chatId).emit("group_call_joined", data);
      });

      socket.on("group_call_leave", (data) => {
        // data: { chatId, userId }
        socket.to(data.chatId).emit("group_call_left", data);
      });

      socket.on("group_call_signal", (data) => {
        // data: { targetId, senderId, signal }
        io.to(data.targetId).emit("group_call_signaling", {
          senderId: data.senderId,
          signal: data.signal,
        });
      });

      // ─── Disconnect ──────────────────────────────────────────────────────
      socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
      });
    });

    res.socket.server.io = io;
  }
  res.end();
};

export default ioHandler;
