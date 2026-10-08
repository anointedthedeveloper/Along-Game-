import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const TRANSACTION_TYPES = [
  'RIDE_EARNING', 'RIDE_PAYMENT', 'FUEL_PURCHASE', 'MAINTENANCE', 'VEHICLE_PURCHASE',
  'VEHICLE_UPGRADE', 'FINE', 'REWARD', 'TIP', 'CANCELLATION_FEE', 'BANK_DEPOSIT',
  'BANK_WITHDRAWAL', 'FLEET_INCOME', 'DRIVER_WAGE', 'OTHER_EXPENSE', 'STARTER_GRANT',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

const transactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true, index: true },
    /** Signed change in Naira. Positive = money in, negative = money out. */
    amount: { type: Number, required: true },
    account: { type: String, enum: ['CASH', 'BANK'], default: 'CASH' },
    cashAfter: { type: Number, required: true },
    bankAfter: { type: Number, required: true },
    description: { type: String, required: true },
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', default: null },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

transactionSchema.index({ user: 1, createdAt: -1 });

export type TransactionAttrs = InferSchemaType<typeof transactionSchema>;
export type TransactionDoc = HydratedDocument<TransactionAttrs>;
export const Transaction = model('Transaction', transactionSchema);
