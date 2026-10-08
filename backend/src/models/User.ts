import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const travelSchema = new Schema(
  {
    fromKey: String,
    toKey: String,
    startedAt: Date,
    arriveAt: Date,
    distanceKm: Number,
    durationMin: Number,
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['PLAYER', 'ADMIN'], default: 'PLAYER' },
    mode: { type: String, enum: ['DRIVER', 'PASSENGER'], default: 'DRIVER' },
    /** Wallet: whole Naira. Mutated only by wallet.service with atomic operators. */
    cash: { type: Number, default: 0, min: 0 },
    bank: { type: Number, default: 0, min: 0 },
    locationKey: { type: String, default: 'wuse_hub' },
    travel: { type: travelSchema, default: null },
    activeVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    avatarSeed: { type: String, default: () => Math.random().toString(36).slice(2, 8) },
    passwordReset: {
      tokenHash: { type: String, select: false },
      expiresAt: { type: Date, select: false },
    },
    lastLoginAt: Date,
    passwordChangedAt: Date,
  },
  { timestamps: true },
);

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const User = model('User', userSchema);
