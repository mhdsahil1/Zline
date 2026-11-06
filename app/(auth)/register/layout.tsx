import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an Account",
  description:
    "Join Zline today. Experience lightning-fast, private, and secure messaging with end-to-end encryption, group chats, and HD calling.",
  alternates: {
    canonical: "/register",
  },
  openGraph: {
    title: "Join Zline | Create Free Account",
    description:
      "Create your Zline account for end-to-end encrypted messaging, voice, and video calls.",
    url: "/register",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

