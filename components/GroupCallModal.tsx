"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Users, Volume2 } from "lucide-react";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface GroupCallModalProps {
  socket: any;
  currentUserId: string;
  currentUserName: string;
}

interface PeerInfo {
  userId: string;
  userName: string;
  stream: MediaStream;
}

type CallState = "idle" | "incoming" | "active";

export default function GroupCallModal({ socket, currentUserId, currentUserName }: GroupCallModalProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [chatId, setChatId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active call participants (remote streams)
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Map of userId -> RTCPeerConnection
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Map of userId -> Peer Name
  const peerNamesRef = useRef<Map<string, string>>(new Map());

  // ── Cleanup Call ───────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Stop local tracks
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    peerNamesRef.current.clear();

    setPeers([]);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallState("idle");
  }, []);

  // ── Leave Call ─────────────────────────────────────────────────────────
  const leaveCall = useCallback(() => {
    if (chatId) {
      socket?.emit("group_call_leave", { chatId, userId: currentUserId });
    }
    cleanup();
  }, [socket, chatId, currentUserId, cleanup]);

  // ── Create Peer Connection for a user ──────────────────────────────────
  const createPeerConnection = useCallback((targetId: string, targetName: string) => {
    if (peerConnectionsRef.current.has(targetId)) {
      return peerConnectionsRef.current.get(targetId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(targetId, pc);
    peerNamesRef.current.set(targetId, targetName);

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("group_call_signal", {
          targetId,
          senderId: currentUserId,
          signal: { type: "ice", candidate: event.candidate },
        });
      }
    };

    // Track state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection with ${targetName}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        pc.close();
        peerConnectionsRef.current.delete(targetId);
        setPeers((prev) => prev.filter((p) => p.userId !== targetId));
      }
    };

    // Handle remote media track
    pc.ontrack = (event) => {
      console.log(`Received track from ${targetName}:`, event.track.kind);
      const stream = event.streams[0];
      setPeers((prev) => {
        const exists = prev.some((p) => p.userId === targetId);
        if (exists) {
          return prev.map((p) => (p.userId === targetId ? { ...p, stream } : p));
        }
        return [...prev, { userId: targetId, userName: targetName, stream }];
      });
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }, [socket, currentUserId]);

  // ── Get local stream ───────────────────────────────────────────────────
  const getLocalStream = useCallback(async (type: "audio" | "video") => {
    if (!navigator.mediaDevices) {
      throw new Error("MediaDevicesUnsupported");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  // ── Start Group Call ───────────────────────────────────────────────────
  const initiateGroupCall = useCallback(async (
    targetChatId: string,
    targetGroupName: string,
    type: "audio" | "video"
  ) => {
    setErrorMessage(null);
    setCallType(type);
    setChatId(targetChatId);
    setGroupName(targetGroupName);
    setCallState("active");

    try {
      const stream = await getLocalStream(type);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket?.emit("group_call_start", {
        chatId: targetChatId,
        callerId: currentUserId,
        callerName: currentUserName,
        callType: type,
      });
    } catch (err: any) {
      console.error("Initiate group call error:", err);
      cleanup();
      setErrorMessage(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone/Camera permission denied. Please allow access."
          : "Could not access media devices."
      );
    }
  }, [getLocalStream, socket, currentUserId, currentUserName, cleanup]);

  // ── Join Call ──────────────────────────────────────────────────────────
  const joinCall = useCallback(async () => {
    setErrorMessage(null);
    setCallState("active");

    try {
      const stream = await getLocalStream(callType);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Notify others in group we joined
      socket?.emit("group_call_join", {
        chatId,
        userId: currentUserId,
        userName: currentUserName,
      });
    } catch (err: any) {
      console.error("Join group call error:", err);
      cleanup();
      setErrorMessage("Could not access camera or microphone.");
    }
  }, [chatId, callType, getLocalStream, socket, currentUserId, currentUserName, cleanup]);

  // ── Mute / Camera Toggles ──────────────────────────────────────────────
  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  };

  // Synchronize local preview element
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [callState, callType]);

  // ── Socket Signalling handling ─────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Receive signal from group call initiator
    const onIncomingGroupCall = (data: any) => {
      if (callState !== "idle") return; // Busy
      setChatId(data.chatId);
      setGroupName(data.callerName + "'s Group");
      setCallType(data.callType);
      setCallState("incoming");
    };

    // A peer joined -> we (existing callers) initiate a peer connection to them
    const onGroupCallJoined = async (data: any) => {
      if (callState !== "active" || data.userId === currentUserId) return;
      console.log(`Peer joined call: ${data.userName}`);

      const pc = createPeerConnection(data.userId, data.userName);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("group_call_signal", {
          targetId: data.userId,
          senderId: currentUserId,
          signal: { type: "offer", sdp: offer },
        });
      } catch (err) {
        console.error("Create offer for joined peer error:", err);
      }
    };

    // Peer left
    const onGroupCallLeft = (data: any) => {
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.userId);
        peerNamesRef.current.delete(data.userId);
      }
      setPeers((prev) => prev.filter((p) => p.userId !== data.userId));
    };

    // Relayed signaling logic
    const onGroupCallSignaling = async (data: any) => {
      const { senderId, signal } = data;
      let pc = peerConnectionsRef.current.get(senderId);

      if (!pc && signal.type === "offer") {
        pc = createPeerConnection(senderId, peerNamesRef.current.get(senderId) || "User");
      }

      if (!pc) return;

      try {
        if (signal.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("group_call_signal", {
            targetId: senderId,
            senderId: currentUserId,
            signal: { type: "answer", sdp: answer },
          });
        } else if (signal.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === "ice" && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error("Handle signal error:", err);
      }
    };

    socket.on("incoming_group_call", onIncomingGroupCall);
    socket.on("group_call_joined", onGroupCallJoined);
    socket.on("group_call_left", onGroupCallLeft);
    socket.on("group_call_signaling", onGroupCallSignaling);

    return () => {
      socket.off("incoming_group_call", onIncomingGroupCall);
      socket.off("group_call_joined", onGroupCallJoined);
      socket.off("group_call_left", onGroupCallLeft);
      socket.off("group_call_signaling", onGroupCallSignaling);
    };
  }, [socket, callState, currentUserId, createPeerConnection]);

  // ── Listen to custom window events ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { chatId: targetId, groupName: name, callType: type } = (e as CustomEvent).detail;
      initiateGroupCall(targetId, name, type);
    };
    window.addEventListener("zline:initiate_group_call", handler);
    return () => window.removeEventListener("zline:initiate_group_call", handler);
  }, [initiateGroupCall]);

  if (callState === "idle" && !errorMessage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[calc(100%-2rem)] max-w-4xl bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl m-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="p-4 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-white text-sm font-semibold truncate">{groupName || "Group Call"}</h2>
          </div>
          <span className="text-xs text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-full">
            {peers.length + 1} participant{peers.length !== 0 ? "s" : ""}
          </span>
        </div>

        {errorMessage ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
              <PhoneOff className="w-8 h-8" />
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">Group Call Failed</h3>
            <p className="text-zinc-400 text-sm max-w-sm mb-6">{errorMessage}</p>
            <button
              onClick={() => { setErrorMessage(null); cleanup(); }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <>
            {/* Grid Container */}
            <div className="flex-1 bg-zinc-950 p-4 overflow-y-auto min-h-0">
              {callState === "incoming" ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold mb-4 animate-pulse">
                    {groupName ? groupName.charAt(0).toUpperCase() : "G"}
                  </div>
                  <h3 className="text-white text-xl font-semibold">{groupName}</h3>
                  <p className="text-blue-400 text-sm mt-1 animate-pulse">Incoming group call...</p>
                </div>
              ) : (
                <div className={`grid gap-3 h-full ${
                  peers.length === 0 ? "grid-cols-1" : peers.length === 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2"
                }`}>
                  {/* Local Video */}
                  <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center h-full">
                    {callType === "video" && !isCameraOff ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-500">
                        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold mb-2">
                          Me
                        </div>
                        <p className="text-xs">Camera Off</p>
                      </div>
                    )}
                    <span className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-xs text-[10px] text-white rounded-md">
                      Me {isMuted && "🎤 Muted"}
                    </span>
                  </div>

                  {/* Remote Videos */}
                  {peers.map((peer) => (
                    <PeerVideoTile key={peer.userId} peer={peer} callType={callType} />
                  ))}
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="p-6 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-center gap-4 flex-shrink-0 z-10">
              {callState === "incoming" ? (
                <>
                  <button
                    onClick={cleanup}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                    title="Decline"
                  >
                    <PhoneOff className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={joinCall}
                    className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg animate-pulse cursor-pointer"
                    title="Join"
                  >
                    <Phone className="w-6 h-6 text-white" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      isMuted ? "bg-red-600 hover:bg-red-700" : "bg-zinc-700 hover:bg-zinc-600"
                    }`}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                  </button>

                  {callType === "video" && (
                    <button
                      onClick={toggleCamera}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isCameraOff ? "bg-red-600 hover:bg-red-700" : "bg-zinc-700 hover:bg-zinc-600"
                      }`}
                      title={isCameraOff ? "Camera On" : "Camera Off"}
                    >
                      {isCameraOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
                    </button>
                  )}

                  <button
                    onClick={leaveCall}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                    title="Leave Call"
                  >
                    <PhoneOff className="w-6 h-6 text-white" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Inner helper component for Peer Tile rendering to handle srcObject safely
function PeerVideoTile({ peer, callType }: { peer: PeerInfo; callType: "audio" | "video" }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center h-full">
      {callType === "video" ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-zinc-500">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold mb-2">
            {peer.userName.charAt(0).toUpperCase()}
          </div>
          <p className="text-xs">Audio Connected</p>
        </div>
      )}
      <span className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-xs text-[10px] text-white rounded-md">
        {peer.userName}
      </span>
    </div>
  );
}
