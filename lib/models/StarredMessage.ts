import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStarredMessage extends Document {
  userId: mongoose.Types.ObjectId;
  messageId: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const starredMessageSchema = new Schema<IStarredMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
  },
  { timestamps: true }
);

// Compound unique index: a user can star a message only once
starredMessageSchema.index({ userId: 1, messageId: 1 }, { unique: true });

export const StarredMessage: Model<IStarredMessage> =
  mongoose.models.StarredMessage ||
  mongoose.model<IStarredMessage>("StarredMessage", starredMessageSchema);
