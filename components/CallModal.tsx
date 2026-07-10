"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";

// Google public STUN servers — free, work in most networks
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface CallModalProps {
  socket: any;
  currentUserId: string;
  currentUserName: string;
}

type CallState = "idle" | "incoming" | "outgoing" | "active";

export interface CallModalHandle {
  initiateCall: (calleeId: string, calleeName: string, callType: "audio" | "video") => void;
}

// We expose this component as a ref-accessible component using an instance approach
// Instead, we use a global event pattern via window events for simplicity.
export default function CallModal({ socket, currentUserId, currentUserName }: CallModalProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [remoteName, setRemoteName] = useState("");
  const [remoteId, setRemoteId] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // ── Cleanup ────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    pendingOfferRef.current = null;
    iceQueueRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsMuted(false);
    setIsCameraOff(false);
    setCallState("idle");
  }, []);

  // ── Create RTCPeerConnection with ICE wiring ───────────────────────────
  const createPeer = useCallback((targetId: string): RTCPeerConnection => {
    const peer = new RTCPeerConnection(RTC_CONFIG);

    peer.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit("ice_candidate", { targetId, candidate: e.candidate });
      }
    };

    peer.ontrack = (e) => {
      console.log("Received remote track:", e.track.kind);
      remoteStreamRef.current = e.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE Connection State changed to:", peer.iceConnectionState);
      if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") {
        cleanup();
        setErrorMessage("Call connection lost or failed to establish.");
      }
    };

    return peer;
  }, [socket, cleanup]);

  // ── Get local media ────────────────────────────────────────────────────
  const getLocalStream = useCallback(async (type: "audio" | "video"): Promise<MediaStream> => {
    if (!navigator.mediaDevices) {
      if (!window.isSecureContext) {
        throw new Error("SecureContextError");
      }
      throw new Error("MediaDevicesUnsupported");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err: any) {
      console.warn("First getUserMedia attempt failed, trying fallback:", err);
      // Fallback: If camera access is blocked or unavailable, fall back to audio-only call
      if (type === "video") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        localStreamRef.current = stream;
        setCallType("audio");
        return stream;
      }
      throw err;
    }
  }, []);

  // ── Process Queued ICE Candidates ─────────────────────────────────────
  const processIceQueue = useCallback(async () => {
    if (!peerRef.current || !peerRef.current.remoteDescription) return;
    console.log(`Processing ${iceQueueRef.current.length} queued ICE candidates`);
    for (const candidate of iceQueueRef.current) {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding queued ICE candidate:", err);
      }
    }
    iceQueueRef.current = [];
  }, []);

  // ── INITIATE CALL (called externally via window event) ─────────────────
  const handleInitiateCall = useCallback(async (
    calleeId: string,
    calleeName: string,
    type: "audio" | "video"
  ) => {
    if (callState !== "idle") return;
    setErrorMessage(null);
    setCallType(type);
    setRemoteName(calleeName);
    setRemoteId(calleeId);
    setCallState("outgoing");

    try {
      const stream = await getLocalStream(type);
      const peer = createPeer(calleeId);
      peerRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket?.emit("call_user", {
        calleeId,
        offer,
        callType: type,
        callerId: currentUserId,
        callerName: currentUserName,
      });

      // Set a 30 second ring timeout (no answer handler)
      timeoutRef.current = setTimeout(() => {
        socket?.emit("call_end", { targetId: calleeId });
        cleanup();
        setErrorMessage(`No answer from ${calleeName}.`);
      }, 30000);

    } catch (err: any) {
      console.error("Call initiation error:", err);
      cleanup();
      if (err.message === "SecureContextError") {
        setErrorMessage(
          "WebRTC requires HTTPS. Accessing over HTTP on local IPs blocks camera/mic. Please use localhost, HTTPS, or enable Chrome flags."
        );
      } else if (err.message === "MediaDevicesUnsupported") {
        setErrorMessage("Microphone/Camera access is not supported by your browser or context.");
      } else {
        setErrorMessage(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Microphone/Camera permission denied. Please allow device access."
            : "Could not access microphone or camera. Please verify your devices are connected."
        );
      }
    }
  }, [callState, getLocalStream, createPeer, socket, currentUserId, currentUserName, cleanup]);

  // ── ACCEPT CALL ────────────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!pendingOfferRef.current) return;
    setErrorMessage(null);
    setCallState("active");

    try {
      const stream = await getLocalStream(callType);
      const peer = createPeer(remoteId);
      peerRef.current = peer;

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      await peer.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket?.emit("call_answer", { callerId: remoteId, answer });

      await processIceQueue();
    } catch (err: any) {
      console.error("Accept call error:", err);
      cleanup();
      if (err.message === "SecureContextError") {
        setErrorMessage(
          "WebRTC requires HTTPS. Accessing over HTTP on local IPs blocks camera/mic. Please use localhost, HTTPS, or enable Chrome flags."
        );
      } else if (err.message === "MediaDevicesUnsupported") {
        setErrorMessage("Microphone/Camera access is not supported by your browser or context.");
      } else {
        setErrorMessage(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Microphone/Camera permission denied. Please allow device access."
            : "Could not access microphone or camera. Please verify your devices are connected."
        );
      }
    }
  }, [callType, remoteId, getLocalStream, createPeer, socket, cleanup, processIceQueue]);

  // ── REJECT / END ───────────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    socket?.emit("call_reject", { callerId: remoteId });
    cleanup();
  }, [socket, remoteId, cleanup]);

  const endCall = useCallback(() => {
    socket?.emit("call_end", { targetId: remoteId });
    cleanup();
  }, [socket, remoteId, cleanup]);

  // ── MUTE / CAMERA ──────────────────────────────────────────────────────
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

  // ── Synchronize stream srcObjects with video DOM nodes ───────────────
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStreamRef.current) {
        if (localVideoRef.current.srcObject !== localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [callState, callType]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      if (remoteStreamRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [callState, callType]);

  // ── SOCKET EVENT LISTENERS ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncomingCall = ({ offer, callType: type, callerId, callerName }: any) => {
      if (callState !== "idle") {
        // Already in a call — auto-reject
        socket.emit("call_reject", { callerId });
        return;
      }
      setErrorMessage(null);
      pendingOfferRef.current = offer;
      setCallType(type);
      setRemoteId(callerId);
      setRemoteName(callerName);
      setCallState("incoming");
    };

    const onCallAnswered = async ({ answer }: any) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (peerRef.current) {
        try {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setCallState("active");
          await processIceQueue();
        } catch (e) {
          console.error("Set remote description error:", e);
          cleanup();
          setErrorMessage("Failed to establish peer-to-peer connection.");
        }
      }
    };

    const onIceCandidate = async ({ candidate }: any) => {
      if (candidate) {
        if (peerRef.current && peerRef.current.remoteDescription) {
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("ICE candidate error:", e);
          }
        } else {
          console.log("Queueing incoming ICE candidate");
          iceQueueRef.current.push(candidate);
        }
      }
    };

    const onCallRejected = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      cleanup();
      setErrorMessage(`${remoteName || "Callee"} declined the call.`);
    };

    const onCallEnded = () => {
      cleanup();
    };

    const onDisconnect = () => {
      cleanup();
      setErrorMessage("Call ended: disconnected from server.");
    };

    socket.on("incoming_call", onIncomingCall);
    socket.on("call_answered", onCallAnswered);
    socket.on("ice_candidate", onIceCandidate);
    socket.on("call_rejected", onCallRejected);
    socket.on("call_ended", onCallEnded);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("incoming_call", onIncomingCall);
      socket.off("call_answered", onCallAnswered);
      socket.off("ice_candidate", onIceCandidate);
      socket.off("call_rejected", onCallRejected);
      socket.off("call_ended", onCallEnded);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket, callState, remoteName, cleanup, processIceQueue]);

  // ── Listen to window events from page.tsx ─────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { calleeId, calleeName, callType: type } = (e as CustomEvent).detail;
      handleInitiateCall(calleeId, calleeName, type);
    };
    window.addEventListener("zline:initiate_call", handler);
    return () => window.removeEventListener("zline:initiate_call", handler);
  }, [handleInitiateCall]);

  if (callState === "idle" && !errorMessage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[calc(100%-2rem)] max-w-lg bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl m-4 md:m-0 animate-in fade-in zoom-in-95 duration-200">

        {errorMessage ? (
          <div className="w-full p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 animate-bounce">
              <PhoneOff className="w-8 h-8" />
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">Call Failed</h3>
            <p className="text-zinc-400 text-sm max-w-sm mb-6">{errorMessage}</p>
            <button
              onClick={() => {
                setErrorMessage(null);
                cleanup();
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <>
            {/* ── Remote Video (background) ── */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full ${callType === "video" && callState === "active" ? "h-[480px] object-cover" : "hidden"}`}
            />

            {/* ── Audio-only / outgoing / incoming background ── */}
            {(callType === "audio" || callState !== "active") && (
              <div className="w-full h-72 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-950">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
                  {remoteName ? remoteName.charAt(0).toUpperCase() : "?"}
                </div>
                <h2 className="text-white text-xl font-semibold">{remoteName}</h2>
                <p className="text-blue-300 text-sm mt-1">
                  {callState === "incoming"
                    ? `Incoming ${callType} call…`
                    : callState === "outgoing"
                    ? "Calling…"
                    : callType === "audio" ? "Audio call" : "Video call"}
                </p>
              </div>
            )}

            {/* ── Local Video PiP ── */}
            {callType === "video" && callState === "active" && (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="absolute bottom-24 right-4 w-28 h-36 rounded-xl object-cover border-2 border-zinc-700 shadow-lg"
              />
            )}
            {/* Local video for outgoing (before answer) */}
            {callType === "video" && callState === "outgoing" && (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="hidden"
              />
            )}

            {/* ── Controls ── */}
            <div className="flex items-center justify-center gap-5 p-6 bg-zinc-900">
              {callState === "incoming" ? (
                <>
                  {/* Reject */}
                  <button
                    onClick={rejectCall}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                    title="Decline"
                  >
                    <PhoneOff className="w-7 h-7 text-white" />
                  </button>
                  {/* Accept */}
                  <button
                    onClick={acceptCall}
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg animate-pulse cursor-pointer"
                    title="Accept"
                  >
                    <Phone className="w-7 h-7 text-white" />
                  </button>
                </>
              ) : (
                <>
                  {/* Mute */}
                  <button
                    onClick={toggleMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      isMuted ? "bg-red-600 hover:bg-red-700" : "bg-zinc-700 hover:bg-zinc-600"
                    }`}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                  </button>

                  {/* Camera toggle (video only) */}
                  {callType === "video" && (
                    <button
                      onClick={toggleCamera}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isCameraOff ? "bg-red-600 hover:bg-red-700" : "bg-zinc-700 hover:bg-zinc-600"
                      }`}
                      title={isCameraOff ? "Turn on camera" : "Turn off camera"}
                    >
                      {isCameraOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
                    </button>
                  )}

                  {/* End call */}
                  <button
                    onClick={endCall}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                    title="End call"
                  >
                    <PhoneOff className="w-7 h-7 text-white" />
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
