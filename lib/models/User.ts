import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserSettings {
  readReceipts: boolean;
  lastSeenVisible: boolean;
  theme: "light" | "dark" | "system";
  notificationSound: boolean;
  notificationPreview: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  isOnline: boolean;
  lastSeen: Date;
  blockedUsers: mongoose.Types.ObjectId[];
  settings: IUserSettings;
  createdAt: Date;
  updatedAt: Date;
}

const userSettingsSchema = new Schema<IUserSettings>(
  {
    readReceipts: { type: Boolean, default: true },
    lastSeenVisible: { type: Boolean, default: true },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    notificationSound: { type: Boolean, default: true },
    notificationPreview: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // optional for OAuth users
    image: { type: String },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    settings: { type: userSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
