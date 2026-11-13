import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { SocketProvider } from "@/components/SocketProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import SchemaMarkup from "@/components/SchemaMarkup";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e73700",
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zline.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Zline | Fast, Secure Real-Time Messaging & HD Calling",
    template: "%s | Zline",
  },
  description:
    "Connect instantly with friends and teams using Zline. Features end-to-end encryption, HD voice and video calling, instant group chats, voice notes, and seamless cross-device synchronization.",
  keywords: [
    "Zline",
    "real-time messaging",
    "secure chat",
    "end-to-end encryption",
    "E2EE messaging",
    "HD voice call",
    "video calling",
    "group messaging",
    "WebRTC calls",
    "socket chat",
    "voice notes",
    "privacy messenger",
  ],
  authors: [{ name: "Zline Team", url: appUrl }],
  creator: "Zline",
  publisher: "Zline",
  applicationName: "Zline",
  category: "Communication",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Zline | Fast, Secure Real-Time Messaging & HD Calling",
    description:
      "Connect instantly with friends and teams with end-to-end encrypted messaging, HD voice & video calls, and instant synchronization.",
    url: appUrl,
    siteName: "Zline",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zline - Fast, Secure Real-Time Messaging & Calling",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zline | Fast, Secure Real-Time Messaging & HD Calling",
    description:
      "Connect instantly with friends and teams with end-to-end encrypted messaging, HD voice & video calls, and instant synchronization.",
    images: ["/og-image.png"],
    creator: "@zlineapp",
    site: "@zlineapp",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
      "googlea35067fe8286b402",
  },
  icons: {
    icon: [
      { url: "/Fevicon final.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/Fevicon final.svg",
    apple: "/Fevicon final.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
    <html lang="en" className="scroll-smooth antialiased" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/Fevicon final.svg" type="image/svg+xml" />
        <SchemaMarkup />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('zline_theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (stored === 'dark' || (!stored && prefersDark) || (stored === 'system' && prefersDark)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <AuthProvider>
          <SocketProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
