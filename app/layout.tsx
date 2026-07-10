import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { SocketProvider } from "@/components/SocketProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Zline",
  description: "Real-time chat application",
  icons: {
    icon: "/Fevicon final.svg",
    shortcut: "/Fevicon final.svg",
    apple: "/Fevicon final.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zline",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Prevent zoom on iOS input focus & set mobile theme color */}
        <meta name="theme-color" content="#e73700" />
        <link rel="icon" href="/Fevicon final.svg" type="image/svg+xml" />
      </head>
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <AuthProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
