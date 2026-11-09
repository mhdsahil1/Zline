import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChat extends Document {
  users: mongoose.Types.ObjectId[];
  isGroup: boolean;
  groupName?: string;
  groupAdmin?: mongoose.Types.ObjectId;
  latestMessage?: mongoose.Types.ObjectId;
  pinnedMessages: mongoose.Types.ObjectId[];
  disappearingTimer?: number; // Retention duration in seconds (max 7 days: 604800). Default: 604800
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAdmin: { type: Schema.Types.ObjectId, ref: "User" },
    latestMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    pinnedMessages: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    disappearingTimer: { type: Number, default: 7 * 24 * 60 * 60 }, // 7 days (604800s) default & max
  },
  { timestamps: true }
);

export const Chat: Model<IChat> = mongoose.models.Chat || mongoose.model<IChat>("Chat", chatSchema);
