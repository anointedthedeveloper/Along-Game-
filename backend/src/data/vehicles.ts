export type VehicleClass =
  | 'MOTORCYCLE' | 'KEKE' | 'SEDAN_TAXI' | 'COROLLA' | 'CAMRY' | 'MINIBUS' | 'BUS' | 'PRIVATE_CAR';

export interface VehicleSpec {
  id: string;
  cls: VehicleClass;
  name: string;
  tagline: string;
  /** Purchase price in Naira. */
  price: number;
  /** Litres per 100 km. */
  fuelPer100km: number;
  tankLiters: number;
  /** Seats available to passengers. */
  capacity: number;
  /** Top cruising speed in km/h. */
  speedKph: number;
  /** 1..10 */
  comfort: number;
  /** 1..10 */
  reliability: number;
  /** Wear/servicing reserve per km in Naira (tyres, oil, brake pads). */
  maintenancePerKm: number;
  /** Relative passenger demand, 0..1.5 */
  demand: number;
  /** Multiplier on the base per-person fare. */
  fareMultiplier: number;
  /** Passengers carried per trip at most (earnings scale with group size). */
  maxGroup: number;
  /** Driver level required to buy. */
  minLevel: number;
  /** Districts the vehicle may NOT start or end a trip in (city by-laws). */
  restrictedDistricts: string[];
  /** If set, the vehicle may ONLY operate in these districts. */
  onlyDistricts?: string[];
  colors: string[];
}

export const VEHICLES: VehicleSpec[] = [
  {
    id: 'okada', cls: 'MOTORCYCLE', name: 'Okada (Bajaj Boxer)', tagline: 'Fast through traffic. Banned in the city centre.',
    price: 220_000, fuelPer100km: 2.6, tankLiters: 12, capacity: 1, speedKph: 70, comfort: 2, reliability: 6,
    maintenancePerKm: 12, demand: 0.7, fareMultiplier: 0.6, maxGroup: 1, minLevel: 1, restrictedDistricts: [],
    onlyDistricts: ['gwarinpa', 'kubwa', 'airport_road', 'utako', 'jabi'], colors: ['#1c1c1c', '#7a1d1d', '#1f3a5f'],
  },
  {
    id: 'keke', cls: 'KEKE', name: 'Keke Napep Tricycle', tagline: 'Cheap local hops. Not allowed in CBD, Maitama or Asokoro.',
    price: 380_000, fuelPer100km: 4.5, tankLiters: 10, capacity: 3, speedKph: 45, comfort: 3, reliability: 6,
    maintenancePerKm: 18, demand: 0.8, fareMultiplier: 0.7, maxGroup: 3, minLevel: 1,
    restrictedDistricts: ['cbd', 'maitama', 'asokoro'], colors: ['#f2b705', '#e0a800'],
  },
  {
    id: 'sedan_taxi', cls: 'SEDAN_TAXI', name: 'Sedan Taxi (Nissan Sunny)', tagline: 'The classic green-and-white city cab.',
    price: 700_000, fuelPer100km: 9.5, tankLiters: 42, capacity: 4, speedKph: 90, comfort: 4, reliability: 5,
    maintenancePerKm: 30, demand: 1.0, fareMultiplier: 1.0, maxGroup: 2, minLevel: 1, restrictedDistricts: [],
    colors: ['#f4f4f0', '#e8e8e2'],
  },
  {
    id: 'corolla', cls: 'COROLLA', name: 'Toyota Corolla', tagline: 'Nigeria\'s favourite. Reliable and easy to fix.',
    price: 1_200_000, fuelPer100km: 8.0, tankLiters: 50, capacity: 4, speedKph: 110, comfort: 6, reliability: 8,
    maintenancePerKm: 28, demand: 1.1, fareMultiplier: 1.15, maxGroup: 2, minLevel: 2, restrictedDistricts: [],
    colors: ['#b9bcc2', '#2b3340', '#f4f4f0', '#7c1d1d'],
  },
  {
    id: 'camry', cls: 'CAMRY', name: 'Toyota Camry', tagline: 'Comfortable ride for executives and long trips.',
    price: 2_200_000, fuelPer100km: 9.0, tankLiters: 60, capacity: 4, speedKph: 120, comfort: 8, reliability: 8,
    maintenancePerKm: 38, demand: 1.0, fareMultiplier: 1.5, maxGroup: 2, minLevel: 3, restrictedDistricts: [],
    colors: ['#14181f', '#c8ccd2', '#3a1d1d'],
  },
  {
    id: 'private_car', cls: 'PRIVATE_CAR', name: 'Private Car (Honda Accord)', tagline: 'Chauffeur-style premium rides.',
    price: 1_800_000, fuelPer100km: 9.0, tankLiters: 60, capacity: 4, speedKph: 115, comfort: 9, reliability: 8,
    maintenancePerKm: 35, demand: 0.7, fareMultiplier: 1.7, maxGroup: 2, minLevel: 3, restrictedDistricts: [],
    colors: ['#0f1115', '#d5d8dc'],
  },
  {
    id: 'minibus', cls: 'MINIBUS', name: 'Toyota HiAce Minibus', tagline: 'Carry a full load on busy routes.',
    price: 3_200_000, fuelPer100km: 13.0, tankLiters: 70, capacity: 14, speedKph: 90, comfort: 3, reliability: 6,
    maintenancePerKm: 55, demand: 1.2, fareMultiplier: 0.55, maxGroup: 10, minLevel: 3, restrictedDistricts: [],
    colors: ['#f4f4f0', '#f2b705'],
  },
  {
    id: 'bus', cls: 'BUS', name: 'Toyota Coaster Bus', tagline: 'City-to-city commuter bus. Big earnings, big bills.',
    price: 5_500_000, fuelPer100km: 17.0, tankLiters: 90, capacity: 28, speedKph: 80, comfort: 4, reliability: 7,
    maintenancePerKm: 80, demand: 1.0, fareMultiplier: 0.5, maxGroup: 22, minLevel: 4, restrictedDistricts: [],
    colors: ['#f4f4f0', '#1f6f43'],
  },
];

export const START_VEHICLE_ID = 'sedan_taxi';
export const vehicleSpec = (id: string): VehicleSpec | undefined => VEHICLES.find((v) => v.id === id);
export const specForClass = (cls: VehicleClass): VehicleSpec => {
  const spec = VEHICLES.find((v) => v.cls === cls);
  if (!spec) throw new Error(`no spec for ${cls}`);
  return spec;
};

export type UpgradeKind = 'engine' | 'tyres' | 'interior';
export const UPGRADES: Record<UpgradeKind, { label: string; description: string; baseCostFactor: number; maxLevel: number }> = {
  engine: { label: 'Engine tune-up', description: '+6% speed and −6% fuel use per level', baseCostFactor: 0.06, maxLevel: 3 },
  tyres: { label: 'Heavy-duty tyres', description: 'Fewer flat tyres and more reliability per level', baseCostFactor: 0.04, maxLevel: 3 },
  interior: { label: 'Interior & AC', description: '+1 comfort per level and happier passengers', baseCostFactor: 0.05, maxLevel: 3 },
};
