import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const optionSchema = new Schema({ id: String, label: String, hint: String }, { _id: false });

const gameEventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', default: null, index: true },
    role: { type: String, enum: ['DRIVER', 'PASSENGER'], required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ['INFO', 'WARNING', 'DANGER'], default: 'INFO' },
    options: [optionSchema],
    /** Fraction of the trip (0..1) at which the event should surface to the player. */
    triggerAt: { type: Number, default: 0.5 },
    status: { type: String, enum: ['PENDING', 'RESOLVED', 'EXPIRED'], default: 'PENDING', index: true },
    choice: String,
    outcome: {
      message: String,
      effects: Schema.Types.Mixed,
    },
    resolvedAt: Date,
  },
  { timestamps: true },
);

export type GameEventAttrs = InferSchemaType<typeof gameEventSchema>;
export type GameEventDoc = HydratedDocument<GameEventAttrs>;
export const GameEvent = model('GameEvent', gameEventSchema);
