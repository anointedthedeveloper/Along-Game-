/**
 * Integration tests for game systems the HTTP smoke test does not reach.
 * Boots its own in-memory MongoDB:  npm run test:logic
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EVENT_CATALOG, type EventContext } from '../data/events';
import { LOCATIONS, NODES } from '../data/world';
import { VEHICLES } from '../data/vehicles';
import { PlayerProgress, Transaction, User, Vehicle } from '../models';
import * as auth from '../services/auth.service';
import * as fleet from '../services/fleet.service';
import { awardXp, computeLevel, ensureProgress } from '../services/progress.service';
import { quoteFare } from '../services/fare.service';
import { routeBetweenLocations } from '../services/routing.service';
import * as vehicles from '../services/vehicle.service';
import { credit, debit, debitUpTo, deposit, withdraw } from '../services/wallet.service';
import { getWorld, clockAt, weatherAt, demandAt } from '../services/world.service';
import { seedLocations } from '../services/location.service';

let passed = 0;
const ok = (name: string, cond: unknown, extra?: unknown) => {
  if (!cond) {
    console.error(`  ✗ ${name}`, extra ?? '');
    throw new Error(`Failed: ${name}`);
  }
  passed++;
  console.log(`  ✓ ${name}`);
};
const rejects = async (name: string, fn: () => Promise<unknown>, status?: number) => {
  try {
    await fn();
  } catch (e) {
    ok(name, status === undefined || (e as { status?: number }).status === status, e);
    return;
  }
  ok(name, false, 'expected rejection');
};

async function main() {
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('logic'));
  await seedLocations();

  console.log('\nWORLD');
  const w = getWorld();
  ok('world has clock, weather, incidents', w.clock && w.weather && Array.isArray(w.incidents));
  ok('morning peak demand beats 3am', demandAt(7.6 * 60) > demandAt(3 * 60) * 2);
  ok('evening peak is the busiest', demandAt(17.6 * 60) >= demandAt(12 * 60));
  ok('clock labels', clockAt(8 * 60 + 5).label === '8:05 AM' && clockAt(23 * 60).label === '11:00 PM');
  ok('phases', clockAt(6 * 60).phase === 'MORNING' && clockAt(14 * 60).phase === 'AFTERNOON' && clockAt(18 * 60).phase === 'EVENING' && clockAt(22 * 60).phase === 'NIGHT');
  ok('night is dark, noon is bright', clockAt(2 * 60).daylight === 0 && clockAt(12 * 60).daylight === 1);
  const kinds = new Set(Array.from({ length: 400 }, (_, i) => weatherAt(i * 150).kind));
  ok('all four weather kinds occur', kinds.size === 4, [...kinds]);
  ok('weather is deterministic', weatherAt(1234567).kind === weatherAt(1234567).kind);

  console.log('\nROUTING & FARES');
  let bad = 0;
  let maxKm = 0;
  for (const a of LOCATIONS) for (const b of LOCATIONS) {
    if (a.key === b.key) continue;
    try {
      const r = routeBetweenLocations(a, b, VEHICLES[2], w);
      maxKm = Math.max(maxKm, r.distanceKm);
      if (!(r.distanceKm > 0 && r.durationMin > 0 && r.geometry.length >= 2)) bad++;
    } catch {
      bad++;
    }
  }
  ok(`every pair of ${LOCATIONS.length} places is routable (longest ${maxKm.toFixed(1)} km)`, bad === 0, bad);
  ok('all locations snap to a junction', LOCATIONS.every((l) => NODES.some((n) => n.id === l.nodeId)));
  const spec = VEHICLES.find((v) => v.id === 'sedan_taxi')!;
  const f1 = quoteFare({ distanceKm: 8.4, durationMin: 24, spec, world: w });
  ok(`fare for 8.4 km / 24 min is sensible (₦${f1.total})`, f1.total >= 1800 && f1.total <= 4000);
  ok('fare scales with group', quoteFare({ distanceKm: 5, durationMin: 12, spec, world: w, groupSize: 3 }).total === quoteFare({ distanceKm: 5, durationMin: 12, spec, world: w }).total * 3);
  ok('premium tier costs more', quoteFare({ distanceKm: 5, durationMin: 12, spec, world: w, tier: 'VIP' }).total > quoteFare({ distanceKm: 5, durationMin: 12, spec, world: w }).total);

  console.log('\nEVENT CATALOG');
  const base: EventContext = { role: 'DRIVER', weather: 'RAIN', hour: 21, traffic: 0.7, condition: 40, fuelFraction: 0.2, tyreLevel: 0, reliability: 5, vehicleName: 'Test', rating: 4.6, districtRisk: 0.2, originName: 'A', destinationName: 'B', groupSize: 1, tier: 'VIP', baseFare: 2000, isNight: true, raining: true };
  for (const role of ['DRIVER', 'PASSENGER'] as const) {
    for (const def of EVENT_CATALOG.filter((e) => e.roles.includes(role))) {
      const ctx = { ...base, role };
      const opts = def.options(ctx);
      const valid = opts.length >= 1 && new Set(opts.map((o) => o.id)).size === opts.length && opts.every((o) => o.outcomes.length > 0 && o.outcomes.every((x) => x.weight > 0 && x.message.length > 0));
      if (!valid) ok(`event ${def.type}/${role} is well-formed`, false);
      if (def.weight(ctx) < 0 || !def.describe(ctx)) ok(`event ${def.type}/${role} weight/describe`, false);
    }
  }
  const required = ['HEAVY_TRAFFIC', 'ROAD_CONSTRUCTION', 'ROAD_CLOSURE', 'SUDDEN_RAIN', 'FLOODED_ROAD', 'VEHICLE_BREAKDOWN', 'FLAT_TYRE', 'ENGINE_OVERHEATING', 'FUEL_SHORTAGE', 'PASSENGER_CANCEL', 'CHANGE_DESTINATION', 'DISCOUNT_REQUEST', 'VIP_PASSENGER', 'POLICE_CHECKPOINT', 'TRAFFIC_VIOLATION', 'TRAFFIC_DIVERSION', 'ACCIDENT_TRAFFIC', 'DEMAND_SURGE', 'UNSAFE_AREA', 'ROBBERY_RISK'];
  ok('all 20 requested event types exist', required.every((t) => EVENT_CATALOG.some((e) => e.type === t)));
  const robbery = EVENT_CATALOG.find((e) => e.type === 'ROBBERY_RISK')!.options(base).map((o) => o.label);
  ok('robbery risk offers alternate / continue / wait', ['TAKE ALTERNATE ROUTE', 'CONTINUE', 'WAIT'].every((l) => robbery.includes(l)));

  console.log('\nWALLET');
  const reg = await auth.register({ name: 'Logic Tester', email: 'logic@test.ng', password: 'password123', mode: 'DRIVER' });
  const uid = reg.user.id;
  ok('starter cash granted via the ledger', (await Transaction.countDocuments({ user: uid, type: 'STARTER_GRANT' })) === 1 && reg.user.cash === 25000);
  await rejects('overspend rejected', () => debit(uid, 1_000_000, 'OTHER_EXPENSE', 'x'), 402);
  await rejects('negative amount rejected', () => credit(uid, -5, 'REWARD', 'x'), 400);
  const partial = await debitUpTo(uid, 1_000_000, 'FINE', 'big fine');
  ok('forced fines take only what exists', partial.charged === 25000 && (await User.findById(uid))!.cash === 0);
  await credit(uid, 10_000_000, 'REWARD', 'test funds');
  const b = await deposit(uid, 4_000_000);
  ok('deposit moves cash to bank', b.cash === 6_000_000 && b.bank === 4_000_000);
  await rejects('cannot withdraw more than banked', () => withdraw(uid, 5_000_000), 402);
  ok('ledger is balanced', (await Transaction.find({ user: uid }).sort({ createdAt: 1 })).every((t) => Number.isFinite(t.cashAfter) && t.cashAfter >= 0 && t.bankAfter >= 0));
  const conc = await Promise.allSettled(Array.from({ length: 20 }, () => debit(uid, 500_000, 'OTHER_EXPENSE', 'race')));
  ok('concurrent debits never overdraw', conc.filter((r) => r.status === 'fulfilled').length === 12 && (await User.findById(uid))!.cash === 0, conc.map((r) => r.status));
  await withdraw(uid, 4_000_000);

  console.log('\nVEHICLES & PROGRESSION');
  let user = (await User.findById(uid))!;
  const prog = await ensureProgress(uid);
  ok('level 1 at start', prog.level === 1 && computeLevel(0, 4.5) === 1);
  await rejects('level gate: corolla needs level 2', () => vehicles.buyVehicle(user, 'corolla', 'CASH'), 403);
  const lvl = await awardXp(prog, 320);
  ok('XP pushes the driver to level 2', lvl?.to === 2 && prog.level === 2);
  ok('a bad rating blocks promotion', computeLevel(5000, 3.0) === 1);
  await rejects('cannot buy a vehicle away from a garage', () => vehicles.buyVehicle(user, 'corolla', 'CASH'), 409);
  user.locationKey = 'wuse_garage';
  await user.save();
  await rejects('level gate: camry needs level 3', () => vehicles.buyVehicle(user, 'camry', 'CASH'), 403);
  const second = await vehicles.buyVehicle(user, 'corolla', 'CASH');
  ok('level 2 may own two vehicles', second.name === 'Toyota Corolla');
  await rejects('fleet limit stops a third vehicle at level 2', () => vehicles.buyVehicle(user, 'keke', 'CASH'), 403);
  await Vehicle.deleteOne({ _id: second.id });
  prog.xp = 2600;
  prog.rating = 4.7;
  prog.level = 4;
  await prog.save();
  user = (await User.findById(uid))!;
  await credit(uid, 10_000_000, 'REWARD', 'more test funds');
  const corolla = await vehicles.buyVehicle(user, 'corolla', 'CASH');
  ok('bought a corolla and was charged', corolla.name === 'Toyota Corolla' && (await Transaction.exists({ user: uid, type: 'VEHICLE_PURCHASE', amount: -1_200_000 })));
  const bus = await vehicles.buyVehicle(user, 'minibus', 'CASH');
  ok('bought a minibus', bus.cls === 'MINIBUS');
  const up = await vehicles.upgrade(user, corolla.id, 'engine');
  ok('engine upgrade raises speed and cuts fuel use', up.vehicle.stats.speedKph > corolla.stats.speedKph && up.vehicle.stats.fuelPer100km < corolla.stats.fuelPer100km);
  await Vehicle.updateOne({ _id: corolla.id }, { condition: 50 });
  const rep = await vehicles.repair(user, corolla.id, 100);
  ok('repairs cost money proportional to damage', rep.points === 50 && rep.cost === 50 * corolla.repairCostPerPoint);
  await rejects('cannot refuel at a garage', () => vehicles.refuel(user, corolla.id, { toPercent: 100 }), 409);
  user.locationKey = 'wuse_petrol';
  await user.save();
  const fuel = await vehicles.refuel(user, corolla.id, { toPercent: 100 });
  ok('refuel fills the tank at the daily price', fuel.vehicle.fuelPercent === 100 && fuel.cost === Math.ceil(fuel.liters * getWorld().fuelPrice));

  console.log('\nFLEET BUSINESS');
  const spare = (await Vehicle.find({ owner: uid })).find((v) => v.specId === 'minibus')!;
  const hired = await fleet.hireDriver(user, String(spare._id));
  ok('hired a driver for the spare vehicle', !!hired.hiredDriver);
  await rejects('cannot hire onto the vehicle you drive', () => fleet.hireDriver(user, String(user.activeVehicleId)), 409);
  await Vehicle.updateOne({ _id: spare._id }, { 'hiredDriver.lastCollectedAt': new Date(Date.now() - 300_000) });
  const before = (await User.findById(uid))!.cash;
  const collected = await fleet.collectFleet(user);
  const after = (await User.findById(uid))!.cash;
  ok(`collected fleet takings (₦${collected.total.toLocaleString()} net after fuel and wages)`, collected.results.length === 1 && after > before && (await Transaction.exists({ user: uid, type: 'FLEET_INCOME' })), { before, after, collected });
  ok('wages are recorded as an expense', !!(await Transaction.exists({ user: uid, type: 'DRIVER_WAGE' })));
  const total = await PlayerProgress.findOne({ user: uid });
  ok('progress tracks daily money in/out', total!.totalEarnings > 0 && total!.totalExpenses > 0);

  await mongoose.disconnect();
  await mem.stop();
  console.log(`\nAll ${passed} logic checks passed`);
}

main().catch(async (e) => {
  console.error('\nLOGIC TEST FAILED:', e.message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
