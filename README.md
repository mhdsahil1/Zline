<div align="center">

<a href="https://zline.vercel.app">
  <img src="./public/zline-animated.svg" alt="Zline - Private by Design. Secure by Default. AI-Supercharged." width="720" />
</a>

<br>

*A high-performance real-time messaging, WebRTC calling, and AI-grounded communication platform built with Next.js 14, Web Crypto E2EE, Socket.IO, WebRTC, NVIDIA Nemotron, and Obscura Headless Browser.*

<br>

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit-2563EB?style=for-the-badge)](https://zline.vercel.app)
[![Version](https://img.shields.io/badge/Version-v2.0-indigo?style=for-the-badge)]()
[![Status](https://img.shields.io/badge/Status-Stable-success?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)]()

<br>

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA_NIM-76B900?style=for-the-badge&logo=nvidia&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

</div>

---

## 🌟 What's New in v2.0

- 🤖 **Zline AI Assistant (NVIDIA Nemotron 3.5 Bolt E4B)**: Low-latency streaming assistant fine-tuned for high-speed multi-step reasoning, coding, logic puzzles, and conversational pairs.
- 🌐 **Deep Web Grounding (Tavily + Obscura)**: Autonomous dual-layer web research engine that combines Tavily search discovery with the **Obscura Rust Headless Browser** for headless CDP rendering and dynamic page content extraction.
- 🎨 **Originkit Particle Winding Loading System**: 3D interactive winding particle canvas that provides an immersive loading stage for route transitions and live AI reasoning stages.
- 🌗 **Kokonut UI Theme Reveal Switcher**: Circular View Transitions API theme switcher with WAAPI morphing for fluid light/dark transitions.
- 📊 **Interactive Live Polls**: Create and vote on real-time polls within 1-on-1 or group conversations with instant percentage bar charts.
- 🎙️ **Rich Audio Notes & Visual Waveform**: In-browser audio recording with real-time waveform playback and duration tracking.
- ⚡ **Enhanced E2EE**: Native Web Crypto API 2048-bit RSA-OAEP key exchange + AES-256-GCM message encryption with public key fingerprint auditing in Settings.

---

## 🚀 Key Features

### 🤖 Intelligent AI & Autonomous Web Research
- **NVIDIA Nemotron 3.5 Bolt E4B**: Integrated via high-throughput OpenAI-compatible NVIDIA NIM endpoint with server-sent event (SSE) token streaming.
- **Obscura Headless Browser Engine**: Rust-based headless browser running via Chrome DevTools Protocol (CDP) in Docker to scrape and render dynamic JavaScript web pages.
- **Tavily Search Discovery**: Autonomous classification of queries requiring real-time web intelligence.
- **Interactive Source Citations**: Verified citations with titles, favicons, URLs, and snippets rendered below AI responses.
- **Multi-Stage Reasoning Indicator**: Real-time status badges (*Searching*, *Browsing*, *Extracting*, *Analyzing*, *Reasoning*, *Generating*).
- **Floating AI Launcher**: Dedicated bottom-right floating action button (FAB) for instant one-click access.

### 🔒 Privacy & Cryptography
- **True End-to-End Encryption (E2EE)**: Messages are encrypted in the sender's browser and only decrypted on the recipient's device.
- **Native Web Crypto API**: Hardware-accelerated RSA-OAEP 2048-bit key exchange combined with AES-GCM 256-bit symmetric encryption.
- **Local Key Management**: Cryptographic private keys reside strictly in the user's `localStorage` and never touch backend servers.
- **Key Fingerprints**: View and verify cryptographic key fingerprints in the Settings panel.
- **Disappearing Messages**: Set self-destruct timers on sensitive conversations.
- **Account Data Shredding**: Complete user deletion routines that scrub keys, messages, and relationships.

### 💬 Rich Real-Time Messaging
- **Instant Messaging**: Sub-10ms delivery latency via WebSockets (Socket.IO).
- **Live Receipts**: Typing indicators, sent (`✓`), delivered (`✓✓`), and seen (`✓✓` blue) status receipts.
- **Interactive Polls**: Create customizable multiple-choice polls with live voting tallies.
- **Emoji Reactions**: Express reactions with quick emoji pickers (👍, ❤️, 😂, 😮, 😢, 🔥).
- **Voice Messaging**: Crisp in-browser voice note recording and custom player.
- **Media & File Sharing**: Upload images and documents with progress bars and download triggers.
- **Message Controls**: Edit sent messages with visual edit tags, pin critical messages to the chat header, or star important notes.
- **In-Chat & Global Search**: Filter messages locally within a thread or search across all chats and contacts.

### 📞 HD Audio & Video Calling
- **WebRTC Peer-to-Peer**: Direct peer connection for low-latency, crystal-clear 1-on-1 audio and video calls.
- **Mesh Group Calling**: Multi-user voice and video conferences directly inside group rooms.
- **Call Controls**: Real-time mute, camera toggling, screen sharing, and call duration logs.
- **Call History**: Dedicated calls tab with incoming, outgoing, and missed call logs.

---

## 🏗 Architecture

```
                       ┌────────────────────────────────────────────────────────┐
                       │                     CLIENT BROWSER                     │
                       │  Next.js 14 • React • Tailwind CSS • Web Crypto (E2EE) │
                       └───────────┬────────────────────────────────┬───────────┘
                                   │ HTTPS / REST                   │ WebSockets / WSS
                                   ▼                                ▼
                 ┌───────────────────────────────────┐    ┌──────────────────┐
                 │       Next.js API Routes          │    │ Socket.IO Server │
                 │  (Auth, Users, Messages, AI SSE)  │    │  (WebRTC Signal) │
                 └─────┬───────────────────────┬─────┘    └─────────┬────────┘
                       │                       │                    │
          ┌────────────┴────────┐              │                    ▼
          ▼                     ▼              │           WebRTC Peer Data
   MongoDB Atlas           NextAuth.js         │         (Encrypted Media)
   (Encrypted Data)      (JWT / OAuth)         │
                                               ▼
                             ┌───────────────────────────────────┐
                             │    Zline AI Orchestration Engine  │
                             └─────┬───────────────────────┬─────┘
                                   │                       │
                                   ▼                       ▼
                         ┌───────────────────┐   ┌───────────────────────┐
                         │ NVIDIA NIM API    │   │  Tavily Search API    │
                         │ (Nemotron 3.5)    │   │  (URL Discovery)      │
                         └───────────────────┘   └───────────┬───────────┘
                                                             │
                                                             ▼
                                                 ┌───────────────────────┐
                                                 │ Obscura CDP Browser   │
                                                 │ (Rust Headless / DOM) │
                                                 └───────────────────────┘
```

---

## 💻 Tech Stack

| Domain | Technology |
|---|---|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Actions, Route Handlers) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) with custom `@theme` tokens |
| **AI Intelligence** | [NVIDIA NIM](https://build.nvidia.com/) (`nvidia/nemotron-3.5-bolt-e4b`) |
| **Web Scraping** | [Obscura](https://github.com/h4ckf0r0day/obscura) (Rust-based CDP Headless Browser Engine) |
| **Search Engine** | [Tavily Search API](https://tavily.com/) |
| **Real-Time** | [Socket.IO](https://socket.io/) (WebSockets with HMAC handshake) |
| **VoIP / Media** | [WebRTC](https://webrtc.org/) (P2P DataChannels, STUN/TURN traversal) |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/) via Mongoose ODM |
| **Cryptography** | Native Browser [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (RSA-OAEP 2048-bit + AES-GCM 256-bit) |
| **Authentication** | [Auth.js / NextAuth](https://authjs.dev/) (Credentials, Google OAuth, JWT) |
| **Components** | [Kokonut UI](https://kokonutui.com/) (SwitchButton & Procedural Avatars), [Originkit](https://originkit.dev/) (Particle Winding Canvas) |

---

## 📁 Project Structure

```
zline/
├── app/
│   ├── (auth)/                  # Login, Register, OTP verification routes
│   ├── api/
│   │   ├── ai/chat/             # AI Nemotron streaming & Obscura orchestration
│   │   ├── auth/                # NextAuth credential and session routes
│   │   ├── messages/            # Message persistence & E2EE envelope storage
│   │   ├── reactions/           # Emoji reaction handling
│   │   ├── users/               # Profile, avatar, settings & block routes
│   │   └── upload/              # Media and file attachments
│   ├── chat/                    # Core responsive messaging & calling dashboard
│   ├── globals.css              # Tailwind v4 styles, custom tokens & animations
│   ├── layout.tsx               # Root layout with ThemeProvider, Auth & SEO Schema
│   ├── loading.tsx              # Originkit Particle Winding global loading stage
│   └── page.tsx                 # High-converting product landing page
├── components/
│   ├── landing/                 # Navbar, Hero, Features, Showcase, Security, CTA
│   ├── originkit/ui/            # Particle Winding 3D canvas engine
│   ├── AiIcon.tsx               # Brand AI Platform vector component
│   ├── CallModal.tsx            # 1-on-1 WebRTC audio/video call modal
│   ├── GroupCallModal.tsx       # Multi-peer group WebRTC call modal
│   ├── LoadingAnimation.tsx     # Reusable full-screen and inline loading states
│   ├── SettingsPanel.tsx        # Settings (Privacy, Appearance, Security, E2EE)
│   ├── SwitchButton.tsx         # Kokonut UI animated circular theme switcher
│   ├── UserAvatar.tsx           # Multi-provider avatar renderer (URL, Kokonut, SVG)
│   └── VoiceRecorder.tsx        # In-browser audio note recorder
├── docker-compose.obscura.yml   # Obscura Rust Headless Browser container
├── lib/
│   ├── ai/                      # AI prompts, streaming parsers, and tool helpers
│   ├── crypto.ts                # Client-side RSA-OAEP & AES-GCM cryptography
│   ├── db.ts                    # MongoDB connection pooling
│   ├── obscura/                 # CDP client & DOM content extractor
│   ├── searchClassifier.ts      # Heuristic query intent detector
│   └── tavily.ts                # Tavily search discovery integration
├── socket-server/               # Standalone Node.js / Socket.IO signaling server
└── public/                      # Static assets, SVG logos, AI icons, service worker
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
# ==========================================
# Database & Core URLs
# ==========================================
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/zline
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

# ==========================================
# Authentication (NextAuth.js)
# ==========================================
NEXTAUTH_SECRET=generate-a-secure-random-32-char-string
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (Optional)
AUTH_GOOGLE_ID=your-google-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-google-client-secret

# ==========================================
# Zline AI (NVIDIA NIM & Nemotron 3.5)
# ==========================================
NVIDIA_API_KEY=nvapi-your-nvidia-nim-api-key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3.5-bolt-e4b

# ==========================================
# Real-Time Search & Browser Automation
# ==========================================
TAVILY_API_KEY=tvly-your-tavily-api-key
OBSCURA_CDP_URL=http://127.0.0.1:9222

# ==========================================
# Web Push Notifications (Optional)
# ==========================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:support@zline.app
```

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/mhdsahil1/zline.git
cd zline
npm install
```

### 2. Start the Obscura Headless Browser (Optional for Deep Web Scraping)
Run Obscura in Docker via Chrome DevTools Protocol:
```bash
docker-compose -f docker-compose.obscura.yml up -d
```
*Note: If Obscura is not running, Zline AI automatically falls back gracefully to Tavily's high-speed contextual search snippets.*

### 3. Start the Socket Signaling Server
```bash
cd socket-server
npm install
npm run start
```

### 4. Run the Next.js Development Server
In the project root:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛡️ Security Architecture

Zline enforces a zero-trust model for messaging:

1. **Key Generation**: When a user registers or signs in, a unique 2048-bit RSA key pair is generated inside the browser via `window.crypto.subtle`.
2. **Key Distribution**: Only the public key (JWK) is published to the user profile on MongoDB. The private key remains locked in client-side storage.
3. **Hybrid Encryption**:
   - For every chat message, the sender generates a random 256-bit AES-GCM session key.
   - The message payload is encrypted using this AES key with an initialization vector (IV).
   - The AES key is encrypted with the recipient's public RSA key.
4. **Transport & Storage**: The server only transports and stores ciphertext envelopes. Neither database administrators nor intercepting proxies can decrypt user conversations.
5. **Session Verification**: Both participants can view their cryptographic public key fingerprints directly in the **Settings → Encryption** menu.

---

## 📈 Roadmap

- [x] **v1.0**: Core WebSocket chat, WebRTC audio/video calls, Google OAuth, E2EE key exchange.
- [x] **v2.0**: NVIDIA Nemotron AI Assistant, Obscura Rust headless browser integration, Tavily grounding, Originkit 3D canvas loading, Kokonut UI themes, Live Polls, Voice Notes.
- [ ] **v2.1**: End-to-end encrypted file vault with client-side chunking.
- [ ] **v2.2**: Multi-device cryptographic session synchronization with QR-code device pairing.
- [ ] **v3.0**: Native desktop clients (Tauri) and mobile wrappers (Capacitor/React Native).

---

## 🤝 Contributing

Contributions are warmly welcomed! Feel free to submit issues, propose features, or open pull requests:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">

**Zline • Private by Design. Secure by Default.**

Made with ❤️ by [Muhammed Sahil](https://github.com/mhdsahil1) and contributors.

</div>
