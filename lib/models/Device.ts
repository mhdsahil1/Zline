import mongoose, { Schema, Document, Model } from "mongoose";

export type DeviceType = "desktop" | "laptop" | "mobile" | "tablet" | "browser";

export interface IDevice extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  publicKey: string; // JWK-formatted RSA-OAEP public key
  fingerprint: string; // SHA-256 fingerprint formatted in hex blocks
  isVerified: boolean;
  verifiedByDeviceId?: string;
  isRevoked: boolean;
  revokedAt?: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, required: true, unique: true, index: true },
    deviceName: { type: String, required: true },
    deviceType: {
      type: String,
      enum: ["desktop", "laptop", "mobile", "tablet", "browser"],
      default: "browser",
    },
    publicKey: { type: String, required: true },
    fingerprint: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    verifiedByDeviceId: { type: String },
    isRevoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound indexes for performant lookups
deviceSchema.index({ userId: 1, isRevoked: 1 });
deviceSchema.index({ userId: 1, deviceId: 1 });

export const Device: Model<IDevice> =
  mongoose.models.Device || mongoose.model<IDevice>("Device", deviceSchema);

