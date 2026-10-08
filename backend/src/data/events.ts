import type { TransactionType } from '../models/Transaction';
import type { WeatherKind } from '../services/world.service';

export type Role = 'DRIVER' | 'PASSENGER';
export type EventCategory = 'TRAFFIC' | 'ROAD' | 'WEATHER' | 'VEHICLE' | 'ECONOMY' | 'PASSENGER' | 'LAW' | 'SECURITY';
export type Severity = 'INFO' | 'WARNING' | 'DANGER';

/** Everything an event choice can change. Applied only by event.service on the backend. */
export interface Effects {
  /** Extra in-game minutes (a range is rolled when applied). */
  delayMin?: number | [number, number];
  /** Positive = money in, negative = forced expense. */
  cash?: number;
  cashType?: TransactionType;
  /** Lose a percentage of carried cash, capped. */
  lostCashPct?: number;
  lostCashCap?: number;
  /** Litres of fuel added (positive) or burned (negative). Driver only. */
  fuel?: number;
  condition?: number;
  cleanliness?: number;
  fareMultiplier?: number;
  /** Percent of the base fare added to (or removed from) the final fare. */
  fareDeltaPct?: number;
  fareDelta?: number;
  ratingMod?: number;
  cancelRide?: boolean;
  /** When the ride ends early, the share of the fare that is still settled. */
  partialFarePct?: number;
  xp?: number;
}

export interface Outcome {
  weight: number;
  message: string;
  effects: Effects;
}

export interface OptionDef {
  id: string;
  label: string;
  hint: string;
  outcomes: Outcome[];
}

export interface EventContext {
  role: Role;
  weather: WeatherKind;
  hour: number;
  traffic: number;
  /** Driver's vehicle (or the NPC driver's, for passengers). */
  condition: number;
  fuelFraction: number;
  tyreLevel: number;
  reliability: number;
  vehicleName: string;
  rating: number;
  districtRisk: number;
  originName: string;
  destinationName: string;
  groupSize: number;
  tier: 'STANDARD' | 'PREMIUM' | 'VIP';
  baseFare: number;
  isNight: boolean;
  raining: boolean;
}

export interface EventDef {
  type: string;
  category: EventCategory;
  severity: Severity;
  roles: Role[];
  title: string;
  weight: (c: EventContext) => number;
  describe: (c: EventContext) => string;
  options: (c: EventContext) => OptionDef[];
}

const out = (weight: number, message: string, effects: Effects = {}): Outcome => ({ weight, message, effects });
const opt = (id: string, label: string, hint: string, ...outcomes: Outcome[]): OptionDef => ({ id, label, hint, outcomes });
const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;
const isD = (c: EventContext) => c.role === 'DRIVER';

export const EVENT_CATALOG: EventDef[] = [
  {
    type: 'HEAVY_TRAFFIC', category: 'TRAFFIC', severity: 'WARNING', roles: ['DRIVER', 'PASSENGER'], title: 'Heavy traffic',
    weight: (c) => 1 + c.traffic * 5,
    describe: (c) => (c.raining ? 'Rain has everyone crawling. The road ahead is a sea of brake lights.' : 'Bumper-to-bumper traffic ahead. Horns are blaring and nothing is moving.'),
    options: (c) =>
      isD(c)
        ? [
            opt('wait', 'Wait it out', 'Stay in the lane', out(1, 'You crawled forward with the queue.', { delayMin: [7, 12] })),
            opt('sidestreet', 'Squeeze through a side street', 'Faster if it is clear, rough if it is not',
              out(0.55, 'The side street was clear. You saved a lot of time.', { delayMin: [2, 4], xp: 5 }),
              out(0.45, 'The side street was full of potholes and a hawker market.', { delayMin: [9, 12], condition: -2, fuel: -0.3 })),
          ]
        : [
            opt('patient', 'Be patient', 'Nothing you can do', out(1, 'You scrolled your phone while the car crawled.', { delayMin: [7, 12] })),
            opt('shortcut', 'Ask the driver to use side streets', 'The driver might charge for extra distance',
              out(0.5, 'The driver found a quick shortcut.', { delayMin: [2, 4] }),
              out(0.5, 'The shortcut was no quicker and the driver wants a little extra.', { delayMin: [8, 11], fareDelta: 200 })),
          ],
  },
  {
    type: 'ROAD_CONSTRUCTION', category: 'ROAD', severity: 'INFO', roles: ['DRIVER', 'PASSENGER'], title: 'Road construction',
    weight: () => 1.6,
    describe: () => 'Construction crews have narrowed the road to one lane. Cones and heavy machines everywhere.',
    options: (c) =>
      isD(c)
        ? [
            opt('diversion', 'Follow the marked diversion', 'Slow but safe', out(1, 'You followed the diversion signs through the estate.', { delayMin: [5, 7], fuel: -0.3 })),
            opt('squeeze', 'Squeeze past the works', 'Rough surface ahead',
              out(0.5, 'A site worker waved you through.', { delayMin: [1, 3] }),
              out(0.5, 'The surface was torn up and the suspension suffered.', { delayMin: [6, 9], condition: -4 })),
          ]
        : [
            opt('wait', 'Wait in the queue', 'The road will clear soon', out(1, 'You waited while the single lane cleared.', { delayMin: [5, 8] })),
            opt('alt', 'Ask the driver for another way', 'May cost a little extra', out(1, 'The driver took a longer way round.', { delayMin: [3, 5], fareDelta: 150 })),
          ],
  },
  {
    type: 'ROAD_CLOSURE', category: 'ROAD', severity: 'WARNING', roles: ['DRIVER', 'PASSENGER'], title: 'Road closure ahead',
    weight: () => 1.2,
    describe: () => 'The road is blocked ahead — officials have shut it for a convoy movement.',
    options: (c) =>
      isD(c)
        ? [
            opt('divert', 'Take the long diversion', 'Reliable but long', out(1, 'You took the diversion and burned extra fuel.', { delayMin: [8, 11], fuel: -0.5 })),
            opt('wait', 'Wait for it to reopen', 'No extra distance', out(1, 'The road reopened after a long wait.', { delayMin: [13, 17] })),
            opt('warden', 'Ask a traffic warden', 'Could be a quick fix or a mess',
              out(0.65, 'The warden pointed out a quick back route.', { delayMin: [3, 5] }),
              out(0.35, 'The warden sent you the wrong way first.', { delayMin: [14, 18], fuel: -0.4 })),
          ]
        : [
            opt('wait', 'Wait for the road to reopen', 'No cost', out(1, 'You waited for the road to reopen.', { delayMin: [12, 16] })),
            opt('alt', 'Ask the driver to find another route', 'A longer way, slightly more fare', out(1, 'The driver went the long way round.', { delayMin: [7, 10], fareDelta: 300 })),
          ],
  },
  {
    type: 'TRAFFIC_DIVERSION', category: 'ROAD', severity: 'INFO', roles: ['DRIVER', 'PASSENGER'], title: 'Traffic diversion',
    weight: () => 1,
    describe: () => 'Officers are diverting all traffic off the main road for a government event.',
    options: (c) =>
      isD(c)
        ? [
            opt('follow', 'Follow the diversion', 'Safe choice', out(1, 'You followed the officers\' directions.', { delayMin: [4, 6], fuel: -0.2 })),
            opt('shortcut', 'Try a local shortcut', '50/50',
              out(0.5, 'Your local knowledge paid off.', { delayMin: [1, 3], xp: 8 }),
              out(0.5, 'The shortcut was gridlocked.', { delayMin: [9, 12] })),
          ]
        : [opt('ok', 'Go with the diversion', 'Nothing to decide', out(1, 'The driver followed the diversion.', { delayMin: [4, 6] }))],
  },
  {
    type: 'SUDDEN_RAIN', category: 'WEATHER', severity: 'INFO', roles: ['DRIVER', 'PASSENGER'], title: 'Sudden downpour',
    weight: (c) => (c.raining ? 0 : 1.6),
    describe: () => 'Dark clouds roll in and the rain starts without warning. Visibility drops.',
    options: (c) =>
      isD(c)
        ? [
            opt('slow', 'Slow down and continue', 'Safe', out(1, 'You drove carefully. The passenger appreciated it.', { delayMin: [3, 5], ratingMod: 0.2 })),
            opt('pull', 'Pull over until it eases', 'Waits out the worst', out(1, 'You waited under a bridge until the rain eased.', { delayMin: [7, 10] })),
            opt('keep', 'Keep your speed', 'Risky',
              out(0.6, 'You made it without drama.', { xp: 3 }),
              out(0.4, 'The car skidded on the wet road — a scary moment.', { condition: -6, ratingMod: -0.6, delayMin: [2, 3] })),
          ]
        : [
            opt('slow', 'Ask the driver to slow down', 'Safer', out(1, 'The driver slowed down and the ride was calm.', { delayMin: [3, 4] })),
            opt('wait', 'Wait it out', 'Nothing to do', out(1, 'The rain slowed everything down.', { delayMin: [5, 8] })),
          ],
  },
  {
    type: 'FLOODED_ROAD', category: 'WEATHER', severity: 'DANGER', roles: ['DRIVER', 'PASSENGER'], title: 'Flooded road',
    weight: (c) => (c.raining ? 3 : 0),
    describe: () => 'Water has covered the road ahead. You cannot tell how deep it is.',
    options: (c) =>
      isD(c)
        ? [
            opt('through', 'Drive through slowly', 'Risky',
              out(0.6, 'You crept through the water and made it.', { delayMin: [2, 4] }),
              out(0.4, 'Water got into the engine bay and the car stalled.', { condition: -15, delayMin: [10, 14] })),
            opt('reroute', 'Find another route', 'Costs time and fuel', out(1, 'You turned around and found a dry route.', { delayMin: [8, 11], fuel: -0.6 })),
            opt('wait', 'Wait for the water to drop', 'No risk', out(1, 'You waited until the level dropped.', { delayMin: [14, 18] })),
          ]
        : [
            opt('wait', 'Wait for the water to drop', 'No cost', out(1, 'You waited while the flood receded.', { delayMin: [11, 14] })),
            opt('reroute', 'Ask the driver to reroute', 'Longer, a bit more', out(1, 'The driver took a dry route.', { delayMin: [7, 10], fareDelta: 300 })),
          ],
  },
  {
    type: 'VEHICLE_BREAKDOWN', category: 'VEHICLE', severity: 'DANGER', roles: ['DRIVER', 'PASSENGER'], title: 'Vehicle breakdown',
    weight: (c) => Math.max(0.15, ((100 - c.condition) / 100) * (11 - c.reliability) * 0.7),
    describe: (c) => (isD(c) ? `Your ${c.vehicleName} coughs, shudders and rolls to a stop.` : 'The vehicle splutters and stops on the roadside. The driver is checking the engine.'),
    options: (c) =>
      isD(c)
        ? [
            opt('mechanic', 'Call a roadside mechanic', 'Costs money, fixes it properly', out(1, 'A mechanic fixed it on the spot.', { cash: -3500, cashType: 'MAINTENANCE', delayMin: [6, 9], condition: 8 })),
            opt('diy', 'Try to fix it yourself', 'Free, but may fail',
              out(0.5, 'A loose connection — you got it running.', { delayMin: [4, 6], condition: 3 }),
              out(0.5, 'You made it worse before it finally started.', { delayMin: [13, 17], condition: -6 })),
          ]
        : [
            opt('wait', 'Wait for the driver to fix it', 'Free', out(1, 'The driver got it going after a while.', { delayMin: [10, 15] })),
            opt('flag', 'Flag down another taxi', 'End this ride and pay for the distance covered',
              out(1, 'You hopped into another taxi and paid for the distance covered.', { cancelRide: true, partialFarePct: 40, delayMin: 0 })),
          ],
  },
  {
    type: 'FLAT_TYRE', category: 'VEHICLE', severity: 'WARNING', roles: ['DRIVER', 'PASSENGER'], title: 'Flat tyre',
    weight: (c) => Math.max(0.2, 1.8 - c.tyreLevel * 0.5) * (c.condition < 50 ? 1.6 : 1),
    describe: () => 'Bang — a tyre has burst on the rough road.',
    options: (c) =>
      isD(c)
        ? [
            opt('change', 'Change the tyre yourself', 'Free, takes time', out(1, 'You swapped on the spare tyre.', { delayMin: [8, 11], condition: -1 })),
            opt('vulc', 'Pay a roadside vulcaniser', 'Quicker, costs money', out(1, 'The vulcaniser had you rolling in minutes.', { cash: -2500, cashType: 'MAINTENANCE', delayMin: [4, 6] })),
          ]
        : [
            opt('wait', 'Wait', 'The driver will sort it', out(1, 'The driver changed the tyre.', { delayMin: [8, 11] })),
            opt('help', 'Help the driver', 'Quicker with two people', out(1, 'Between the two of you the tyre was changed fast.', { delayMin: [4, 6] })),
          ],
  },
  {
    type: 'ENGINE_OVERHEATING', category: 'VEHICLE', severity: 'WARNING', roles: ['DRIVER', 'PASSENGER'], title: 'Engine overheating',
    weight: (c) => (c.raining ? 0.4 : 1) * Math.max(0.2, (100 - c.condition) / 40),
    describe: () => 'Steam rises from under the bonnet and the temperature needle is in the red.',
    options: (c) =>
      isD(c)
        ? [
            opt('cool', 'Pull over and let it cool', 'Safe, slow', out(1, 'You waited until it cooled down.', { delayMin: [8, 10], condition: -1 })),
            opt('water', 'Top up the radiator with water', 'Cheap and quick',
              out(0.8, 'A bottle of water bought you the rest of the trip.', { cash: -300, cashType: 'MAINTENANCE', delayMin: [3, 5] }),
              out(0.2, 'The radiator hose was cracked.', { cash: -1500, cashType: 'MAINTENANCE', delayMin: [10, 14], condition: -8 })),
            opt('push', 'Push on', 'Dangerous gamble',
              out(0.4, 'The needle dropped on its own. You got lucky.', { xp: 2 }),
              out(0.6, 'The engine seized up and needed a tow.', { condition: -18, cash: -4000, cashType: 'MAINTENANCE', delayMin: [14, 18] })),
          ]
        : [
            opt('wait', 'Wait for it to cool', 'Safe', out(1, 'The engine cooled and you continued.', { delayMin: [8, 10] })),
            opt('contribute', 'Chip in for coolant', 'Gets you moving sooner', out(1, 'You bought coolant at the next kiosk.', { delayMin: [3, 5], fareDelta: 300 })),
          ],
  },
  {
    type: 'FUEL_SHORTAGE', category: 'ECONOMY', severity: 'WARNING', roles: ['DRIVER'], title: 'Fuel scarcity',
    weight: (c) => (c.fuelFraction < 0.5 ? 2.2 : 0.4),
    describe: () => 'Word on the road: petrol stations ahead have long queues and some have run dry.',
    options: () => [
      opt('queue', 'Join the queue', 'Pay a scarcity price for a top-up', out(1, 'You queued for ages but filled up 8 litres.', { delayMin: [10, 14], fuel: 8, cash: -8 * 1150, cashType: 'FUEL_PURCHASE' })),
      opt('jerrycan', 'Buy from a roadside jerrycan seller', 'Fast, pricey, risky quality',
        out(0.75, 'You bought 8 litres from a trusted seller.', { delayMin: [2, 3], fuel: 8, cash: -8 * 1500, cashType: 'FUEL_PURCHASE' }),
        out(0.25, 'The fuel was watered down. The engine knocks.', { delayMin: [3, 5], fuel: 8, cash: -8 * 1500, cashType: 'FUEL_PURCHASE', condition: -8 })),
      opt('continue', 'Continue on what you have', 'Hope you have enough',
        out(0.7, 'You had just enough fuel.', {}),
        out(0.3, 'You ran dry and had to buy a jerrycan from a passer-by.', { delayMin: [12, 16], cash: -3000, cashType: 'FUEL_PURCHASE', fuel: 2 })),
    ],
  },
  {
    type: 'PASSENGER_CANCEL', category: 'PASSENGER', severity: 'WARNING', roles: ['DRIVER'], title: 'Passenger wants to cancel',
    weight: () => 0.9,
    describe: () => 'Your passenger says their plans have changed and asks to be dropped off here.',
    options: () => [
      opt('charge', 'Drop them and charge for distance', 'Take a fraction of the fare', out(1, 'You dropped them off and they paid for the distance so far.', { cancelRide: true, partialFarePct: 30, ratingMod: -0.2 })),
      opt('persuade', 'Persuade them to continue', 'Might work',
        out(0.5, 'After a friendly chat, they agreed to continue.', { ratingMod: 0.2, xp: 5 }),
        out(0.5, 'They insisted on getting out and left without paying.', { cancelRide: true, partialFarePct: 0 })),
      opt('free', 'Drop them for free', 'Goodwill, no money', out(1, 'You dropped them for free. They called you a gentleman.', { cancelRide: true, partialFarePct: 0, xp: 12 })),
    ],
  },
  {
    type: 'CHANGE_DESTINATION', category: 'PASSENGER', severity: 'INFO', roles: ['DRIVER'], title: 'Passenger changes destination',
    weight: () => 1.1,
    describe: (c) => `Your passenger asks if you can go further than ${c.destinationName}.`,
    options: () => [
      opt('accept', 'Agree to the new destination', 'More distance, more fare', out(1, 'You agreed. The extra distance added to the fare.', { fareDeltaPct: 20, delayMin: [5, 8], fuel: -0.5, ratingMod: 0.2 })),
      opt('decline', 'Decline politely', 'Keep to the original trip', out(1, 'You politely declined. The passenger sighed.', { ratingMod: -0.4 })),
      opt('negotiate', 'Agree for a higher fare', 'May backfire',
        out(0.6, 'They accepted the higher price.', { fareDeltaPct: 35, delayMin: [5, 8], fuel: -0.5 }),
        out(0.4, 'They refused and stuck to the original trip.', { ratingMod: -0.2 })),
    ],
  },
  {
    type: 'DISCOUNT_REQUEST', category: 'PASSENGER', severity: 'INFO', roles: ['DRIVER'], title: 'Passenger asks for a discount',
    weight: () => 1.3,
    describe: (c) => `"Oga, please make we do small something on the price." Your fare is ${naira(c.baseFare)}.`,
    options: () => [
      opt('give', 'Give 10% off', 'Fair and friendly', out(1, 'They were delighted by the discount.', { fareDeltaPct: -10, ratingMod: 0.5 })),
      opt('half', 'Meet halfway (5% off)', 'Compromise', out(1, 'You settled on a small discount.', { fareDeltaPct: -5, ratingMod: 0.2 })),
      opt('refuse', 'Refuse politely', 'Keep the full fare',
        out(0.7, 'They shrugged and paid the full price.', {}),
        out(0.3, 'They grumbled for the rest of the trip.', { ratingMod: -0.6 })),
    ],
  },
  {
    type: 'VIP_PASSENGER', category: 'PASSENGER', severity: 'INFO', roles: ['DRIVER'], title: 'VIP on board',
    weight: (c) => (c.tier === 'VIP' ? 4 : c.rating >= 4.3 ? 0.9 : 0.2),
    describe: () => 'Your passenger is a busy executive on the phone. They want to arrive without delay.',
    options: () => [
      opt('fast', 'Take the fastest route', 'High reward, some risk',
        out(0.6, 'You delivered them early. They tipped well.', { cash: 3000, cashType: 'TIP', ratingMod: 0.5, xp: 10 }),
        out(0.4, 'An unexpected checkpoint spoiled the plan.', { delayMin: [5, 7], ratingMod: -0.2 })),
      opt('normal', 'Drive normally', 'Steady', out(1, 'A smooth, quiet ride.', { cash: 500, cashType: 'TIP', ratingMod: 0.1 })),
      opt('water', 'Offer water and a phone charger', 'Costs a little, pays back', out(1, 'They noticed the little touches.', { cash: 1800, cashType: 'TIP', ratingMod: 0.4, xp: 8 })),
    ],
  },
  {
    type: 'DEMAND_SURGE', category: 'ECONOMY', severity: 'INFO', roles: ['DRIVER'], title: 'Demand surge',
    weight: (c) => (c.hour >= 16 && c.hour <= 19) || c.raining ? 1.8 : 0.7,
    describe: () => 'The area is crowded; passengers are fighting for rides. You could charge more.',
    options: () => [
      opt('surge', 'Charge a surge fare (+25%)', 'Earn more, risk complaints', out(1, 'You charged a surge price. Some grumbling.', { fareMultiplier: 1.25, ratingMod: -0.3 })),
      opt('fair', 'Keep the standard fare', 'Fair pricing builds reputation', out(1, 'Passengers loved the fair price.', { ratingMod: 0.3, xp: 6 })),
    ],
  },
  {
    type: 'POLICE_CHECKPOINT', category: 'LAW', severity: 'WARNING', roles: ['DRIVER', 'PASSENGER'], title: 'Police checkpoint',
    weight: (c) => (c.isNight ? 1.8 : 1.1),
    describe: () => 'Officers are checking vehicles at a roadblock ahead.',
    options: (c) =>
      isD(c)
        ? [
            opt('papers', 'Show your papers and cooperate', 'Best choice with a healthy car',
              out(c.condition >= 50 ? 1 : 0.45, 'Your documents checked out and you were waved on.', { delayMin: [2, 4] }),
              ...(c.condition >= 50 ? [] : [out(0.55, 'Officers flagged your vehicle as unroadworthy. You paid the official fine.', { cash: -6000, cashType: 'FINE' as const, delayMin: [5, 8] })])),
            opt('argue', 'Argue your case', 'Almost never works',
              out(0.35, 'The officer let you go with a warning.', { delayMin: [4, 6] }),
              out(0.65, 'It only made things worse. You paid a fine.', { cash: -8000, cashType: 'FINE', delayMin: [8, 12] })),
          ]
        : [
            opt('coop', 'Cooperate', 'Show ID if asked', out(1, 'A quick check and you were on your way.', { delayMin: [3, 5] })),
            opt('wait', 'Stay calm and wait', 'Let the driver handle it', out(1, 'The driver talked to the officers and you moved on.', { delayMin: [4, 7] })),
          ],
  },
  {
    type: 'TRAFFIC_VIOLATION', category: 'LAW', severity: 'WARNING', roles: ['DRIVER'], title: 'Traffic violation',
    weight: (c) => (c.traffic > 0.6 ? 1.3 : 0.6),
    describe: () => 'A road safety officer flags you down for crossing a solid line.',
    options: () => [
      opt('accept', 'Accept the ticket', 'Pay the official fine', out(1, 'You paid the official fine and moved on.', { cash: -4000, cashType: 'FINE', delayMin: [3, 5], ratingMod: -0.1 })),
      opt('contest', 'Contest it', 'Could be dismissed',
        out(0.3, 'The officer agreed it was a mistake.', { delayMin: [5, 7] }),
        out(0.7, 'The ticket stood, with an added penalty.', { cash: -5500, cashType: 'FINE', delayMin: [7, 9] })),
    ],
  },
  {
    type: 'ACCIDENT_TRAFFIC', category: 'TRAFFIC', severity: 'DANGER', roles: ['DRIVER', 'PASSENGER'], title: 'Accident ahead',
    weight: (c) => 0.8 + c.traffic * (c.raining ? 2.4 : 1.2),
    describe: () => 'A collision up ahead has blocked two lanes. Emergency services are on the scene.',
    options: (c) =>
      isD(c)
        ? [
            opt('queue', 'Wait in the queue', 'Safe', out(1, 'You waited until emergency crews cleared the lane.', { delayMin: [12, 16] })),
            opt('shoulder', 'Use the shoulder', 'Illegal but quick',
              out(0.6, 'You slipped past on the shoulder.', { delayMin: [3, 5] }),
              out(0.4, 'An officer caught you on the shoulder.', { cash: -3000, cashType: 'FINE', delayMin: [5, 7], ratingMod: -0.3 })),
            opt('assist', 'Stop and help', 'Costs time, earns respect', out(1, 'You helped until the paramedics arrived. Your passenger was moved.', { delayMin: [9, 12], xp: 25, ratingMod: 0.3 })),
          ]
        : [
            opt('wait', 'Wait in the queue', 'Nothing to do', out(1, 'You waited for the road to clear.', { delayMin: [12, 16] })),
            opt('alt', 'Ask the driver to take another route', 'Longer way', out(1, 'The driver took a detour.', { delayMin: [7, 10], fareDelta: 250 })),
          ],
  },
  {
    type: 'FUEL_SURCHARGE', category: 'ECONOMY', severity: 'INFO', roles: ['PASSENGER'], title: 'Driver asks for extra',
    weight: () => 1,
    describe: () => 'The driver says fuel is scarce and asks for a little extra on the fare.',
    options: () => [
      opt('pay', 'Agree to pay ₦500 extra', 'Keeps the peace', out(1, 'The driver thanked you.', { fareDelta: 500 })),
      opt('refuse', 'Refuse', 'Stick to the agreed fare',
        out(0.5, 'The driver accepted the agreed fare.', {}),
        out(0.5, 'The driver sulked and drove slowly.', { delayMin: [3, 5] })),
    ],
  },
  {
    type: 'UNSAFE_AREA', category: 'SECURITY', severity: 'WARNING', roles: ['DRIVER', 'PASSENGER'], title: 'Unsafe area warning',
    weight: (c) => 0.6 + c.districtRisk * 4 + (c.isNight ? 1 : 0),
    describe: () => 'A text from the transport union warns of suspicious activity in the area ahead.',
    options: (c) => [
      opt('main', 'Stay on the main road', 'Slower but lit', out(1, 'You stayed on the main road. Nothing happened.', { delayMin: [4, 6], fuel: isD(c) ? -0.3 : 0 })),
      opt('continue', 'Continue as planned', 'Faster',
        out(0.85, 'You passed through without incident.', {}),
        out(0.15, 'A small incident cost you some cash.', { lostCashPct: 6, lostCashCap: 8000 })),
      opt('wait', 'Wait for traffic to build up', 'Safety in numbers', out(1, 'You waited, then moved with a group of vehicles.', { delayMin: [6, 8] })),
    ],
  },
  {
    type: 'ROBBERY_RISK', category: 'SECURITY', severity: 'DANGER', roles: ['DRIVER', 'PASSENGER'], title: 'Robbery risk',
    weight: (c) => (0.25 + c.districtRisk * 5) * (c.isNight ? 2.2 : 0.8),
    describe: () => 'Reports indicate increased security risk along this route.',
    options: (c) => [
      opt('alternate', 'TAKE ALTERNATE ROUTE', 'Safest, takes longer', out(0.94, 'You avoided the risky stretch completely.', { delayMin: [8, 11], fuel: isD(c) ? -0.6 : 0, xp: 5 }), out(0.06, 'You avoided the main danger but lost a little time and cash.', { delayMin: [10, 12], lostCashPct: 3, lostCashCap: 3000 })),
      opt('continue', 'CONTINUE', 'Fast but risky',
        out(0.62, 'The road was quiet. You got through safely.', { xp: 8 }),
        out(0.38, isD(c) ? 'Troublemakers stopped you. You lost cash and your trip earnings suffered.' : 'Troublemakers stopped you and took some of your cash.', { lostCashPct: 14, lostCashCap: 18000, fareMultiplier: isD(c) ? 0.6 : 1, delayMin: [4, 6] })),
      opt('wait', 'WAIT', 'Let it pass', out(0.85, 'You waited in a busy spot and moved on when it was safe.', { delayMin: [7, 10] }), out(0.15, 'The wait dragged on, but you stayed safe.', { delayMin: [16, 20] })),
    ],
  },
];

export const eventDef = (type: string): EventDef | undefined => EVENT_CATALOG.find((e) => e.type === type);
