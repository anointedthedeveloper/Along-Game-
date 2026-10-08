export const naira = (n: number | undefined | null): string => `₦${Math.round(n ?? 0).toLocaleString('en-NG')}`;
export const km = (n: number): string => `${n.toFixed(1)} km`;
export const mins = (n: number): string => `${Math.round(n)} min`;
export const pct = (n: number): string => `${Math.round(n)}%`;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export const TX_LABEL: Record<string, string> = {
  RIDE_EARNING: 'Ride earning', RIDE_PAYMENT: 'Ride payment', FUEL_PURCHASE: 'Fuel', MAINTENANCE: 'Maintenance',
  VEHICLE_PURCHASE: 'Vehicle purchase', VEHICLE_UPGRADE: 'Upgrade', FINE: 'Fine', REWARD: 'Reward', TIP: 'Tip',
  CANCELLATION_FEE: 'Cancellation fee', BANK_DEPOSIT: 'Bank deposit', BANK_WITHDRAWAL: 'Bank withdrawal',
  FLEET_INCOME: 'Fleet income', DRIVER_WAGE: 'Driver wage', OTHER_EXPENSE: 'Other expense', STARTER_GRANT: 'Starter cash',
};

export const LOCATION_LABEL: Record<string, string> = {
  DISTRICT: 'District', LANDMARK: 'Landmark', PETROL_STATION: 'Petrol station', BUS_STOP: 'Bus stop', PARKING: 'Parking',
  MARKET: 'Market', MALL: 'Mall', HOSPITAL: 'Hospital', GOVERNMENT: 'Government', HOTEL: 'Hotel', AIRPORT: 'Airport',
  RESIDENTIAL: 'Residential', SCHOOL: 'School', MOTOR_PARK: 'Motor park', BUSINESS: 'Business', GARAGE: 'Garage',
};
