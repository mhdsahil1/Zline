# 💬 Zline

> A modern, real-time communication platform with end-to-end encrypted messaging, voice and video calls, group conversations, file sharing, push notifications, and advanced messaging features.

Zline is a full-stack messaging application built with **Next.js**, **TypeScript**, **MongoDB**, **Socket.IO**, and **WebRTC**.

It provides real-time private and group communication through a responsive web interface, with a standalone persistent Socket.IO server handling real-time events and WebRTC signaling.

---

## ✨ Features

### 💬 Real-Time Messaging

- ⚡ Instant one-to-one messaging
- 👥 Real-time group conversations
- 🔐 End-to-end encrypted private messages
- ↩️ Message replies with quoted previews
- ✏️ Edit sent messages
- 🗑️ Delete messages for everyone
- 😀 Emoji reactions
- ✓ Message delivery status
- ✓✓ Read receipts
- 👀 Seen timestamps
- ⌨️ Typing indicators
- 🟢 Online/offline presence
- 🔢 Unread message counters
- 🔍 Search messages inside conversations
- 📌 Pin important messages
- ⭐ Save/star messages privately
- 🕒 Message timestamps

---

### 🔐 End-to-End Encryption

Zline supports client-side end-to-end encryption for private conversations using the **Web Crypto API**.

The encryption system uses:

- Asymmetric public/private key pairs
- AES symmetric encryption for message content
- Public-key encryption for AES key exchange
- Separate encrypted AES keys for sender and recipient
- User-specific local private-key storage

Private encryption keys remain on the user's device and are not intentionally transmitted to the server.

> **Note:** Zline is an educational/personal software project and has not undergone an independent professional security audit. It should not be considered a replacement for audited secure-messaging platforms.

---

### 🎙️ Voice Messages

- 🎤 Record voice messages directly in chat
- ⏱️ Live recording duration
- ❌ Cancel recordings before sending
- ▶️ Custom voice-message playback controls
- 🌊 Audio waveform visualization

---

### 📁 File & Media Sharing

- 🖼️ Image and media sharing
- 📄 Document and file sharing
- 🖱️ Drag-and-drop uploads
- 📊 Upload progress indicators
- 🔎 Media preview thumbnails
- 📑 File-type indicators

---

### 📞 Voice & Video Calling

Zline includes real-time WebRTC communication with Socket.IO-based signaling.

- 📞 One-to-one voice calls
- 🎥 One-to-one video calls
- 👥 Group WebRTC calls
- 🖥️ Screen sharing
- 🎙️ Microphone mute/unmute
- 📷 Camera enable/disable
- ❌ Call rejection
- ⏳ Call timeout handling
- 📵 Missed and cancelled call tracking
- 📊 Call duration tracking
- 📜 Persistent call history
- 📞 Dedicated Calls tab
- 🔁 Redial from call history

---

### 👥 Group Communication

- ➕ Create group conversations
- 💬 Real-time group messaging
- 👤 Group member management
- ℹ️ Group information panel
- ⌨️ Group typing indicators
- ✓ Group read tracking
- 😀 Message reactions
- 📞 Group voice/video calls
- 🔄 Automatic Socket.IO group-room registration

---

### 🔔 Push Notifications

Zline includes browser push-notification support using:

- Service Workers
- Web Push
- VAPID authentication
- Push subscription persistence
- Notification permission management

---

### ⚙️ Privacy & Personalization

- 🚫 Block and unblock users
- 🔕 Notification preferences
- 🌙 Dark mode
- ⚙️ User settings
- 🔐 Privacy controls

---

### 👤 Authentication & User System

- 🔑 Secure user authentication
- 👤 User profiles
- 🔄 Persistent sessions
- 🛡️ Protected application routes
- 🚪 Automatic authenticated redirects
- 🏠 Personal real-time Socket.IO rooms

---

## 🏗️ Production Architecture

Zline separates the traditional web application from its persistent real-time infrastructure.

```text
                         ┌───────────────────────────┐
                         │      MongoDB Atlas        │
                         │                           │
                         │ Messages • Users • Chats  │
                         │ Calls • Settings • Keys   │
                         └─────────────┬─────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
        ┌────────────────────────┐          ┌────────────────────────┐
        │      Next.js App       │          │   Socket.IO Server     │
        │        Vercel          │          │        Render          │
        │                        │          │                        │
        │ • Frontend             │          │ • Real-time events     │
        │ • NextAuth             │          │ • Presence             │
        │ • REST APIs            │          │ • Typing indicators    │
        │ • Database APIs        │          │ • WebRTC signaling     │
        │ • E2EE key APIs        │          │ • Call state           │
        └────────────┬───────────┘          └────────────┬───────────┘
                     │                                   │
                     │ HTTPS                         WSS │
                     │                                   │
                     └───────────────┬───────────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │   Browser   │
                              │             │
                              │ React UI    │
                              │ Web Crypto  │
                              │ WebRTC      │
                              └─────────────┘
```

The persistent Socket.IO server is intentionally deployed separately from the Next.js application because real-time WebSocket connections require a long-running server process.

---

# 🛠️ Tech Stack

## Frontend

- **Next.js 14**
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Lucide Icons**

## Backend

- **Next.js API Routes**
- **Node.js**
- **Express**
- **MongoDB Atlas**
- **Mongoose**

## Real-Time Communication

- **Socket.IO**
- **WebSockets**
- **WebRTC**
- **ICE/STUN**

## Authentication

- **NextAuth**

## Security & Encryption

- **Web Crypto API**
- **AES encryption**
- **Public-key cryptography**
- **Client-side E2EE key management**

## Notifications

- **Service Workers**
- **Web Push**
- **VAPID**

## Deployment

- **Vercel** — Next.js application
- **Render** — Persistent Socket.IO server
- **MongoDB Atlas** — Cloud database

---

# 📂 Project Structure

The main Zline application is structured approximately as follows:

```text
zline/
│
├── app/
│   ├── api/
│   │   ├── messages/
│   │   ├── calls/
│   │   ├── users/
│   │   ├── reactions/
│   │   └── ...
│   │
│   ├── (auth)/
│   ├── page.tsx
│   └── layout.tsx
│
├── components/
│   ├── SocketProvider.tsx
│   ├── CallModal.tsx
│   ├── GroupCallModal.tsx
│   ├── MessageActions.tsx
│   ├── ReplyPreview.tsx
│   ├── VoiceRecorder.tsx
│   ├── VoicePlayer.tsx
│   ├── ChatSearch.tsx
│   ├── PinnedMessages.tsx
│   ├── StarredMessages.tsx
│   ├── SettingsPanel.tsx
│   └── ...
│
├── lib/
│   ├── models/
│   ├── crypto.ts
│   └── ...
│
├── public/
│   ├── service-worker.js
│   └── ...
│
├── types/
├── package.json
└── README.md
```

The standalone Socket.IO server is maintained separately:

```text
Socket-Server-Zline/
│
├── src/
│   ├── models/
│   │   ├── Call.ts
│   │   └── Chat.ts
│   │
│   └── server.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

# 🚀 Getting Started

## Prerequisites

Make sure you have:

- Node.js installed
- npm installed
- A MongoDB Atlas database
- A modern browser with WebRTC support

---

## 1. Clone the Main Repository

```bash
git clone https://github.com/mhdsahil1/zline.git
cd zline
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create:

```text
.env.local
```

Example:

```env
# Authentication

NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Database

MONGO_URI=your_mongodb_atlas_connection_string

# Standalone Socket.IO server

NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Web Push

NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=mailto:your-email@example.com
```

> Never commit `.env`, `.env.local`, database credentials, authentication secrets, or private VAPID keys to GitHub.

---

# 🔌 Setting Up the Socket.IO Server

Zline uses a separate persistent Socket.IO server for production-grade real-time connections and WebRTC signaling.

Clone the signaling-server repository:

```bash
git clone https://github.com/mhdsahil1/Socket-Server-Zline.git
cd Socket-Server-Zline
```

Install dependencies:

```bash
npm install
```

Create:

```text
.env
```

Add:

```env
MONGO_URI=your_mongodb_atlas_connection_string
PORT=3001
```

Start the development server:

```bash
npm run dev
```

The Socket.IO server should now run at:

```text
http://localhost:3001
```

---

# ▶️ Running Zline Locally

Keep the Socket.IO server running in one terminal.

In another terminal, start the main application:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The local architecture becomes:

```text
Browser
   │
   ├──── HTTP ────► Next.js
   │                localhost:3000
   │
   └──── Socket ──► Socket.IO
                    localhost:3001
```

---

# 🧪 Development Verification

Before committing major changes, run:

```bash
npx tsc --noEmit
```

Then run the production build:

```bash
npm run build
```

For changes involving the standalone Socket.IO server:

```bash
cd Socket-Server-Zline
npx tsc --noEmit
```

Real-time features should also be manually tested using at least two accounts or devices.

Important regression tests include:

- Private messaging
- Group messaging
- End-to-end encryption
- Replies
- Edit/delete
- Reactions
- Read receipts
- Voice messages
- File sharing
- Search
- Pins
- Stars
- Blocking
- Voice calls
- Video calls
- Group calls
- Screen sharing
- Call history
- Push notifications
- Socket reconnection

---

# 🌐 Deployment

## Main Application

The Next.js application can be deployed to **Vercel**.

Production environment variables must include:

```env
NEXTAUTH_URL=https://your-production-domain.com

NEXTAUTH_SECRET=your_production_secret

MONGO_URI=your_mongodb_atlas_connection_string

NEXT_PUBLIC_SOCKET_URL=https://your-socket-server-domain.com

NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key

VAPID_PRIVATE_KEY=your_vapid_private_key

VAPID_EMAIL=mailto:your-email@example.com
```

---

## Socket.IO Server

The standalone Socket.IO server requires a platform capable of running a persistent Node.js process.

Examples include:

- Render
- Railway
- Fly.io
- A VPS

Configure the server's CORS policy to allow the production Zline frontend domain.

For example:

```ts
const allowedOrigins = [
  "http://localhost:3000",
  "https://your-production-domain.com",
];
```

---

# 🔒 Security Notes

Zline handles authentication, private communication, encryption keys, file uploads, and real-time connections.

Security-sensitive areas include:

- Authentication and authorization
- Socket.IO event authentication
- E2EE key management
- File validation
- Input validation
- Rate limiting
- XSS prevention
- NoSQL injection prevention
- Secure environment-variable management

Never expose:

- `NEXTAUTH_SECRET`
- MongoDB credentials
- VAPID private keys
- User private encryption keys
- Session tokens

> Zline is under active development and has not undergone an independent professional security audit.

---

# 📷 Screenshots

Add application screenshots here.

Example:

```markdown
![Zline Chat](./screenshots/chat.png)
![Zline Video Call](./screenshots/video-call.png)
![Zline Calls](./screenshots/calls.png)
```

Recommended screenshots:

- Main chat interface
- Private conversation
- Group conversation
- Voice/video call
- Calls history
- Settings
- Mobile interface

---

# 🗺️ Roadmap

## Completed

- [x] Authentication
- [x] Real-time private messaging
- [x] Group chats
- [x] Persistent standalone Socket.IO infrastructure
- [x] End-to-end encrypted private messaging
- [x] Message reactions
- [x] Enhanced read receipts
- [x] Message replies
- [x] Edit messages
- [x] Delete for everyone
- [x] Voice messages
- [x] In-conversation search
- [x] Pinned messages
- [x] Starred messages
- [x] File sharing
- [x] Drag-and-drop uploads
- [x] Voice calls
- [x] Video calls
- [x] Group calls
- [x] Screen sharing
- [x] Dedicated Calls tab
- [x] Call history
- [x] Push notifications
- [x] User blocking
- [x] Privacy and notification settings
- [x] Dark mode

## Planned / Future Improvements

- [ ] TURN server integration for improved WebRTC reliability
- [ ] Stronger Socket.IO connection authentication
- [ ] Automated integration and end-to-end testing
- [ ] Improved mobile/PWA experience
- [ ] Performance optimization
- [ ] Advanced group administration
- [ ] Better notification controls
- [ ] Security audit and hardening
- [ ] Android application distribution

---

# 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome.

1. Fork the repository.
2. Create a new feature branch.

```bash
git checkout -b feature/your-feature
```

3. Commit your changes.

```bash
git commit -m "Add your feature"
```

4. Push your branch.

```bash
git push origin feature/your-feature
```

5. Open a Pull Request.

Please test existing messaging, encryption, and real-time functionality before submitting major changes.

---

# ⚠️ Disclaimer

Zline is an independently developed software project created for learning, experimentation, and software-development experience.

Although the application implements security features including end-to-end encryption, it has not undergone a professional independent security audit.

Do not use Zline for highly sensitive or mission-critical communication without appropriate security review.

---

# 📄 License

This project is licensed under the **MIT License**.

---

# 👨‍💻 Author

**Sahil**

B.Tech Computer Science  
Specialization in Cyber Security

Built with ❤️ using **Next.js, TypeScript, MongoDB, Socket.IO, WebRTC, and the Web Crypto API**.

---

## ⭐ Support

If you find Zline interesting, consider giving the repository a star.

Every star provides approximately zero additional server capacity, but the emotional infrastructure appreciates it.
