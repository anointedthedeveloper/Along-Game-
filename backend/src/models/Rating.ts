import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const ratingSchema = new Schema(
  {
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    toUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    /** Who is being rated. */
    targetRole: { type: String, enum: ['DRIVER', 'PASSENGER'], required: true },
    targetName: String,
    stars: { type: Number, required: true, min: 1, max: 5 },
    tags: [String],
    comment: { type: String, maxlength: 280 },
    /** Breakdown of how a server-generated rating was derived. */
    factors: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type RatingAttrs = InferSchemaType<typeof ratingSchema>;
export type RatingDoc = HydratedDocument<RatingAttrs>;
export const Rating = model('Rating', ratingSchema);
