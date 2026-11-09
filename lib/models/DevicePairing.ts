import mongoose, { Schema, Document, Model } from "mongoose";
import { DeviceType } from "./Device";

export type PairingStatus = "pending" | "approved" | "rejected" | "expired";

export interface IDevicePairing extends Document {
  pairingId: string;
  targetDeviceId: string;
  targetDeviceName: string;
  targetDeviceType: DeviceType;
  targetPublicKey: string;
  targetFingerprint: string;
  challenge: string;
  status: PairingStatus;
  approvedByUserId?: mongoose.Types.ObjectId;
  approvedByDeviceId?: string;
  transferToken?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const devicePairingSchema = new Schema<IDevicePairing>(
  {
    pairingId: { type: String, required: true, unique: true, index: true },
    targetDeviceId: { type: String, required: true, index: true },
    targetDeviceName: { type: String, required: true },
    targetDeviceType: {
      type: String,
      enum: ["desktop", "laptop", "mobile", "tablet", "browser"],
      default: "browser",
    },
    targetPublicKey: { type: String, required: true },
    targetFingerprint: { type: String, required: true },
    challenge: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      default: "pending",
      index: true,
    },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    approvedByDeviceId: { type: String },
    transferToken: { type: String },
    // TTL index auto-deletes the document once expiresAt is reached
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export const DevicePairing: Model<IDevicePairing> =
  mongoose.models.DevicePairing ||
  mongoose.model<IDevicePairing>("DevicePairing", devicePairingSchema);

