import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const RIDE_STATUSES = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

const placeSchema = new Schema(
  { key: String, name: String, district: String, lat: Number, lng: Number },
  { _id: false },
);

const npcSchema = new Schema(
  {
    name: String,
    rating: Number,
    vehicleName: String,
    vehicleClass: String,
    plate: String,
    color: String,
    tier: { type: String, enum: ['STANDARD', 'PREMIUM', 'VIP'], default: 'STANDARD' },
    groupSize: { type: Number, default: 1 },
    bio: String,
  },
  { _id: false },
);

const fareSchema = new Schema(
  {
    base: { type: Number, required: true },
    multiplier: { type: Number, default: 1 },
    adjustment: { type: Number, default: 0 },
    final: { type: Number, required: true },
    tip: { type: Number, default: 0 },
  },
  { _id: false },
);

const rideSchema = new Schema(
  {
    /** DRIVER_OFFER: server generated demand offered to a driver. PASSENGER_REQUEST: requested by a player passenger. */
    kind: { type: String, enum: ['DRIVER_OFFER', 'PASSENGER_REQUEST'], required: true },
    passenger: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    npcPassenger: { type: npcSchema, default: null },
    npcDriver: { type: npcSchema, default: null },
    vehicleClass: { type: String, required: true },
    origin: { type: placeSchema, required: true },
    destination: { type: placeSchema, required: true },
    routeNodeIds: [String],
    routeGeometry: { type: Schema.Types.Mixed, default: [] },
    pickupGeometry: { type: Schema.Types.Mixed, default: [] },
    roads: [String],
    distanceKm: { type: Number, required: true },
    durationMin: { type: Number, required: true },
    /** Distance/time for the driver to reach the pickup point. */
    pickupDistanceKm: { type: Number, default: 0 },
    pickupMin: { type: Number, default: 0 },
    fare: { type: fareSchema, required: true },
    surge: { type: Number, default: 1 },
    weather: String,
    status: { type: String, enum: RIDE_STATUSES, default: 'REQUESTED', index: true },
    history: [{ status: String, at: Date, _id: false }],
    requestedAt: { type: Date, default: Date.now },
    matchedAt: Date,
    arrivingAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    expiresAt: Date,
    cancelledBy: { type: String, enum: ['DRIVER', 'PASSENGER', 'SYSTEM', 'EVENT', null], default: null },
    cancelReason: String,
    /** Extra in-game minutes added by events. */
    delayMin: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'BANK'], default: 'CASH' },
    paid: { type: Boolean, default: false },
    rating: { type: Number, default: null },
    ratingTags: [String],
    xpAwarded: { type: Number, default: 0 },
    late: { type: Boolean, default: false },
    /** Rating modifier accumulated from event choices (fair pricing, behaviour). */
    ratingMod: { type: Number, default: 0 },
    eventNotes: [String],
    eventsRolled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

rideSchema.index({ driver: 1, status: 1 });
rideSchema.index({ passenger: 1, status: 1 });

export type RideAttrs = InferSchemaType<typeof rideSchema>;
export type RideDoc = HydratedDocument<RideAttrs>;
export const Ride = model('Ride', rideSchema);
