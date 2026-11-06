import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link Account",
  description:
    "Link your authentication provider to your Zline account for seamless, secure sign-in across all your devices.",
  alternates: {
    canonical: "/link",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LinkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

