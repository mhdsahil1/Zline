"use client";

import OrbCoil from "@/components/originkit/ui/particle-winding";

export default function ParticleWindingPreviewPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-black overflow-hidden">
      <div className="w-full h-screen flex items-center justify-center">
        <OrbCoil />
      </div>
    </main>
  );
}

