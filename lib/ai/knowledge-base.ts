/**
 * Zline Platform & Zino AI Official Knowledge Base (RAG)
 * 
 * Provides verified platform documentation, cryptographic specifications,
 * feature tutorials, and frequently asked questions for retrieval-augmented generation.
 */

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: "identity" | "overview" | "cryptography" | "devices" | "calling" | "customization" | "messaging" | "faq";
  keywords: string[];
  commonQuestions: string[];
  summary: string;
  content: string;
}

export const ZLINE_KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    id: "zline_creator_and_github",
    title: "Creator and Developer of Zline (Muhammed Sahil)",
    category: "identity",
    keywords: [
      "who built zline", "who created zline", "who made zline", "developer of zline",
      "author of zline", "creator of zline", "founder of zline", "who built zline chat",
      "who made zino", "who created zino", "who is the developer", "who is the founder",
      "who is the creator", "muhammed sahil", "sahil", "github", "repo", "repository",
      "source code", "zline github", "zline repository", "zline source code", "github link"
    ],
    commonQuestions: [
      "Who built Zline?",
      "Who created Zline chat?",
      "Who is the developer of Zline?",
      "Who is the founder of Zline?",
      "Who made Zino?",
      "What is the GitHub account or repository for Zline?",
      "Can I see the source code on GitHub?"
    ],
    summary: "Zline and Zino AI were created and developed by Muhammed Sahil (GitHub: https://github.com/mhdsahil1).",
    content: `• Creator & Developer: Zline and its built-in AI assistant Zino were created and engineered by **Muhammed Sahil**.
• GitHub Profile: [https://github.com/mhdsahil1](https://github.com/mhdsahil1)
• GitHub Repository: [https://github.com/mhdsahil1/zline](https://github.com/mhdsahil1/zline)
• About the Creator: Muhammed Sahil is a full-stack engineer and cryptographic systems designer who developed Zline as a high-performance, privacy-first communication platform.
• CRITICAL INSTRUCTION: Only mention Muhammed Sahil and his GitHub links when the user SPECIFICALLY asks about the developer, creator, founder, author, who built Zline or Zino, or asks for the GitHub repository. If the user asks about anything else (features, encryption, settings, how-to questions), do NOT mention the creator's name.`
  },
  {
    id: "zino_identity",
    title: "About Zino (Zline AI Assistant)",
    category: "identity",
    keywords: [
      "who are you", "what is your name", "what are you", "zino", "zline ai",
      "what model", "which model", "are you chatgpt", "are you llama", "are you claude", "are you nemotron",
      "identity", "about yourself", "what can you do"
    ],
    commonQuestions: [
      "Who are you?",
      "What is your name?",
      "What AI model are you?",
      "Are you ChatGPT or Claude?",
      "What can you do?"
    ],
    summary: "Zino is the dedicated, built-in AI assistant for Zline users, specialized in Zline features, coding, reasoning, and research.",
    content: `• Name: Zino (also known as Zline AI).
• Role: Built-in intelligent assistant developed exclusively for the Zline messaging platform.
• Core Capabilities:
  - Answering questions about Zline's features, settings, shortcuts, and security.
  - Multi-step mathematical reasoning, logic comparisons, and brain teasers.
  - Code generation, debugging, and architecture explanations across TypeScript, JavaScript, Python, Rust, Go, C++, SQL, and more.
  - Live web research and web page summaries via integrated real-time search grounding.
  - Drafting messages, emails, summaries, and creative text.
• Confidentiality Guideline: Zino never attributes itself to external AI model vendors or third-party engines. When asked about its identity, it identifies as Zino, the dedicated assistant built into Zline.`
  },
  {
    id: "zline_platform_overview",
    title: "Zline Platform Overview & Capabilities",
    category: "overview",
    keywords: [
      "what is zline", "about zline", "zline features", "features of zline", "how does zline work",
      "overview", "capabilities", "why use zline"
    ],
    commonQuestions: [
      "What is Zline?",
      "What can I do on Zline?",
      "What are the main features of Zline?",
      "How is Zline different from other chat apps?"
    ],
    summary: "Zline is a high-speed, privacy-first messaging and calling platform featuring multi-device E2EE, WebRTC HD calling, and built-in AI.",
    content: `Zline is a state-of-the-art real-time messaging, calling, and collaboration platform designed for high privacy, speed, and cross-device flexibility:
1. End-to-End Encryption (v3.0 E2EE): Every message, attachment, and media payload is encrypted end-to-end using AES-256-GCM with independent 2048-bit RSA-OAEP keys per device.
2. Multi-Device Synchronization: Use Zline simultaneously on desktops, laptops, tablets, and phones with independent keys and zero-knowledge history synchronization.
3. WebRTC HD Calling: Peer-to-peer 1-on-1 and group voice/video calls with screen sharing, camera switching, and active speaker highlighting.
4. Rich Messaging: Typing indicators, delivery/read receipts, emoji reactions, message editing, message deletion ("for me" / "for everyone"), pinned messages, and starred messages.
5. Voice Notes & Media: Waveform voice player with 1x/1.5x/2x playback, media files up to 50MB with drag-and-drop support.
6. Disappearing Messages: Ephemeral timers (24h, 7d, 90d) for self-destructing sensitive conversations.
7. Interactive Live Polls: Group decision-making with real-time tallying.
8. Customizable Interface: Fluid draggable sidebar resizing (260px-620px), chat list density controls (compact, normal, spacious), and font sizing presets (SM, MD, LG, XL).`
  },
  {
    id: "e2ee_cryptography_v3",
    title: "Multi-Device End-to-End Encryption (v3.0 E2EE)",
    category: "cryptography",
    keywords: [
      "encryption", "e2ee", "end to end encryption", "security", "how does encryption work",
      "is zline safe", "can admin read messages", "can server see messages", "aes", "rsa",
      "key envelopes", "private key", "web crypto", "zero knowledge", "security architecture"
    ],
    commonQuestions: [
      "Are my messages encrypted?",
      "Can anyone (even Zline admins) read my messages?",
      "How does the encryption work?",
      "What cryptographic algorithms does Zline use?",
      "Where are my private keys stored?"
    ],
    summary: "Zline v3.0 employs zero-knowledge AES-256-GCM symmetric encryption with 2048-bit RSA-OAEP multi-recipient key envelopes per device.",
    content: `Zline implements a production-grade, zero-knowledge multi-device cryptographic architecture:
• Symmetric Message Encryption: Every message payload is encrypted using AES-256-GCM with an ephemeral, single-use 256-bit symmetric key and a fresh random 96-bit Initialization Vector (IV).
• Asymmetric Key Wrapping (RSA-OAEP 2048-bit): Each device possesses an independent 2048-bit RSA-OAEP key pair. The ephemeral AES key is wrapped (encrypted) individually into a separate "Key Envelope" for:
  - Every active authorized device of the recipient.
  - Every OTHER authorized device of the sender (enabling seamless cross-device history sync).
• Client-Side Key Storage: Private keys are generated using the browser's native Web Crypto API and stored securely in client-side IndexedDB as non-extractable CryptoKey objects.
• Zero-Knowledge Server: The MongoDB database and Socket.IO relay only ever store and route ciphertext and opaque key envelopes. Plaintext and private keys NEVER touch the backend or network.
• Cryptographic Fingerprints: Each device computes a 40-character SHA-256 hexadecimal fingerprint formatted in 4-character blocks (e.g., ABCD 1234 ...) to allow users to verify keys out-of-band and protect against Man-in-the-Middle (MITM) attacks.`
  },
  {
    id: "device_pairing_and_management",
    title: "Device Linking, QR Code Pairing & Revocation",
    category: "devices",
    keywords: [
      "link device", "add device", "pair device", "qr code", "new phone", "new laptop",
      "multiple devices", "link new device", "revoke device", "lost phone", "stolen phone", "remove device"
    ],
    commonQuestions: [
      "How do I link a new phone or laptop to my account?",
      "How does QR pairing work?",
      "What if I lose my phone or laptop?",
      "How do I revoke an old device?",
      "How many devices can I link?"
    ],
    summary: "Secure QR code pairing allows linking new devices with cryptographic handshake verification; devices can be revoked instantly at any time.",
    content: `Zline allows you to securely access your account from multiple devices simultaneously:
• Linking a New Device:
  1. Open Zline on your primary device, navigate to Settings → Linked Devices, and click "Link New Device".
  2. A temporary cryptographic pairing challenge and QR code is generated with a short 2-minute Time-To-Live (TTL).
  3. Scan the QR code or approve the cryptographic pairing handshake from the companion device.
  4. The companion device generates its own unique 2048-bit RSA keypair; the primary device authorizes the public key.
  5. Once linked, the new device can immediately decrypt all subsequent messages.
• Revoking a Device:
  1. If a device is lost, stolen, or decommissioned, open Settings → Linked Devices on any of your active devices.
  2. Find the target device in the list and click "Revoke".
  3. The server immediately marks the device as revoked. From that exact millisecond onward, future messages will NEVER generate key envelopes for that device, completely isolating it.`
  },
  {
    id: "webrtc_calling",
    title: "HD Audio & Video Calls (1-on-1 and Group)",
    category: "calling",
    keywords: [
      "call", "audio call", "video call", "group call", "screen share", "webrtc",
      "how to call", "start video call", "voice call", "call quality", "mute", "camera"
    ],
    commonQuestions: [
      "How do I make a video or voice call?",
      "Can I make group calls in Zline?",
      "Can I share my screen during a call?",
      "Are calls free?"
    ],
    summary: "Zline provides crystal-clear WebRTC peer-to-peer audio and video calling with screen sharing and group conferencing.",
    content: `Zline includes built-in high-definition voice and video calling powered by WebRTC:
• 1-on-1 Calls: Open any direct chat and tap the Phone icon (voice call) or Camera icon (video call) in the top header.
• Group Calls: In any group chat, click the Audio or Video Call button in the header. All group members receive an incoming call prompt and can join simultaneously.
• In-Call Capabilities:
  - Toggle microphone mute/unmute.
  - Toggle camera on/off with camera front/back switching.
  - Screen Sharing: Click the Screen Share button to share your desktop, browser tab, or application window.
  - Speaker Detection: Highlights whoever is currently speaking.
  - Grid & Spotlight views: Automatically adapt layout based on participant count.`
  },
  {
    id: "chat_and_sidebar_sizing",
    title: "Adjusting Chat Size, Message Font Size & Sidebar Width",
    category: "customization",
    keywords: [
      "chat size", "sidebar width", "font size", "resize", "adjust size", "density",
      "draggable divider", "make bigger", "make smaller", "compact", "spacious", "list size"
    ],
    commonQuestions: [
      "How do I resize the chat list or sidebar?",
      "How do I change the message font size?",
      "How do I make the chat list more compact or spacious?",
      "Can I drag to resize the chat panels?"
    ],
    summary: "Easily adjust sidebar width with a draggable divider (260px-620px), customize chat list density, and choose from 4 message font sizes.",
    content: `Zline provides flexible visual sizing controls to match any screen or reading preference:
1. Draggable Sidebar Divider (Desktop/Tablet):
   - Hover your mouse over the vertical divider line between the chat list (sidebar) and the message area.
   - Click and drag left or right to freely scale the sidebar width between 260px and 620px.
   - Double-click the divider bar anytime to instantly reset to the default 360px width.
2. Quick-Access Sizing Popover:
   - Click the Sliders icon in the top header of any conversation (or Zino chat).
   - Change Message Text Size: Pick SM (compact text), MD (standard), LG (large), or XL (extra-large).
   - Change Chat List Density: Pick Compact (smaller 32px avatars & tighter padding), Normal (balanced), or Spacious (larger 48px avatars & comfortable padding).
   - One-Click Sidebar Presets: Instantly switch between 300px, 360px, 420px, or 500px.
3. Settings Panel:
   - You can also configure all sizing and density options under Settings → Appearance.`
  },
  {
    id: "themes_and_dark_mode",
    title: "Themes & Appearance Customization",
    category: "customization",
    keywords: [
      "theme", "dark mode", "light mode", "change theme", "appearance", "colors", "view transition"
    ],
    commonQuestions: [
      "How do I turn on dark mode?",
      "How do I change the theme in Zline?",
      "Is dark mode supported?"
    ],
    summary: "Toggle between Dark and Light mode using the animated circular theme button with native View Transitions API support.",
    content: `Zline offers refined Dark and Light themes:
• Quick Switch: Click the Sun/Moon theme toggle button in the sidebar or chat header.
• Smooth Animation: Uses the modern browser View Transitions API to radiate the new theme outward in an expanding circular wave from the button.
• Deep Dark Mode: Calibrated for OLED screens and low-light environments with optimal contrast and reduced eye strain.
• Appearance Settings: Customize themes and appearance preferences anytime under Settings → Appearance.`
  },
  {
    id: "disappearing_messages_ephemeral",
    title: "Disappearing Messages & Self-Destruct Timers",
    category: "messaging",
    keywords: [
      "disappearing messages", "self destruct", "ephemeral", "timer", "auto delete",
      "24 hours", "7 days", "90 days", "expire", "expiry"
    ],
    commonQuestions: [
      "How do disappearing messages work?",
      "How do I set messages to delete automatically?",
      "Can I send self-destructing messages?"
    ],
    summary: "Set an automatic self-destruct timer (24h, 7d, 90d) on any conversation so messages and media purge automatically upon expiration.",
    content: `Keep sensitive conversations clutter-free and private with Disappearing Messages:
• Enabling: In any 1-on-1 or group chat, access the chat settings or click the Disappearing Messages timer toggle.
• Durations: Choose between Off, 24 Hours, 7 Days, or 90 Days.
• Behavior: Once enabled, every newly sent message and attachment is stamped with an expiration date. When the timer expires, the message is automatically erased and replaced with an expired placeholder.`
  },
  {
    id: "voice_notes_and_media_sharing",
    title: "Voice Notes, Media & File Transfers",
    category: "messaging",
    keywords: [
      "voice note", "audio recording", "voice message", "waveform", "send file", "attach file",
      "drag and drop", "images", "videos", "pdf", "file limit"
    ],
    commonQuestions: [
      "How do I record a voice note?",
      "Can I change the playback speed of voice notes?",
      "What types of files can I send?",
      "How big can file attachments be?"
    ],
    summary: "Send voice notes with interactive waveforms and 1x/1.5x/2x playback; drag-and-drop file transfers up to 50MB.",
    content: `Zline offers rich media and audio communication tools:
• Voice Notes:
  - Click the Microphone icon next to the chat bar to record.
  - Click Stop to finish and preview before sending.
  - Interactive custom player displays an animated waveform with scrubber.
  - Speed selector toggles between 1x, 1.5x, and 2x playback speeds.
• File Sharing:
  - Click the Paperclip icon or drag-and-drop any file directly into the chat area.
  - Supports images (PNG, JPG, WebP, GIF), audio, video (MP4, WebM), PDFs, code files, and archives (ZIP).
  - Maximum upload size is 50MB per file.`
  },
  {
    id: "polls_groups_and_pins",
    title: "Group Chats, Live Polls, Pinned & Starred Messages",
    category: "messaging",
    keywords: [
      "group chat", "create group", "poll", "create poll", "voting", "pin message",
      "pinned messages", "star message", "starred messages", "bookmarks"
    ],
    commonQuestions: [
      "How do I create a group chat?",
      "How do I create a poll in a group?",
      "How do I pin an important message?",
      "Where are my starred messages saved?"
    ],
    summary: "Collaborate effectively with group chats, interactive real-time polls, pinned messages, and a personal starred messages vault.",
    content: `Collaboration features built into Zline:
• Group Chats:
  - Click the Users icon in the sidebar header to open 'Create New Group'.
  - Enter a group title and select contacts to invite. Group members can exchange encrypted messages, participate in group calls, and vote in polls.
• Live Polls:
  - Click the Bar Chart icon in group chats to create a live poll with multiple options.
  - Group members cast votes with live, real-time vote count updates.
• Pinned Messages:
  - Hover over any message, click the action arrow, and choose 'Pin Message'.
  - Pinned items appear in the pinned banner and panel for quick access by everyone in the chat.
• Starred Messages:
  - Star any message to save it into your private personal bookmarks.
  - View all saved items anytime by clicking the Star icon in the sidebar header.`
  },
  {
    id: "privacy_and_security_faqs",
    title: "Privacy, Account Security & Blocking FAQs",
    category: "faq",
    keywords: [
      "privacy", "block user", "unblock", "read receipts", "last seen", "who can see",
      "is zline free", "account safety", "password", "delete account"
    ],
    commonQuestions: [
      "How do I block or unblock someone?",
      "Can I turn off read receipts and last seen?",
      "Is Zline free to use?",
      "Can I delete my account?"
    ],
    summary: "Manage privacy with read receipt toggles, last-seen visibility, one-click user blocking, and full account management.",
    content: `Privacy controls and account security in Zline:
• Block/Unblock Users: Click the UserX icon in any 1-on-1 chat header to block or unblock instantly. Manage all blocked contacts under Settings → Blocked Users.
• Privacy Toggles: Open Settings → Privacy to toggle:
  - Read receipts (blue double-check marks).
  - Last seen & online presence status.
• Pricing: Zline is completely free to use with zero hidden subscriptions.
• Account Deletion: You can delete your account and clear all server metadata permanently in Settings → Account.`
  }
];

/**
 * Normalizes text for keyword matching
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

const STOP_WORDS = new Set(["zline", "the", "this", "that", "and", "for", "with", "from", "how", "what", "does", "can", "you", "about", "are"]);

/**
 * Calculates a relevance score for a knowledge article against a query.
 */
function scoreArticle(article: KnowledgeArticle, query: string, queryTokens: string[]): number {
  const lowerQuery = query.toLowerCase();

  // STRICT USER RULE: Only ever return creator article if query specifically asks about creator, founder, developer, or github
  if (article.id === "zline_creator_and_github") {
    const creatorTriggers = [
      "who built", "who created", "who made", "developer", "creator", "founder",
      "author", "sahil", "muhammed sahil", "github", "source code", "repository", "who programmed"
    ];
    const hasCreatorIntent = creatorTriggers.some((t) => lowerQuery.includes(t));
    if (!hasCreatorIntent) {
      return 0;
    }
  }

  let score = 0;

  // 1. Exact or fuzzy question match
  for (const q of article.commonQuestions) {
    const lowerQ = q.toLowerCase();
    if (lowerQuery.includes(lowerQ) || lowerQ.includes(lowerQuery)) {
      score += 40;
    }
  }

  // 2. Keyword exact matches
  for (const kw of article.keywords) {
    if (lowerQuery.includes(kw.toLowerCase())) {
      score += 25;
    }
  }

  // 3. Title token matches (skip generic stop words)
  const titleTokens = tokenize(article.title);
  for (const qt of queryTokens) {
    if (STOP_WORDS.has(qt)) continue;
    if (titleTokens.includes(qt)) {
      score += 10;
    }
  }

  // 4. Content token frequency (skip generic stop words)
  const contentLower = article.content.toLowerCase();
  for (const qt of queryTokens) {
    if (STOP_WORDS.has(qt)) continue;
    if (contentLower.includes(qt)) {
      score += 3;
    }
  }

  return score;
}

/**
 * Retrieves the most relevant knowledge articles for a user query.
 */
export function retrieveZlineKnowledge(query: string, maxResults = 3): KnowledgeArticle[] {
  if (!query || query.trim().length < 2) return [];

  const queryTokens = tokenize(query);
  const scored = ZLINE_KNOWLEDGE_BASE.map((article) => ({
    article,
    score: scoreArticle(article, query, queryTokens),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Return articles with significant relevance
  return scored
    .filter((item) => item.score >= 15)
    .slice(0, maxResults)
    .map((item) => item.article);
}

/**
 * Formats retrieved articles into a clean, markdown RAG context block for the LLM.
 */
export function getZlineKnowledgeContext(query: string): string {
  const articles = retrieveZlineKnowledge(query, 3);
  if (articles.length === 0) return "";

  const formattedSections = articles.map((art, idx) => {
    return `[ZLINE VERIFIED KNOWLEDGE ${idx + 1}: ${art.title}]
Category: ${art.category}
Summary: ${art.summary}
Details:
${art.content}
[END KNOWLEDGE ${idx + 1}]`;
  });

  return [
    "=== ZLINE PLATFORM VERIFIED KNOWLEDGE BASE (INTERNAL RAG) ===",
    "The following verified information is retrieved from Zline's official knowledge base:",
    "",
    formattedSections.join("\n\n"),
    "",
    "INSTRUCTION: Use the verified Zline knowledge above to answer the user's question accurately, warmly, and thoroughly.",
    "=== END ZLINE PLATFORM KNOWLEDGE BASE ===",
  ].join("\n");
}

