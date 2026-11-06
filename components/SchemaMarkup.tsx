import React from "react";

export default function SchemaMarkup() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zline.vercel.app";

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Zline",
    url: baseUrl,
    description:
      "Zline is a next-generation real-time communication platform offering end-to-end encrypted messaging, group chat, voice notes, and HD voice and video calling.",
    applicationCategory: "CommunicationApplication",
    operatingSystem: "All modern web browsers, iOS, Android, macOS, Windows, Linux",
    browserRequirements: "Requires JavaScript. Requires HTML5 WebRTC and WebSockets.",
    image: `${baseUrl}/og-image.png`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "End-to-End Encrypted Messaging (E2EE)",
      "High-Definition Peer-to-Peer Voice Calls",
      "Real-Time Video Calling with Screen Share Support",
      "Interactive Group Chats with Administrative Controls",
      "High-Fidelity Voice Recording and Playback",
      "Instant File, Photo, and Document Sharing",
      "Message Reactions, Pinned Conversations, and Starred Messages",
      "Push Notifications via Web Push Protocol",
    ],
    creator: {
      "@type": "Organization",
      name: "Zline",
      url: baseUrl,
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zline",
    url: baseUrl,
    logo: `${baseUrl}/Fevicon%20final.svg`,
    sameAs: [
      "https://github.com/zlineapp",
      "https://twitter.com/zlineapp",
    ],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Zline",
    url: baseUrl,
    description: "Fast, secure real-time messaging, audio, and video calling platform.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}

