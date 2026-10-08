export type LatLng = [number, number];
export type Mode = 'DRIVER' | 'PASSENGER';
export type WeatherKind = 'SUNNY' | 'CLOUDY' | 'RAIN' | 'HEAVY_RAIN';
export type Phase = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
export type RideStatus = 'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type VehicleClass = 'MOTORCYCLE' | 'KEKE' | 'SEDAN_TAXI' | 'COROLLA' | 'CAMRY' | 'MINIBUS' | 'BUS' | 'PRIVATE_CAR';
export type LocationType =
  | 'DISTRICT' | 'LANDMARK' | 'PETROL_STATION' | 'BUS_STOP' | 'PARKING' | 'MARKET' | 'MALL' | 'HOSPITAL'
  | 'GOVERNMENT' | 'HOTEL' | 'AIRPORT' | 'RESIDENTIAL' | 'SCHOOL' | 'MOTOR_PARK' | 'BUSINESS' | 'GARAGE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'PLAYER' | 'ADMIN';
  mode: Mode;
  cash: number;
  bank: number;
  locationKey: string;
  avatarSeed: string;
  createdAt: string;
}

export interface GameClock {
  totalMinutes: number;
  day: number;
  minuteOfDay: number;
  hour: number;
  minute: number;
  label: string;
  phase: Phase;
  daylight: number;
  speed: number;
}

export interface Weather {
  kind: WeatherKind;
  label: string;
  speedFactor: number;
  trafficAdd: number;
  demandFactor: number;
  fareFactor: number;
  intensity: number;
}

export interface Incident {
  id: string;
  kind: 'CONSTRUCTION' | 'CLOSURE' | 'ACCIDENT' | 'FLOOD';
  edgeId: string;
  label: string;
  roadName: string;
  pos: LatLng;
  speedFactor: number;
  blocked: boolean;
}

export interface World {
  serverTime: number;
  clock: GameClock;
  weather: Weather;
  traffic: number;
  demand: number;
  surge: number;
  fuelPrice: number;
  fuelShortage: boolean;
  incidents: Incident[];
}

export interface District {
  id: string;
  name: string;
  kind: 'COMMERCIAL' | 'GOVERNMENT' | 'RESIDENTIAL' | 'MIXED' | 'TRANSIT';
  center: LatLng;
  radiusKm: number;
  unlockLevel: number;
  risk: number;
  demand: number;
  blurb: string;
}

export interface RoadNode { id: string; name: string; district: string; pos: LatLng }
export interface RoadEdge { id: string; roadId: string; name: string; cls: 'EXPRESSWAY' | 'ARTERIAL' | 'LOCAL'; from: string; to: string; geometry: LatLng[]; km: number }
export interface GameLocation {
  key: string;
  name: string;
  type: LocationType;
  district: string;
  nodeId: string;
  pos: LatLng;
  description: string;
}
export interface LevelDef { level: number; title: string; xp: number; minRating: number; maxVehicles: number; canHire: boolean; perk: string }

export interface MapData {
  districts: District[];
  nodes: RoadNode[];
  edges: RoadEdge[];
  locations: GameLocation[];
  levels: LevelDef[];
}

export interface Progress {
  xp: number;
  level: number;
  title: string;
  perk: string;
  maxVehicles: number;
  canHire: boolean;
  nextLevel: { level: number; title: string; xp: number; minRating: number; perk: string } | null;
  xpIntoLevel: number;
  xpForNext: number;
  rating: number;
  ratingCount: number;
  ridesAsDriver: number;
  ridesAsPassenger: number;
  cancellations: number;
  lateArrivals: number;
  totalEarnings: number;
  totalExpenses: number;
  totalDistanceKm: number;
  unlockedDistricts: string[];
  reputation: { rating: number; completionRate: number; punctuality: number; cancellationRate: number; score: number };
  day: { active: boolean; number: number; startedAt?: string; earnings: number; expenses: number; rides: number };
  dayHistory: Array<{ day: number; earnings: number; expenses: number; rides: number; startedAt: string; endedAt: string }>;
}

export interface Vehicle {
  id: string;
  specId: string;
  cls: VehicleClass;
  name: string;
  nickname: string;
  plate: string;
  color: string;
  condition: number;
  cleanliness: number;
  fuel: number;
  fuelPercent: number;
  odometerKm: number;
  upgrades: { engine: number; tyres: number; interior: number };
  stats: { speedKph: number; fuelPer100km: number; tankLiters: number; comfort: number; reliability: number; capacity: number; maintenancePerKm: number };
  range: number;
  repairCostPerPoint: number;
  hiredDriver: null | { name: string; skill: number; wagePercent: number; hiredAt: string; lastCollectedAt: string };
  purchasePrice: number;
  active?: boolean;
  projection?: null | { gameMinutes: number; trips: number; gross: number; fuelCost: number; wage: number; net: number; wear: number; blocked?: string };
}

export interface VehicleSpec {
  id: string;
  cls: VehicleClass;
  name: string;
  tagline: string;
  price: number;
  fuelPer100km: number;
  tankLiters: number;
  capacity: number;
  speedKph: number;
  comfort: number;
  reliability: number;
  maintenancePerKm: number;
  demand: number;
  minLevel: number;
  restrictedDistricts: string[];
  onlyDistricts: string[] | null;
  locked: boolean;
  colors: string[];
}

export interface Npc {
  name: string;
  rating: number;
  vehicleName?: string;
  vehicleClass?: string;
  plate?: string;
  color?: string;
  tier?: 'STANDARD' | 'PREMIUM' | 'VIP';
  groupSize?: number;
  bio?: string;
}

export interface Place { key: string; name: string; district: string; lat: number; lng: number }

export interface GameEvent {
  id: string;
  ride: string | null;
  role: Mode;
  type: string;
  category: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
  options: Array<{ id: string; label: string; hint: string }>;
  triggerAt: number;
  status: 'PENDING' | 'RESOLVED' | 'EXPIRED';
  choice: string | null;
  outcome: null | { message: string; effects: Record<string, unknown> };
}

export interface Ride {
  id: string;
  kind: 'DRIVER_OFFER' | 'PASSENGER_REQUEST';
  status: RideStatus;
  role: Mode;
  vehicleClass: VehicleClass;
  vehicleId: string | null;
  origin: Place;
  destination: Place;
  distanceKm: number;
  durationMin: number;
  pickupDistanceKm: number;
  pickupMin: number;
  fare: { base: number; multiplier: number; adjustment: number; final: number; tip: number };
  surge: number;
  weather?: string;
  npcPassenger: Npc | null;
  npcDriver: Npc | null;
  history: Array<{ status: RideStatus; at: string }>;
  requestedAt: string;
  matchedAt: string | null;
  arrivingAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  delayMin: number;
  paid: boolean;
  paymentMethod: 'CASH' | 'BANK';
  rating: number | null;
  late: boolean;
  xpAwarded: number;
  roads: string[];
  geometry: LatLng[];
  pickupGeometry: LatLng[];
  eventNotes: string[];
  timing: { serverNow: number; pickupSeconds: number; tripSeconds: number; gameSpeed: number };
  events?: GameEvent[];
}

export interface QuoteOption {
  optionId: string;
  specId: string;
  vehicleClass: VehicleClass;
  vehicleName: string;
  available: boolean;
  reason?: string;
  fare: number;
  surge: number;
  etaMin: number;
  distanceKm: number;
  durationMin: number;
  driver: { name: string; rating: number; trips: number; plate: string; color: string; bio: string };
  comfort: number;
  capacity: number;
  quoteToken?: string;
}

export interface Quote {
  origin: GameLocation;
  destination: GameLocation;
  distanceKm: number;
  roads: string[];
  geometry: LatLng[];
  expiresInSec: number;
  options: QuoteOption[];
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  account: 'CASH' | 'BANK';
  cashAfter: number;
  bankAfter: number;
  description: string;
  ride: string | null;
  createdAt: string;
}

export interface AppNotification { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }

export interface GameStateResponse {
  world: World;
  me: { id: string; name: string; mode: Mode; cash: number; bank: number; locationKey: string; location: GameLocation | null; travel: null | { fromKey: string; toKey: string; startedAt: string; arriveAt: string; distanceKm: number; durationMin: number } };
  progress: Progress;
  vehicle: Vehicle | null;
}

export interface CompleteSummary {
  fare?: number;
  earnings?: number;
  paid?: number;
  tip?: number;
  fuelUsed?: number;
  wear?: number;
  xp: number;
  rating?: number;
  ratingComment?: string;
  ratingFactors?: Record<string, number>;
  levelUp?: { from: number; to: number; title: string } | null;
  late?: boolean;
}
