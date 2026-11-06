import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your Zline account to access your encrypted conversations, real-time group chats, and HD voice and video calls.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Sign In | Zline",
    description: "Access your encrypted chats and calls on Zline.",
    url: "/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

