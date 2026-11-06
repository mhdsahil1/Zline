import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In with Email Code",
  description:
    "Sign in to Zline using a secure one-time verification code sent to your email.",
  alternates: {
    canonical: "/login/otp",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function OtpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

