import { api } from '@/lib/api';
import type {
  AppNotification, CompleteSummary, GameEvent, GameStateResponse, MapData, Progress, Quote, Ride, Transaction, User, Vehicle, VehicleSpec, World,
} from '@/types';

export const authApi = {
  register: (b: { name: string; email: string; password: string; mode: 'DRIVER' | 'PASSENGER' }) => api.post<{ token: string; user: User }>('/auth/register', b, false),
  login: (b: { email: string; password: string }) => api.post<{ token: string; user: User }>('/auth/login', b, false),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
  session: () => api.get<{ user: User }>('/auth/session'),
  forgot: (email: string) => api.post<{ ok: boolean; message: string; devToken?: string }>('/auth/forgot-password', { email }, false),
  reset: (token: string, password: string) => api.post<{ ok: boolean }>('/auth/reset-password', { token, password }, false),
};

export const userApi = {
  me: () => api.get<{ user: User; progress: Progress }>('/users/me'),
  update: (b: { name?: string; mode?: 'DRIVER' | 'PASSENGER' }) => api.patch<{ user: User }>('/users/me', b),
  changePassword: (b: { currentPassword: string; newPassword: string }) => api.patch<{ token: string }>('/users/me/password', b),
  notifications: () => api.get<{ unread: number; notifications: AppNotification[] }>('/users/me/notifications'),
  markRead: () => api.post<{ ok: boolean }>('/users/me/notifications/read'),
  ratings: () => api.get<{ ratings: Array<{ id: string; stars: number; comment?: string; tags: string[]; createdAt: string }> }>('/users/me/ratings'),
};

export const worldApi = {
  world: () => api.get<{ world: World }>('/world', false),
  map: () => api.get<MapData>('/world/map', false),
  route: (from: string, to: string, vehicle: string) =>
    api.get<{ route: { geometry: [number, number][]; distanceKm: number; durationMin: number; roads: string[] } }>(`/world/route?from=${from}&to=${to}&vehicle=${vehicle}`, false),
  leaderboard: () => api.get<{ leaders: Array<{ rank: number; name: string; level: number; rating: number; rides: number; totalEarnings: number }> }>('/leaderboard', false),
};

export const gameApi = {
  state: () => api.get<GameStateResponse>('/game/state'),
  checklist: () => api.get<{ items: Array<{ id: string; label: string; ok: boolean; detail: string }>; ready: boolean }>('/game/day/checklist'),
  startDay: () => api.post<{ progress: Progress }>('/game/day/start'),
  endDay: () => api.post<{ summary: { day: number; earnings: number; expenses: number; rides: number; net: number; grade: string }; progress: Progress }>('/game/day/end'),
  travel: (toKey: string) =>
    api.post<{ travel: NonNullable<GameStateResponse['me']['travel']>; route: { geometry: [number, number][]; roads: string[] }; vehicle: Vehicle }>('/game/travel', { toKey }),
  setLocation: (locationKey: string) => api.post<{ locationKey: string }>('/game/location', { locationKey }),
};

export const vehicleApi = {
  list: () => api.get<{ vehicles: Vehicle[] }>('/vehicles'),
  catalog: () => api.get<{ level: number; owned: number; maxVehicles: number; items: VehicleSpec[]; upgrades: Record<string, { label: string; description: string; maxLevel: number }> }>('/vehicles/catalog'),
  buy: (specId: string, paymentMethod: 'CASH' | 'BANK') => api.post<{ vehicle: Vehicle }>('/vehicles', { specId, paymentMethod }),
  activate: (id: string) => api.patch<{ vehicle: Vehicle }>(`/vehicles/${id}/activate`),
  refuel: (id: string, toPercent: number) => api.post<{ vehicle: Vehicle; liters: number; cost: number; pricePerLiter: number }>(`/vehicles/${id}/refuel`, { toPercent }),
  repair: (id: string, toCondition = 100) => api.post<{ vehicle: Vehicle; cost: number; points: number }>(`/vehicles/${id}/repair`, { toCondition }),
  wash: (id: string) => api.post<{ vehicle: Vehicle; cost: number }>(`/vehicles/${id}/wash`),
  upgrade: (id: string, kind: 'engine' | 'tyres' | 'interior') => api.post<{ vehicle: Vehicle; cost: number }>(`/vehicles/${id}/upgrade`, { kind }),
  rename: (id: string, nickname: string) => api.patch<{ vehicle: Vehicle }>(`/vehicles/${id}`, { nickname }),
};

export const fleetApi = {
  list: () => api.get<{ canHire: boolean; hiringFee: number; vehicles: Vehicle[] }>('/fleet'),
  hire: (id: string) => api.post<{ vehicle: Vehicle }>(`/fleet/${id}/hire`),
  dismiss: (id: string) => api.del<{ vehicle: Vehicle }>(`/fleet/${id}/driver`),
  collect: () => api.post<{ total: number; results: Array<{ vehicleId: string; trips: number; gross: number; net: number; blocked?: string }> }>('/fleet/collect'),
};

export const rideApi = {
  list: (limit = 20, skip = 0) => api.get<{ total: number; rides: Ride[] }>(`/rides?limit=${limit}&skip=${skip}`),
  active: () => api.get<{ ride: Ride | null }>('/rides/active'),
  offers: () => api.get<{ offers: Ride[] }>('/rides/offers'),
  quote: (originKey: string, destinationKey: string) => api.post<Quote>('/rides/quote', { originKey, destinationKey }),
  request: (quoteToken: string, paymentMethod: 'CASH' | 'BANK') => api.post<{ ride: Ride }>('/rides', { quoteToken, paymentMethod }),
  get: (id: string) => api.get<{ ride: Ride }>(`/rides/${id}`),
  accept: (id: string) => api.patch<{ ride: Ride }>(`/rides/${id}/accept`),
  decline: (id: string) => api.patch<{ ride: Ride }>(`/rides/${id}/decline`),
  start: (id: string) => api.patch<{ ride: Ride }>(`/rides/${id}/start`),
  complete: (id: string) => api.patch<{ ride: Ride; summary: CompleteSummary }>(`/rides/${id}/complete`),
  cancel: (id: string, reason?: string) => api.patch<{ ride: Ride; fee: number }>(`/rides/${id}/cancel`, { reason }),
  rate: (id: string, b: { stars: number; tags?: string[]; comment?: string; tip?: number }) => api.post<{ ride: Ride; tipPaid: number }>(`/rides/${id}/rate`, b),
};

export const walletApi = {
  get: () => api.get<{ cash: number; bank: number; net: number; byType: Array<{ type: string; total: number; count: number }> }>('/wallet'),
  deposit: (amount: number) => api.post<{ cash: number; bank: number }>('/wallet/deposit', { amount }),
  withdraw: (amount: number) => api.post<{ cash: number; bank: number }>('/wallet/withdraw', { amount }),
  transactions: (type?: string, limit = 40, skip = 0) =>
    api.get<{ total: number; transactions: Transaction[] }>(`/transactions?limit=${limit}&skip=${skip}${type ? `&type=${type}` : ''}`),
};

export const eventApi = {
  resolve: (id: string, optionId: string) =>
    api.post<{ event: GameEvent; applied: { delayMin: number; cash: number; fuel: number; condition: number; fareChange: number; cancelled: boolean; xp: number; lostCash: number; levelUp: { to: number; title: string } | null }; ride: Ride }>(`/events/${id}/resolve`, { optionId }),
};
