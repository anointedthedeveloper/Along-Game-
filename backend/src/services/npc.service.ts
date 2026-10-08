import type { LocationType } from '../data/world';
import { pick, rand, randInt } from '../utils/rng';

const FIRST = ['Chinedu', 'Aisha', 'Tunde', 'Ngozi', 'Emeka', 'Fatima', 'Ibrahim', 'Blessing', 'Yusuf', 'Chioma', 'Segun', 'Hadiza', 'Obinna', 'Amina', 'Bola', 'Kemi', 'Musa', 'Ifeanyi', 'Zainab', 'Uche', 'Danjuma', 'Folake', 'Sani', 'Nkechi', 'Gbenga', 'Halima', 'Kelechi', 'Maryam', 'Tobi', 'Adaeze', 'Abdul', 'Funke'];
const LAST = ['Okafor', 'Bello', 'Adeyemi', 'Eze', 'Musa', 'Ogunleye', 'Abubakar', 'Nwosu', 'Danladi', 'Balogun', 'Okonkwo', 'Garba', 'Ibekwe', 'Lawal', 'Chukwu', 'Suleiman', 'Afolabi', 'Umar', 'Obi', 'Yakubu'];

export const npcName = (rng: () => number = Math.random): string => `${pick(FIRST, rng)} ${pick(LAST, rng)}`;

const PLATE_PREFIX = ['ABJ', 'GWA', 'KUB', 'BWR', 'AAA', 'RBC'];
export function plate(rng: () => number = Math.random): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const L = () => letters[Math.floor(rng() * letters.length)];
  return `${pick(PLATE_PREFIX, rng)}-${String(Math.floor(rng() * 900) + 100)}${L()}${L()}`;
}

const PURPOSE: Partial<Record<LocationType, string[]>> = {
  GOVERNMENT: ['Heading to a ministry appointment', 'Late for work at the Secretariat', 'Going to submit documents'],
  BUSINESS: ['Rushing to a client meeting', 'Heading to the office', 'Going to a job interview'],
  MARKET: ['Going to buy foodstuff for the week', 'Heading to the market with bags', 'Shopping for the shop'],
  MALL: ['Meeting friends at the mall', 'Going shopping', 'Heading to the cinema'],
  HOSPITAL: ['Going for a hospital appointment', 'Visiting a relative at the hospital'],
  HOTEL: ['Heading to a hotel for a conference', 'Meeting a guest at the hotel'],
  AIRPORT: ['Catching a flight — please hurry', 'Has luggage and a flight to make'],
  SCHOOL: ['Taking the children to school', 'Heading to class'],
  MOTOR_PARK: ['Going to catch a bus to the east', 'Travelling out of town'],
  RESIDENTIAL: ['Heading home after work', 'Going home to rest'],
  BUS_STOP: ['Heading home from work', 'Going to meet family'],
  DISTRICT: ['Running errands', 'Going to meet a friend'],
  LANDMARK: ['Going to see an event', 'Meeting someone at the plaza'],
  PETROL_STATION: ['Running errands'],
  PARKING: ['Going to pick up a car'],
  GARAGE: ['Going to the mechanic'],
};

export const purposeFor = (type: LocationType, rng: () => number = Math.random): string =>
  pick(PURPOSE[type] ?? ['Running errands'], rng);

export const npcRating = (min = 3.9, max = 4.95): number => Math.round(rand(min, max) * 10) / 10;

export const randomPlateColor = (colors: string[]): string => colors[randInt(0, colors.length - 1)];
