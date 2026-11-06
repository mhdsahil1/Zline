"use client";

import ReflectBackground from "@/components/originkit/ui/reflect-background";

export default function ReflectPreviewPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black overflow-hidden">
      <ReflectBackground
        tint="#005980"
        backgroundColor="#000000"
        speed={100}
        scale={1}
        contrast={8}
        iterations={5}
        opacity={100}
        blur={4}
        pointerStrength={40}
        style={{
          width: "100vw",
          height: "100vh",
          minWidth: 0,
          minHeight: 0,
        }}
      />
    </div>
  );
}

