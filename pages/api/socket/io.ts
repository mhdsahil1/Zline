import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import { connectDB } from "@/lib/db";
import { Chat } from "@/lib/models/Chat";
import { Call } from "@/lib/models/Call";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Keep track of ongoing calls in memory
const activeCalls = new Map<string, {
  callId: string;
  callerId: string;
  calleeId: string;
  initiatedAt: Date;
  connectedAt?: Date;
}>();

const activeGroupCalls = new Map<string, {
  callId: string;
  chatId: string;
  startedAt: Date;
  activeUsers: Set<string>;
}>();

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
        (socket as any).userId = userId;
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
      socket.on("poll_update", (data) => {
        if (data.chatId) {
          socket.to(data.chatId).emit("poll_updated", data.updatedMessage);
        } else if (data.receiverId) {
          io.to(data.receiverId).emit("poll_updated", data.updatedMessage);
        }
      });

      // ─── Reactions ────────────────────────────────────────────────────────
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
      socket.on("call_user", async (data) => {
        // data: { calleeId, offer, callType: "audio"|"video", callerId, callerName }
        try {
          await connectDB();
          const newCall = await Call.create({
            caller: data.callerId,
            participants: [data.calleeId],
            type: data.callType === "video" ? "video" : "voice",
            status: "missed", // default status
            startedAt: new Date(),
          });

          const callInfo = {
            callId: newCall._id.toString(),
            callerId: data.callerId,
            calleeId: data.calleeId,
            initiatedAt: new Date(),
          };

          activeCalls.set(data.callerId, callInfo);
          activeCalls.set(data.calleeId, callInfo);

          io.to(data.calleeId).emit("incoming_call", {
            offer: data.offer,
            callType: data.callType,
            callerId: data.callerId,
            callerName: data.callerName,
            callId: newCall._id.toString(),
          });
        } catch (err) {
          console.error("Error creating call log:", err);
        }
      });

      // Callee → Caller: accept with SDP answer
      socket.on("call_answer", async (data) => {
        // data: { callerId, answer }
        const callInfo = activeCalls.get(data.callerId);
        if (callInfo) {
          callInfo.connectedAt = new Date();
          try {
            await connectDB();
            await Call.findByIdAndUpdate(callInfo.callId, {
              status: "completed",
              startedAt: callInfo.connectedAt,
            });
          } catch (err) {
            console.error("Error answering call:", err);
          }
        }
        io.to(data.callerId).emit("call_answered", { answer: data.answer });
      });

      // Relay ICE candidates between peers
      socket.on("ice_candidate", (data) => {
        io.to(data.targetId).emit("ice_candidate", { candidate: data.candidate });
      });

      // Callee → Caller: reject incoming call
      socket.on("call_reject", async (data) => {
        // data: { callerId }
        const callInfo = activeCalls.get(data.callerId);
        if (callInfo) {
          try {
            await connectDB();
            await Call.findByIdAndUpdate(callInfo.callId, {
              status: "rejected",
            });
          } catch (err) {
            console.error("Error rejecting call:", err);
          }
          activeCalls.delete(callInfo.callerId);
          activeCalls.delete(callInfo.calleeId);
        }
        io.to(data.callerId).emit("call_rejected");
      });

      // Either side ends an active call
      socket.on("call_end", async (data) => {
        // data: { targetId }
        const myUserId = (socket as any).userId;
        const lookupId = myUserId || data.targetId;
        const callInfo = activeCalls.get(lookupId);

        if (callInfo) {
          try {
            await connectDB();
            if (callInfo.connectedAt) {
              const endedAt = new Date();
              const duration = Math.max(0, Math.round((endedAt.getTime() - callInfo.connectedAt.getTime()) / 1000));
              await Call.findByIdAndUpdate(callInfo.callId, {
                endedAt,
                duration,
                status: "completed",
              });
            } else {
              const isCaller = myUserId === callInfo.callerId;
              await Call.findByIdAndUpdate(callInfo.callId, {
                status: isCaller ? "cancelled" : "missed",
              });
            }
          } catch (err) {
            console.error("Error ending call:", err);
          }
          activeCalls.delete(callInfo.callerId);
          activeCalls.delete(callInfo.calleeId);
        }
        io.to(data.targetId).emit("call_ended");
      });

      // ─── Group WebRTC Calling ────────────────────────────────────────────
      socket.on("group_call_start", async (data) => {
        // data: { chatId, callerId, callerName, callType }
        try {
          await connectDB();
          const chat = await Chat.findById(data.chatId);
          const participants = chat ? chat.users.filter((u: any) => u.toString() !== data.callerId) : [];

          const newCall = await Call.create({
            chatId: data.chatId,
            caller: data.callerId,
            participants,
            type: data.callType === "video" ? "video" : "voice",
            status: "completed",
            startedAt: new Date(),
          });

          const groupCallInfo = {
            callId: newCall._id.toString(),
            chatId: data.chatId,
            startedAt: new Date(),
            activeUsers: new Set<string>([data.callerId]),
          };

          activeGroupCalls.set(data.chatId, groupCallInfo);
          socket.to(data.chatId).emit("incoming_group_call", data);
        } catch (err) {
          console.error("Error starting group call:", err);
        }
      });

      socket.on("group_call_join", (data) => {
        const groupCallInfo = activeGroupCalls.get(data.chatId);
        if (groupCallInfo) {
          groupCallInfo.activeUsers.add(data.userId);
        }
        socket.to(data.chatId).emit("group_call_joined", data);
      });

      socket.on("group_call_leave", async (data) => {
        const groupCallInfo = activeGroupCalls.get(data.chatId);
        if (groupCallInfo) {
          groupCallInfo.activeUsers.delete(data.userId);
          if (groupCallInfo.activeUsers.size === 0) {
            try {
              await connectDB();
              const endedAt = new Date();
              const duration = Math.max(0, Math.round((endedAt.getTime() - groupCallInfo.startedAt.getTime()) / 1000));
              await Call.findByIdAndUpdate(groupCallInfo.callId, {
                endedAt,
                duration,
                status: "completed",
              });
            } catch (err) {
              console.error("Error ending group call:", err);
            }
            activeGroupCalls.delete(data.chatId);
          }
        }
        socket.to(data.chatId).emit("group_call_left", data);
      });

      socket.on("group_call_signal", (data) => {
        io.to(data.targetId).emit("group_call_signaling", {
          senderId: data.senderId,
          signal: data.signal,
        });
      });

      // ─── Disconnect ──────────────────────────────────────────────────────
      socket.on("disconnect", async () => {
        console.log("Client disconnected", socket.id);
        const myUserId = (socket as any).userId;
        if (myUserId) {
          // End 1-to-1 active calls if user disconnects suddenly
          const callInfo = activeCalls.get(myUserId);
          if (callInfo) {
            try {
              await connectDB();
              const targetId = myUserId === callInfo.callerId ? callInfo.calleeId : callInfo.callerId;
              
              if (callInfo.connectedAt) {
                const endedAt = new Date();
                const duration = Math.max(0, Math.round((endedAt.getTime() - callInfo.connectedAt.getTime()) / 1000));
                await Call.findByIdAndUpdate(callInfo.callId, {
                  endedAt,
                  duration,
                  status: "completed",
                });
              } else {
                const isCaller = myUserId === callInfo.callerId;
                await Call.findByIdAndUpdate(callInfo.callId, {
                  status: isCaller ? "cancelled" : "missed",
                });
              }
              io.to(targetId).emit("call_ended");
            } catch (err) {
              console.error("Error ending call on disconnect:", err);
            }
            activeCalls.delete(callInfo.callerId);
            activeCalls.delete(callInfo.calleeId);
          }

          // Leave group calls if user disconnects
          for (const [chatId, groupCallInfo] of activeGroupCalls.entries()) {
            if (groupCallInfo.activeUsers.has(myUserId)) {
              groupCallInfo.activeUsers.delete(myUserId);
              if (groupCallInfo.activeUsers.size === 0) {
                try {
                  await connectDB();
                  const endedAt = new Date();
                  const duration = Math.max(0, Math.round((endedAt.getTime() - groupCallInfo.startedAt.getTime()) / 1000));
                  await Call.findByIdAndUpdate(groupCallInfo.callId, {
                    endedAt,
                    duration,
                    status: "completed",
                  });
                } catch (err) {
                  console.error("Error ending group call on disconnect:", err);
                }
                activeGroupCalls.delete(chatId);
              }
            }
          }
        }
      });
    });

    res.socket.server.io = io;
  }
  res.end();
};

export default ioHandler;
