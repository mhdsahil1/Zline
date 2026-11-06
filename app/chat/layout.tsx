import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat & Calls",
  description: "Zline real-time messaging, voice, and video conversations.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

