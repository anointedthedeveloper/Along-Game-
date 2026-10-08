import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const daySummarySchema = new Schema(
  { day: Number, earnings: Number, expenses: Number, rides: Number, startedAt: Date, endedAt: Date },
  { _id: false },
);

const progressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1, min: 1, max: 5 },
    // Driver reputation
    rating: { type: Number, default: 4.5, min: 1, max: 5 },
    ratingCount: { type: Number, default: 0 },
    ridesAsDriver: { type: Number, default: 0 },
    ridesAsPassenger: { type: Number, default: 0 },
    cancellations: { type: Number, default: 0 },
    lateArrivals: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    totalDistanceKm: { type: Number, default: 0 },
    // Current work day (driver)
    dayActive: { type: Boolean, default: false },
    dayNumber: { type: Number, default: 0 },
    dayStartedAt: Date,
    dailyEarnings: { type: Number, default: 0 },
    dailyExpenses: { type: Number, default: 0 },
    dailyRides: { type: Number, default: 0 },
    dayHistory: { type: [daySummarySchema], default: [] },
    achievements: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type ProgressAttrs = InferSchemaType<typeof progressSchema>;
export type ProgressDoc = HydratedDocument<ProgressAttrs>;
export const PlayerProgress = model('PlayerProgress', progressSchema);
