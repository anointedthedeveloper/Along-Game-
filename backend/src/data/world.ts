import type { LatLng } from '../utils/geo';
import { hashString, mulberry32 } from '../utils/rng';
import { polylineKm } from '../utils/geo';

/**
 * The static geography of Along City — a fictional capital territory modelled on Abuja.
 * Coordinates are approximate and intentionally stylised.
 */

export type DistrictId =
  | 'cbd' | 'wuse' | 'garki' | 'area1' | 'area2' | 'maitama'
  | 'asokoro' | 'jabi' | 'utako' | 'gwarinpa' | 'kubwa' | 'airport_road';

export type DistrictKind = 'COMMERCIAL' | 'GOVERNMENT' | 'RESIDENTIAL' | 'MIXED' | 'TRANSIT';

export interface DistrictDef {
  id: DistrictId;
  name: string;
  kind: DistrictKind;
  center: LatLng;
  radiusKm: number;
  /** Driver level needed before rides in this district are offered. */
  unlockLevel: number;
  /** 0..1 — baseline security risk used by event rolls. */
  risk: number;
  /** Relative passenger demand of the district. */
  demand: number;
  blurb: string;
}

export const DISTRICTS: DistrictDef[] = [
  { id: 'cbd', name: 'Central Business District', kind: 'GOVERNMENT', center: [9.0555, 7.4960], radiusKm: 2.2, unlockLevel: 1, risk: 0.08, demand: 1.3, blurb: 'Ministries, banks and the Three Arms Zone. Peak-hour jams every weekday.' },
  { id: 'wuse', name: 'Wuse', kind: 'COMMERCIAL', center: [9.0745, 7.4755], radiusKm: 2.0, unlockLevel: 1, risk: 0.12, demand: 1.5, blurb: 'Markets, malls and nightlife. The busiest district in the city.' },
  { id: 'garki', name: 'Garki', kind: 'MIXED', center: [9.0300, 7.4890], radiusKm: 1.8, unlockLevel: 1, risk: 0.15, demand: 1.2, blurb: 'Dense neighbourhoods, Garki Market and motor parks.' },
  { id: 'area1', name: 'Area 1', kind: 'MIXED', center: [9.0430, 7.4770], radiusKm: 1.1, unlockLevel: 1, risk: 0.12, demand: 1.0, blurb: 'Shopping plaza, shops and government quarters.' },
  { id: 'area2', name: 'Area 2', kind: 'RESIDENTIAL', center: [9.0370, 7.4830], radiusKm: 1.0, unlockLevel: 1, risk: 0.1, demand: 0.9, blurb: 'Quiet quarters and the Area 2 shopping centre.' },
  { id: 'utako', name: 'Utako', kind: 'COMMERCIAL', center: [9.0635, 7.4450], radiusKm: 1.7, unlockLevel: 2, risk: 0.1, demand: 1.2, blurb: 'Offices, Utako Market and the Berger junction.' },
  { id: 'jabi', name: 'Jabi', kind: 'COMMERCIAL', center: [9.0750, 7.4250], radiusKm: 1.7, unlockLevel: 2, risk: 0.09, demand: 1.1, blurb: 'Jabi Lake Mall and the lakefront.' },
  { id: 'airport_road', name: 'Airport Road', kind: 'TRANSIT', center: [9.0100, 7.3400], radiusKm: 4.5, unlockLevel: 2, risk: 0.2, demand: 0.9, blurb: 'The long expressway to the international airport. High fares, long trips.' },
  { id: 'maitama', name: 'Maitama', kind: 'RESIDENTIAL', center: [9.0930, 7.4950], radiusKm: 2.0, unlockLevel: 3, risk: 0.05, demand: 1.0, blurb: 'Embassies, hotels and big fares. Quiet and well lit.' },
  { id: 'gwarinpa', name: 'Gwarinpa', kind: 'RESIDENTIAL', center: [9.1090, 7.4040], radiusKm: 2.4, unlockLevel: 3, risk: 0.18, demand: 1.3, blurb: 'The largest housing estate in the country. Heavy commuter flow.' },
  { id: 'kubwa', name: 'Kubwa', kind: 'RESIDENTIAL', center: [9.1480, 7.3380], radiusKm: 3.0, unlockLevel: 4, risk: 0.25, demand: 1.1, blurb: 'A satellite town. Long daily commutes on the Kubwa Expressway.' },
  { id: 'asokoro', name: 'Asokoro', kind: 'RESIDENTIAL', center: [9.0440, 7.5230], radiusKm: 1.6, unlockLevel: 4, risk: 0.04, demand: 0.8, blurb: 'Leafy diplomatic district beside Aso Rock. Premium passengers.' },
];

export interface RoadNode {
  id: string;
  name: string;
  district: DistrictId;
  pos: LatLng;
}

const N = (id: string, name: string, district: DistrictId, lat: number, lng: number): RoadNode => ({ id, name, district, pos: [lat, lng] });

export const NODES: RoadNode[] = [
  N('cbd_core', 'CBD Roundabout', 'cbd', 9.0560, 7.4910),
  N('cbd_east', 'Three Arms Zone', 'cbd', 9.0545, 7.5060),
  N('wuse_central', 'Wuse Zone 2 Junction', 'wuse', 9.0770, 7.4710),
  N('wuse_market', 'Wuse Market Junction', 'wuse', 9.0735, 7.4815),
  N('wuse_zone4', 'Zone 4 Junction', 'wuse', 9.0680, 7.4790),
  N('maitama_core', 'Maitama Junction', 'maitama', 9.0885, 7.4960),
  N('maitama_north', 'Katampe Junction', 'maitama', 9.1000, 7.4930),
  N('garki_core', 'Garki Junction', 'garki', 9.0330, 7.4880),
  N('garki_south', 'Garki South Interchange', 'garki', 9.0220, 7.4900),
  N('area1_core', 'Area 1 Roundabout', 'area1', 9.0430, 7.4770),
  N('area2_core', 'Area 2 Junction', 'area2', 9.0370, 7.4830),
  N('asokoro_core', 'Asokoro Junction', 'asokoro', 9.0410, 7.5250),
  N('asokoro_hill', 'Aso Drive Junction', 'asokoro', 9.0510, 7.5190),
  N('jabi_core', 'Jabi Junction', 'jabi', 9.0700, 7.4260),
  N('jabi_lake', 'Jabi Lake Junction', 'jabi', 9.0800, 7.4230),
  N('utako_core', 'Utako Junction', 'utako', 9.0650, 7.4430),
  N('utako_market', 'Utako Market Junction', 'utako', 9.0610, 7.4520),
  N('gwarinpa_jn', 'Gwarinpa Junction', 'gwarinpa', 9.0990, 7.4100),
  N('gwarinpa_core', 'Gwarinpa 1st Avenue', 'gwarinpa', 9.1090, 7.4000),
  N('gwarinpa_est', 'Gwarinpa 7th Avenue', 'gwarinpa', 9.1170, 7.4090),
  N('kubwa_jn', 'Dutse Junction', 'kubwa', 9.1300, 7.3650),
  N('kubwa_core', 'Kubwa Roundabout', 'kubwa', 9.1560, 7.3320),
  N('games_village', 'Games Village Interchange', 'airport_road', 9.0200, 7.4450),
  N('airport_jn', 'Lugbe Junction', 'airport_road', 9.0000, 7.3600),
  N('airport_mid', 'Airport Road Toll Gate', 'airport_road', 9.0020, 7.3200),
  N('airport_terminal', 'Airport Terminal Roundabout', 'airport_road', 9.0090, 7.2680),
];

export type RoadClass = 'EXPRESSWAY' | 'ARTERIAL' | 'LOCAL';

export interface RoadDef {
  id: string;
  name: string;
  cls: RoadClass;
  nodes: string[];
}

export const ROADS: RoadDef[] = [
  { id: 'kubwa_expy', name: 'Kubwa Expressway', cls: 'EXPRESSWAY', nodes: ['kubwa_core', 'kubwa_jn', 'gwarinpa_jn', 'jabi_lake', 'jabi_core', 'utako_core'] },
  { id: 'abw', name: 'Ahmadu Bello Way', cls: 'ARTERIAL', nodes: ['utako_core', 'utako_market', 'wuse_central', 'wuse_market', 'cbd_core', 'cbd_east'] },
  { id: 'shehu_shagari', name: 'Shehu Shagari Way', cls: 'ARTERIAL', nodes: ['cbd_core', 'wuse_zone4', 'maitama_core', 'maitama_north'] },
  { id: 'gana', name: 'Gana Street', cls: 'LOCAL', nodes: ['wuse_central', 'maitama_core'] },
  { id: 'ibb', name: 'IBB Way', cls: 'ARTERIAL', nodes: ['cbd_east', 'asokoro_hill', 'asokoro_core'] },
  { id: 'murtala', name: 'Murtala Muhammed Expressway', cls: 'EXPRESSWAY', nodes: ['cbd_core', 'area1_core', 'area2_core', 'garki_core', 'garki_south'] },
  { id: 'airport_rd', name: 'Airport Road', cls: 'EXPRESSWAY', nodes: ['garki_south', 'games_village', 'airport_jn', 'airport_mid', 'airport_terminal'] },
  { id: 'nnamdi', name: 'Nnamdi Azikiwe Way', cls: 'ARTERIAL', nodes: ['garki_core', 'asokoro_core'] },
  { id: 'gwarinpa_rd', name: 'Gwarinpa Estate Road', cls: 'LOCAL', nodes: ['gwarinpa_jn', 'gwarinpa_core', 'gwarinpa_est'] },
  { id: 'katampe_ring', name: 'Katampe Ring Road', cls: 'ARTERIAL', nodes: ['maitama_north', 'gwarinpa_est', 'gwarinpa_jn'] },
  { id: 'games_rd', name: 'Games Village Road', cls: 'ARTERIAL', nodes: ['utako_market', 'games_village'] },
  { id: 'herbert', name: 'Herbert Macaulay Way', cls: 'ARTERIAL', nodes: ['area1_core', 'wuse_zone4'] },
  { id: 'colorado', name: 'Colorado Link', cls: 'LOCAL', nodes: ['area2_core', 'garki_core'] },
];

export type LocationType =
  | 'DISTRICT' | 'LANDMARK' | 'PETROL_STATION' | 'BUS_STOP' | 'PARKING' | 'MARKET'
  | 'MALL' | 'HOSPITAL' | 'GOVERNMENT' | 'HOTEL' | 'AIRPORT' | 'RESIDENTIAL'
  | 'SCHOOL' | 'MOTOR_PARK' | 'BUSINESS' | 'GARAGE';

export interface LocationDef {
  key: string;
  name: string;
  type: LocationType;
  district: DistrictId;
  nodeId: string;
  pos: LatLng;
  description: string;
}

const node = (id: string): RoadNode => {
  const n = NODES.find((x) => x.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
};

// [key, name, type, nodeId, dLat, dLng, description]
type LocRow = [string, string, LocationType, string, number, number, string];

const LOC_ROWS: LocRow[] = [
  // CBD
  ['cbd_hub', 'Central Business District', 'DISTRICT', 'cbd_core', 0, 0, 'The heart of the capital.'],
  ['eagle_square', 'Eagle Square Plaza', 'LANDMARK', 'cbd_east', 0.0012, -0.0020, 'Open parade ground and events plaza.'],
  ['fed_secretariat', 'Federal Secretariat', 'GOVERNMENT', 'cbd_core', 0.0030, 0.0040, 'Ministries and agencies.'],
  ['cbd_bank_row', 'Bank Row Towers', 'BUSINESS', 'cbd_core', -0.0025, 0.0030, 'Head offices of the major banks.'],
  ['cbd_petrol', 'Sahel Fuels — CBD', 'PETROL_STATION', 'cbd_core', -0.0015, -0.0035, 'Petrol station on Ahmadu Bello Way.'],
  ['cbd_busstop', 'Secretariat Bus Stop', 'BUS_STOP', 'cbd_core', 0.0008, -0.0030, 'Busy commuter stop.'],
  // Wuse
  ['wuse_hub', 'Wuse', 'DISTRICT', 'wuse_central', 0, 0, 'Zone 2 — shops, restaurants and nightlife.'],
  ['wuse_market', 'Wuse Market', 'MARKET', 'wuse_market', 0.0010, 0.0018, 'The largest open market in the city.'],
  ['ceddi_plaza', 'Ceddi Plaza', 'MALL', 'wuse_zone4', 0.0018, 0.0020, 'Shopping and offices.'],
  ['wuse_petrol', 'Arewa Oil — Wuse', 'PETROL_STATION', 'wuse_central', -0.0020, 0.0025, 'Always a queue in the evening.'],
  ['wuse_garage', 'Wuse Auto Care', 'GARAGE', 'wuse_market', -0.0020, -0.0020, 'Mechanics, tyres and vehicle sales.'],
  ['wuse_busstop', 'Berger Bus Stop', 'BUS_STOP', 'wuse_central', 0.0015, -0.0020, 'Busy interchange stop.'],
  ['wuse_hotel', 'Zone 4 Grand Hotel', 'HOTEL', 'wuse_zone4', -0.0014, 0.0018, 'Business hotel.'],
  ['wuse_hospital', 'Wuse General Hospital', 'HOSPITAL', 'wuse_market', 0.0030, -0.0010, 'Public hospital.'],
  // Garki
  ['garki_hub', 'Garki', 'DISTRICT', 'garki_core', 0, 0, 'Garki Area 3 — crowded and alive.'],
  ['garki_market', 'Garki Model Market', 'MARKET', 'garki_core', -0.0018, 0.0020, 'Foodstuff and clothing market.'],
  ['garki_motorpark', 'Garki Motor Park', 'MOTOR_PARK', 'garki_south', 0.0015, -0.0020, 'Interstate buses and taxis.'],
  ['garki_petrol', 'Sahel Fuels — Garki', 'PETROL_STATION', 'garki_core', 0.0022, -0.0020, 'Busy filling station.'],
  ['garki_garage', 'Garki Mechanic Village', 'GARAGE', 'garki_south', -0.0018, 0.0016, 'Cheap, fast repairs.'],
  ['garki_hospital', 'Garki Hospital', 'HOSPITAL', 'garki_core', 0.0012, 0.0032, 'Public hospital.'],
  // Area 1 & 2
  ['area1_hub', 'Area 1', 'DISTRICT', 'area1_core', 0, 0, 'Area 1 shopping plaza.'],
  ['area1_plaza', 'Area 1 Shopping Plaza', 'MALL', 'area1_core', 0.0014, 0.0016, 'Shops and eateries.'],
  ['area1_parking', 'Area 1 Car Park', 'PARKING', 'area1_core', -0.0014, -0.0016, 'Public car park.'],
  ['area2_hub', 'Area 2', 'DISTRICT', 'area2_core', 0, 0, 'Area 2 shopping centre.'],
  ['area2_school', 'Area 2 Secondary School', 'SCHOOL', 'area2_core', 0.0014, -0.0016, 'Morning school run.'],
  ['area2_busstop', 'Area 2 Bus Stop', 'BUS_STOP', 'area2_core', -0.0012, 0.0014, 'Local bus stop.'],
  // Maitama
  ['maitama_hub', 'Maitama', 'DISTRICT', 'maitama_core', 0, 0, 'Embassies and boutique hotels.'],
  ['maitama_hotel', 'Aso Heights Hotel', 'HOTEL', 'maitama_core', 0.0020, 0.0020, 'Five-star hotel.'],
  ['maitama_hospital', 'Maitama District Hospital', 'HOSPITAL', 'maitama_north', -0.0016, -0.0020, 'District hospital.'],
  ['maitama_petrol', 'Arewa Oil — Maitama', 'PETROL_STATION', 'maitama_core', -0.0018, 0.0022, 'Quiet station.'],
  ['maitama_embassy', 'Embassy Row', 'GOVERNMENT', 'maitama_north', 0.0020, 0.0016, 'Diplomatic missions.'],
  // Asokoro
  ['asokoro_hub', 'Asokoro', 'DISTRICT', 'asokoro_core', 0, 0, 'Leafy residential avenues.'],
  ['asokoro_villa', 'Presidential Villa Gate', 'GOVERNMENT', 'asokoro_hill', 0.0020, 0.0018, 'Heavily secured zone.'],
  ['asokoro_petrol', 'Sahel Fuels — Asokoro', 'PETROL_STATION', 'asokoro_core', -0.0016, -0.0020, 'Premium station.'],
  ['asokoro_estate', 'Asokoro Extension Estate', 'RESIDENTIAL', 'asokoro_core', 0.0022, -0.0014, 'Gated homes.'],
  // Jabi
  ['jabi_hub', 'Jabi', 'DISTRICT', 'jabi_core', 0, 0, 'Jabi Motor Park area.'],
  ['jabi_lake_mall', 'Jabi Lake Mall', 'MALL', 'jabi_lake', 0.0014, 0.0020, 'Mall, cinema and lakefront.'],
  ['jabi_petrol', 'Arewa Oil — Jabi', 'PETROL_STATION', 'jabi_core', -0.0018, 0.0020, 'Busy filling station.'],
  ['jabi_motorpark', 'Jabi Motor Park', 'MOTOR_PARK', 'jabi_core', 0.0016, -0.0018, 'Taxis and buses.'],
  ['jabi_parking', 'Jabi Lake Car Park', 'PARKING', 'jabi_lake', -0.0014, -0.0014, 'Lakeside parking.'],
  // Utako
  ['utako_hub', 'Utako', 'DISTRICT', 'utako_core', 0, 0, 'Offices and eateries.'],
  ['utako_market', 'Utako Market', 'MARKET', 'utako_market', 0.0012, -0.0016, 'Daily fresh-produce market.'],
  ['utako_petrol', 'Sahel Fuels — Utako', 'PETROL_STATION', 'utako_core', 0.0018, 0.0016, 'Very busy at rush hour.'],
  ['utako_garage', 'Utako Auto Hub', 'GARAGE', 'utako_market', -0.0016, 0.0014, 'Repairs and vehicle dealership.'],
  ['berger_busstop', 'Berger Junction Bus Stop', 'BUS_STOP', 'utako_core', -0.0014, -0.0012, 'Big commuter interchange.'],
  ['utako_business', 'Utako Business Park', 'BUSINESS', 'utako_core', 0.0030, -0.0010, 'Corporate offices.'],
  // Gwarinpa
  ['gwarinpa_hub', 'Gwarinpa', 'DISTRICT', 'gwarinpa_core', 0, 0, 'Estate life — 1st to 9th Avenue.'],
  ['gwarinpa_mall', 'Gwarinpa Shopping Mall', 'MALL', 'gwarinpa_jn', 0.0014, 0.0016, 'Mall near the junction.'],
  ['gwarinpa_petrol', 'Arewa Oil — Gwarinpa', 'PETROL_STATION', 'gwarinpa_jn', -0.0016, -0.0018, 'Long queues on Fridays.'],
  ['gwarinpa_garage', 'Gwarinpa Auto Care', 'GARAGE', 'gwarinpa_est', -0.0014, 0.0016, 'Mechanics and tyre shop.'],
  ['gwarinpa_estate', '1st Avenue Residences', 'RESIDENTIAL', 'gwarinpa_core', 0.0016, -0.0018, 'Residential blocks.'],
  ['gwarinpa_busstop', '3rd Avenue Bus Stop', 'BUS_STOP', 'gwarinpa_core', -0.0016, 0.0014, 'Estate bus stop.'],
  // Kubwa
  ['kubwa_hub', 'Kubwa', 'DISTRICT', 'kubwa_core', 0, 0, 'Satellite town — long commutes.'],
  ['kubwa_market', 'Kubwa Market', 'MARKET', 'kubwa_core', 0.0016, 0.0018, 'Local market.'],
  ['kubwa_motorpark', 'Kubwa Motor Park', 'MOTOR_PARK', 'kubwa_jn', 0.0014, -0.0016, 'Buses to the city.'],
  ['kubwa_petrol', 'Sahel Fuels — Kubwa', 'PETROL_STATION', 'kubwa_core', -0.0016, -0.0016, 'Busy highway station.'],
  ['kubwa_garage', 'Kubwa Mechanic Village', 'GARAGE', 'kubwa_jn', -0.0014, 0.0016, 'Repairs and used vehicles.'],
  // Airport road
  ['airport_hub', 'Airport Road', 'DISTRICT', 'airport_jn', 0, 0, 'Lugbe junction on the airport expressway.'],
  ['airport_terminal', 'Nnamdi Azikiwe International Airport', 'AIRPORT', 'airport_terminal', 0.0014, 0.0016, 'International arrivals and departures.'],
  ['games_village', 'Games Village', 'LANDMARK', 'games_village', 0.0016, -0.0018, 'Stadium and sports complex.'],
  ['airport_petrol', 'Arewa Oil — Airport Road', 'PETROL_STATION', 'airport_mid', -0.0016, 0.0016, 'Last stop before the airport.'],
  ['airport_parking', 'Airport Long-Stay Parking', 'PARKING', 'airport_terminal', -0.0020, -0.0012, 'Terminal car park.'],
];

export const LOCATIONS: LocationDef[] = LOC_ROWS.map(([key, name, type, nodeId, dLat, dLng, description]) => {
  const n = node(nodeId);
  return { key, name, type, district: n.district, nodeId, pos: [n.pos[0] + dLat, n.pos[1] + dLng], description };
});

export interface RoadEdge {
  id: string;
  roadId: string;
  name: string;
  cls: RoadClass;
  from: string;
  to: string;
  geometry: LatLng[];
  km: number;
}

/** Roads are drawn as gently curving ribbons rather than straight lines. */
function curve(a: LatLng, b: LatLng, seed: string): LatLng[] {
  const rng = mulberry32(hashString(seed));
  const mid: LatLng = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[1] - a[1];
  const dy = b[0] - a[0];
  const len = Math.hypot(dx, dy) || 1;
  const bend = (rng() - 0.5) * 0.28 * len;
  const ctrl: LatLng = [mid[0] + (dx / len) * bend, mid[1] - (dy / len) * bend];
  const pts: LatLng[] = [];
  const steps = Math.max(6, Math.round(len / 0.0035));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0], u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1]]);
  }
  return pts;
}

export const EDGES: RoadEdge[] = ROADS.flatMap((road) =>
  road.nodes.slice(1).map((toId, i) => {
    const fromId = road.nodes[i];
    const geometry = curve(node(fromId).pos, node(toId).pos, `${road.id}:${fromId}:${toId}`);
    return {
      id: `${road.id}:${fromId}>${toId}`,
      roadId: road.id,
      name: road.name,
      cls: road.cls,
      from: fromId,
      to: toId,
      geometry,
      km: polylineKm(geometry),
    };
  }),
);

export const districtById = (id: string): DistrictDef | undefined => DISTRICTS.find((d) => d.id === id);
export const locationByKey = (key: string): LocationDef | undefined => LOCATIONS.find((l) => l.key === key);
export const START_LOCATION_KEY = 'wuse_hub';
