import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReaction {
  userId: mongoose.Types.ObjectId;
  emoji: string;
}

export interface IReadReceipt {
  userId: mongoose.Types.ObjectId;
  readAt: Date;
}

export interface IPollOption {
  text: string;
  votes: mongoose.Types.ObjectId[];
}

export interface IPoll {
  question: string;
  options: IPollOption[];
  isEnded: boolean;
}

export interface IMessage extends Document {
  chat: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  status: "sent" | "delivered" | "seen";
  type: "text" | "image" | "file" | "voice" | "poll";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  voiceDuration?: number;
  poll?: IPoll;
  replyTo?: mongoose.Types.ObjectId;
  isEdited: boolean;
  deletedFor: mongoose.Types.ObjectId[];
  deletedForEveryone: boolean;
  reactions: IReaction[];
  readBy: IReadReceipt[];
  isEncrypted?: boolean;
  encAesKey?: string;
  encAesKeyForSender?: string;
  iv?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reactionSchema = new Schema<IReaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
  },
  { _id: false }
);

const readReceiptSchema = new Schema<IReadReceipt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const pollOptionSchema = new Schema<IPollOption>(
  {
    text: { type: String, required: true },
    votes: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

const pollSchema = new Schema<IPoll>(
  {
    question: { type: String, required: true },
    options: [pollOptionSchema],
    isEnded: { type: Boolean, default: false },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    chat: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    type: {
      type: String,
      enum: ["text", "image", "file", "voice", "poll"],
      default: "text",
    },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    voiceDuration: { type: Number },
    poll: pollSchema,
    replyTo: { type: Schema.Types.ObjectId, ref: "Message" },
    isEdited: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
    deletedForEveryone: { type: Boolean, default: false },
    reactions: [reactionSchema],
    readBy: [readReceiptSchema],
    isEncrypted: { type: Boolean, default: false },
    encAesKey: { type: String },
    encAesKeyForSender: { type: String },
    iv: { type: String },
    // TTL index: MongoDB auto-deletes the document when expiresAt is reached.
    // Only set on media messages (image, file, voice). Text/poll messages never expire.
    expiresAt: { type: Date, index: { expires: 0 } },
  },
  { timestamps: true }
);

export const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>("Message", messageSchema);
