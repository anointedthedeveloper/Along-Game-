import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });
export const paymentMethod = z.enum(['CASH', 'BANK']).default('CASH');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(40),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  mode: z.enum(['DRIVER', 'PASSENGER']).default('DRIVER'),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(100),
});
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(100) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) });
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  mode: z.enum(['DRIVER', 'PASSENGER']).optional(),
});

export const amountSchema = z.object({ amount: z.number().int('Amount must be a whole number of Naira').positive().max(100_000_000) });

export const quoteSchema = z.object({ originKey: z.string().min(1).max(60), destinationKey: z.string().min(1).max(60) });
export const requestRideSchema = z.object({ quoteToken: z.string().min(20), paymentMethod });
export const cancelSchema = z.object({ reason: z.string().trim().max(120).optional() });
export const rateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(24)).max(5).optional(),
  comment: z.string().trim().max(280).optional(),
  tip: z.number().int().min(0).max(20_000).optional(),
});
export const ridesQuery = z.object({
  status: z.enum(['REQUESTED', 'MATCHED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

export const buyVehicleSchema = z.object({ specId: z.string().min(1), paymentMethod });
export const refuelSchema = z.object({ liters: z.number().positive().max(200).optional(), toPercent: z.number().min(1).max(100).optional() });
export const repairSchema = z.object({ toCondition: z.number().min(1).max(100).optional() });
export const upgradeSchema = z.object({ kind: z.enum(['engine', 'tyres', 'interior']) });
export const renameSchema = z.object({ nickname: z.string().trim().max(24) });

export const resolveEventSchema = z.object({ optionId: z.string().min(1).max(40) });
export const eventsQuery = z.object({
  status: z.enum(['PENDING', 'RESOLVED', 'EXPIRED']).optional(),
  ride: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const travelSchema = z.object({ toKey: z.string().min(1).max(60) });
export const locationSchema = z.object({ locationKey: z.string().min(1).max(60) });
export const txQuery = z.object({
  type: z.string().max(30).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  skip: z.coerce.number().int().min(0).default(0),
});
export const routeQuery = z.object({ from: z.string().min(1), to: z.string().min(1), vehicle: z.string().default('sedan_taxi') });
