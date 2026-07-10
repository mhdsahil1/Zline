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
      
      // ─── Presence ───────────────────────────────────────────────────────
      socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their personal room`);
        socket.broadcast.emit("user_online", userId);
      });

      // ─── Messaging ──────────────────────────────────────────────────────
      socket.on("send_message", (data) => {
        // data: { receiverId, message }
        io.to(data.receiverId).emit("receive_message", data.message);
      });

      socket.on("typing", (data) => {
        io.to(data.receiverId).emit("typing", { senderId: data.senderId });
      });
      
      socket.on("stop_typing", (data) => {
        io.to(data.receiverId).emit("stop_typing", { senderId: data.senderId });
      });

      socket.on("mark_seen", (data) => {
        io.to(data.senderId).emit("messages_seen", { receiverId: data.receiverId });
      });
      
      socket.on("message_delivered", (data) => {
        io.to(data.senderId).emit("message_status_update", {
          messageId: data.messageId,
          status: "delivered",
        });
      });

      // ─── Polls ──────────────────────────────────────────────────────────
      // data: { receiverId, updatedMessage }
      socket.on("poll_update", (data) => {
        io.to(data.receiverId).emit("poll_updated", data.updatedMessage);
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
