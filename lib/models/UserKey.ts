import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserKey extends Document {
  userId: mongoose.Types.ObjectId;
  publicKey: string; // JWK formatted public key string
  createdAt: Date;
  updatedAt: Date;
}

const userKeySchema = new Schema<IUserKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    publicKey: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserKey: Model<IUserKey> =
  mongoose.models.UserKey ||
  mongoose.model<IUserKey>("UserKey", userKeySchema);
