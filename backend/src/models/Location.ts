import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const locationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true, index: true },
    district: { type: String, required: true, index: true },
    nodeId: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true },
);

export type LocationAttrs = InferSchemaType<typeof locationSchema>;
export type LocationDoc = HydratedDocument<LocationAttrs>;
export const Location = model('Location', locationSchema);
