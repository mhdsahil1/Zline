import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICall extends Document {
  chatId?: mongoose.Types.ObjectId;
  caller: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  type: "voice" | "video";
  status: "missed" | "completed" | "rejected" | "cancelled";
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

const callSchema = new Schema<ICall>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: "Chat" },
    caller: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    type: { type: String, enum: ["voice", "video"], required: true },
    status: {
      type: String,
      enum: ["missed", "completed", "rejected", "cancelled"],
      default: "missed",
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    duration: { type: Number },
  },
  { timestamps: true }
);

export const Call: Model<ICall> = mongoose.models.Call || mongoose.model<ICall>("Call", callSchema);
