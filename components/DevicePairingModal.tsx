"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X, QrCode, Smartphone, Laptop, Monitor, Tablet, Globe,
  ShieldCheck, Loader2, CheckCircle2, AlertCircle, Key, Copy, Check
} from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  getOrCreateLocalDevice,
  saveLocalDevice,
  detectDeviceName,
  detectDeviceType,
  computeFingerprint,
} from "@/lib/crypto";
import { useSocket } from "@/components/SocketProvider";

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If true, shows the approval interface for already-authenticated users
  // If false, shows the QR code interface for a new device to get linked
  isApprovingDevice?: boolean;
  currentUserSession?: any;
  onDeviceApproved?: () => void;
}

export default function DevicePairingModal({
  isOpen,
  onClose,
  isApprovingDevice = false,
  currentUserSession,
  onDeviceApproved,
}: DevicePairingModalProps) {
  const router = useRouter();
  const { socket } = useSocket();

  // Mode: "generate" (shows QR) or "scan" (approves incoming code)
  const [activeTab, setActiveTab] = useState<"generate" | "scan">(
    isApprovingDevice ? "scan" : "generate"
  );

  // Generate / New Device state
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSuccess, setPairSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Approve / Existing Device state
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState(false);
  const [approvedDeviceName, setApprovedDeviceName] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize pairing challenge for a new device
  const initPairingChallenge = async () => {
    setLoadingQr(true);
    setPairError(null);
    try {
      // 1. Get or generate local cryptographic identity
      const tempUserTag = currentUserSession?.user?.id || "unlinked_companion";
      const localDev = await getOrCreateLocalDevice(tempUserTag);
      setFingerprint(localDev.fingerprint);

      // 2. Request pairing challenge from server
      const res = await fetch("/api/devices/pair/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: localDev.deviceId,
          deviceName: localDev.deviceName,
          deviceType: localDev.deviceType,
          publicKey: localDev.publicKeyJwk,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to initialize pairing session");
      }

      const data = await res.json();
      setQrCodeUrl(data.qrCodeDataUrl);
      setPairingId(data.pairingId);
      setChallenge(data.challenge);
      setTimeLeft(300);

      // Join pairing socket room if available
      if (socket && socket.connected) {
        socket.emit("join_pairing_room", data.pairingId);
      }
    } catch (err: any) {
      console.error("Pairing init error:", err);
      setPairError(err.message || "Failed to generate pairing QR code.");
    } finally {
      setLoadingQr(false);
    }
  };

  // Start polling for pairing approval
  useEffect(() => {
    if (!isOpen || activeTab !== "generate" || !pairingId || pairSuccess) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/devices/pair/status?pairingId=${pairingId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "approved" && data.transferToken) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setPairSuccess(true);

            // Complete sign-in using NextAuth device-pairing credentials provider
            const signInRes = await signIn("device-pairing", {
              pairingId,
              transferToken: data.transferToken,
              redirect: false,
            });

            if (signInRes?.ok) {
              setTimeout(() => {
                onClose();
                router.push("/chat");
                router.refresh();
              }, 1200);
            } else {
              setPairError("Failed to authenticate paired session.");
            }
          } else if (data.status === "expired") {
            setPairError("Pairing session expired. Please refresh.");
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        console.error("Pairing status polling error:", err);
      }
    };

    pollIntervalRef.current = setInterval(checkStatus, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, activeTab, pairingId, pairSuccess, onClose, router]);

  // Countdown timer for pairing expiration
  useEffect(() => {
    if (!isOpen || activeTab !== "generate" || timeLeft <= 0 || pairSuccess) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPairError("QR Code expired. Please generate a new code.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, activeTab, timeLeft, pairSuccess]);

  // Listen on socket for instant pairing notification
  useEffect(() => {
    if (!socket || !pairingId) return;

    const handlePairingApproved = async (data: any) => {
      if (data?.pairingId === pairingId && data?.transferToken) {
        setPairSuccess(true);
        const signInRes = await signIn("device-pairing", {
          pairingId,
          transferToken: data.transferToken,
          redirect: false,
        });
        if (signInRes?.ok) {
          setTimeout(() => {
            onClose();
            router.push("/chat");
            router.refresh();
          }, 1200);
        }
      }
    };

    socket.on("pairing_approved", handlePairingApproved);
    return () => {
      socket.off("pairing_approved", handlePairingApproved);
    };
  }, [socket, pairingId, onClose, router]);

  // Trigger init on open
  useEffect(() => {
    if (isOpen && activeTab === "generate" && !qrCodeUrl && !loadingQr) {
      initPairingChallenge();
    }
  }, [isOpen, activeTab]);

  // Handle Approve by Authenticated Device
  const handleApproveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setApprovalError(null);
    setApproving(true);

    try {
      // Parse manual input (supports full JSON QR payload or pairingId:challenge string)
      let parsedPairingId = manualCodeInput.trim();
      let parsedChallenge = "";

      if (manualCodeInput.startsWith("{")) {
        try {
          const json = JSON.parse(manualCodeInput);
          parsedPairingId = json.pairingId;
          parsedChallenge = json.challenge;
        } catch {
          throw new Error("Invalid QR code payload format");
        }
      } else if (manualCodeInput.includes(":")) {
        const parts = manualCodeInput.split(":");
        parsedPairingId = parts[0].trim();
        parsedChallenge = parts[1].trim();
      }

      if (!parsedPairingId || !parsedChallenge) {
        throw new Error("Please enter both Pairing ID and Challenge (or scan full QR code payload).");
      }

      const currentDevId = currentUserSession?.user?.id
        ? localStorage.getItem(`zline_device_id_${currentUserSession.user.id}`)
        : "trusted-device";

      const res = await fetch("/api/devices/pair/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingId: parsedPairingId,
          challenge: parsedChallenge,
          approvingDeviceId: currentDevId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to approve device pairing.");
      }

      setApprovalSuccess(true);
      setApprovedDeviceName(data.targetDeviceName || "New Device");

      // Notify through socket and custom events
      if (socket && socket.connected) {
        socket.emit("device_paired", {
          pairingId: parsedPairingId,
          userId: currentUserSession?.user?.id,
        });
      }
      window.dispatchEvent(new CustomEvent("zline:devices_updated"));
      onDeviceApproved?.();

      setTimeout(() => {
        onClose();
        setApprovalSuccess(false);
        setManualCodeInput("");
      }, 1800);
    } catch (err: any) {
      console.error("Approve device error:", err);
      setApprovalError(err.message || "Failed to link new device.");
    } finally {
      setApproving(false);
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Linked Devices • E2EE v3.0
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <button
            onClick={() => setActiveTab("scan")}
            className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === "scan"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400"
            }`}
          >
            Link a New Device
          </button>
          <button
            onClick={() => setActiveTab("generate")}
            className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === "generate"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400"
            }`}
          >
            Pair This Device
          </button>
        </div>

        {/* Tab 1: Approve incoming code (Scan / Code Entry) */}
        {activeTab === "scan" && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              Open Zline on your secondary device (phone, laptop, or tablet) and select{" "}
              <strong>"Pair This Device"</strong>. Paste or enter the pairing challenge below to link it to your account.
            </p>

            {approvalSuccess ? (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                <h4 className="text-sm font-bold text-green-800 dark:text-green-300">
                  Device Successfully Authorized!
                </h4>
                <p className="text-xs text-green-700 dark:text-green-400">
                  <strong>{approvedDeviceName}</strong> is now linked with its own cryptographic keys.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApproveCode} className="space-y-4">
                {approvalError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 dark:text-red-400">{approvalError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                    Pairing Payload or Challenge String
                  </label>
                  <textarea
                    rows={3}
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder='Paste payload or "pairingId:challenge" from new device...'
                    className="w-full text-xs font-mono p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={approving || !manualCodeInput.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {approving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Approving...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Approve & Authorize Device</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30">
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                🔒 <strong>Cryptographic Principle:</strong> Approving a new device grants it independent access to your conversation channels. The new device never receives your private keys; it generates its own unique keypair.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Show QR Code for this device to be linked */}
        {activeTab === "generate" && (
          <div className="p-5 text-center space-y-4">
            {loadingQr ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-xs text-gray-500">Generating cryptographic challenge...</p>
              </div>
            ) : pairSuccess ? (
              <div className="py-8 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Device Paired Successfully!
                </h4>
                <p className="text-xs text-gray-500">Redirecting to your chats...</p>
              </div>
            ) : pairError ? (
              <div className="py-6 space-y-3">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                <p className="text-xs text-red-600">{pairError}</p>
                <button
                  onClick={initPairingChallenge}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors"
                >
                  Regenerate QR Code
                </button>
              </div>
            ) : (
              <>
                <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-200 inline-block mx-auto">
                  {qrCodeUrl && (
                    <img
                      src={qrCodeUrl}
                      alt="Device Pairing QR Code"
                      className="w-48 h-48 rounded-lg"
                    />
                  )}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Expires in:</span>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formattedTime}
                  </span>
                </div>

                {fingerprint && (
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 text-left">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-400 uppercase font-bold tracking-wider mb-1">
                      This Device's Fingerprint
                    </p>
                    <p className="text-[11px] font-mono text-gray-700 dark:text-zinc-300 break-all">
                      {fingerprint}
                    </p>
                  </div>
                )}

                {pairingId && challenge && (
                  <button
                    onClick={() => {
                      const payloadStr = `${pairingId}:${challenge}`;
                      navigator.clipboard.writeText(payloadStr);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied Pairing Code!" : "Copy Pairing Code"}</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

