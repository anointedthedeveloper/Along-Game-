import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const upgradesSchema = new Schema(
  {
    engine: { type: Number, default: 0, min: 0, max: 3 },
    tyres: { type: Number, default: 0, min: 0, max: 3 },
    interior: { type: Number, default: 0, min: 0, max: 3 },
  },
  { _id: false },
);

const vehicleSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    specId: { type: String, required: true },
    nickname: { type: String, default: '' },
    plate: { type: String, required: true },
    color: { type: String, required: true },
    /** 0..100 */
    condition: { type: Number, default: 100, min: 0, max: 100 },
    /** 0..100 */
    cleanliness: { type: Number, default: 90, min: 0, max: 100 },
    /** Litres currently in the tank. */
    fuel: { type: Number, default: 0, min: 0 },
    odometerKm: { type: Number, default: 0 },
    upgrades: { type: upgradesSchema, default: () => ({}), required: true },
    /** Business mode: a hired driver works this vehicle while the owner is away. */
    hiredDriver: {
      type: new Schema(
        {
          name: String,
          skill: Number,
          wagePercent: Number,
          hiredAt: Date,
          lastCollectedAt: Date,
        },
        { _id: false },
      ),
      default: null,
    },
    purchasePrice: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type VehicleAttrs = InferSchemaType<typeof vehicleSchema>;
export type VehicleDoc = HydratedDocument<VehicleAttrs>;
export const Vehicle = model('Vehicle', vehicleSchema);
