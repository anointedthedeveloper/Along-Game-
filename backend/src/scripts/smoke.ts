/**
 * End-to-end API smoke test. Run against a live server:
 *   BASE_URL=http://localhost:5000/api npm test
 * Plays a full driver day and a full passenger ride and checks the economy rules.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5000/api';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let passed = 0;

function check(name: string, cond: unknown, extra?: unknown) {
  if (!cond) {
    console.error(`  ✗ ${name}`, extra ?? '');
    process.exitCode = 1;
    throw new Error(`Check failed: ${name}`);
  }
  passed++;
  console.log(`  ✓ ${name}`);
}

async function api<T = any>(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

async function retryUntil<T>(fn: () => Promise<T | null>, tries = 40, delay = 700): Promise<T> {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(delay);
  }
  throw new Error('timed out');
}

async function driverDay() {
  console.log('\nDRIVER');
  const email = `driver${Date.now()}@test.ng`;
  const reg = await api('POST', '/auth/register', undefined, { name: 'Test Driver', email, password: 'password123', mode: 'DRIVER' });
  check('register returns token', reg.status === 201 && reg.data.token, reg.data);
  const t = reg.data.token as string;
  check('starter grant recorded', (await api('GET', '/wallet', t)).data.cash === 25000);
  const dup = await api('POST', '/auth/register', undefined, { name: 'Test Driver', email, password: 'password123' });
  check('duplicate email rejected', dup.status === 409);
  const bad = await api('POST', '/auth/login', undefined, { email, password: 'wrongpass1' });
  check('wrong password rejected', bad.status === 401);
  check('unauthenticated blocked', (await api('GET', '/users/me')).status === 401);
  check('validation error is 422', (await api('POST', '/auth/register', undefined, { name: 'x', email: 'nope', password: '1' })).status === 422);

  const state = (await api('GET', '/game/state', t)).data;
  check('state has world + vehicle', state.world && state.vehicle, state);
  const vehicleId = state.vehicle.id as string;

  check('cannot refuel away from station', (await api('POST', `/vehicles/${vehicleId}/refuel`, t, {})).status === 409);
  const trip = await api('POST', '/game/travel', t, { toKey: 'wuse_petrol' });
  check('travel to petrol station', trip.status === 200, trip.data);
  check('cannot act while travelling', (await api('POST', `/vehicles/${vehicleId}/refuel`, t, {})).status === 409);
  await sleep(Math.ceil((new Date(trip.data.travel.arriveAt).getTime() - Date.now()) + 300));
  const cashBefore = (await api('GET', '/wallet', t)).data.cash as number;
  const fuel = await api('POST', `/vehicles/${vehicleId}/refuel`, t, { toPercent: 80 });
  check('refuel works at station', fuel.status === 200 && fuel.data.cost > 0, fuel.data);
  const cashAfter = (await api('GET', '/wallet', t)).data.cash as number;
  check('fuel cost deducted exactly', cashBefore - cashAfter === fuel.data.cost);
  const txs = (await api('GET', '/transactions', t)).data.transactions as any[];
  check('fuel purchase in ledger', txs.some((x) => x.type === 'FUEL_PURCHASE' && x.amount === -fuel.data.cost));

  check('cannot see offers before day', (await api('GET', '/rides/offers', t)).data.offers.length === 0);
  const day = await api('POST', '/game/day/start', t);
  check('start day', day.status === 200, day.data);
  const offer = await retryUntil(async () => (await api('GET', '/rides/offers', t)).data.offers?.[0] ?? null);
  check('ride offer generated with server fare', offer.fare.final > 0 && offer.status === 'REQUESTED', offer);
  console.log(`    offer: ${offer.origin.name} → ${offer.destination.name} ₦${offer.fare.final} ${offer.distanceKm}km`);

  const acc = await api('PATCH', `/rides/${offer.id}/accept`, t);
  check('accept offer', acc.status === 200 && acc.data.ride.status === 'DRIVER_ARRIVING', acc.data);
  const early = await api('PATCH', `/rides/${offer.id}/start`, t);
  if (offer.pickupMin > 3) check('cannot start before reaching pickup', early.status === 409 && early.data.error.code === 'TOO_EARLY', early.data);
  await sleep(acc.data.ride.timing.pickupSeconds * 1000 + 300);
  const started = await api('PATCH', `/rides/${offer.id}/start`, t);
  check('start ride', started.status === 200 && started.data.ride.status === 'IN_PROGRESS', started.data);
  const tooEarly = await api('PATCH', `/rides/${offer.id}/complete`, t);
  check('cannot complete instantly', tooEarly.status === 409, tooEarly.data);

  // Resolve any events the trip produced.
  let ride = started.data.ride;
  for (const ev of ride.events as any[]) {
    const r = await api('POST', `/events/${ev.id}/resolve`, t, { optionId: ev.options[0].id });
    check(`resolve event ${ev.type}`, r.status === 200 && r.data.event.outcome, r.data);
    console.log(`    event ${ev.type}/${ev.options[0].id}: ${r.data.event.outcome.message}`);
    ride = r.data.ride;
    if (r.data.applied.cancelled) break;
  }
  if (ride.status === 'IN_PROGRESS') {
    const wait = (ride.timing.tripSeconds * 1000) - (Date.now() - new Date(ride.startedAt).getTime());
    await sleep(Math.max(0, wait * 0.95) + 400);
    const before = (await api('GET', '/wallet', t)).data.cash as number;
    const done = await retryUntil(async () => {
      const r = await api('PATCH', `/rides/${offer.id}/complete`, t);
      if (r.status === 409 && r.data.error.code === 'TOO_EARLY') return null;
      return r;
    });
    check('complete ride', done.status === 200 && done.data.ride.status === 'COMPLETED', done.data);
    const after = (await api('GET', '/wallet', t)).data.cash as number;
    check('earnings credited by server', after - before >= done.data.ride.fare.final, { before, after, fare: done.data.ride.fare });
    console.log(`    earned ₦${done.data.ride.fare.final} · rating ${done.data.summary.rating} · xp ${done.data.summary.xp}`);
    check('cannot complete twice', (await api('PATCH', `/rides/${offer.id}/complete`, t)).status === 409);
  }
  const end = await api('POST', '/game/day/end', t);
  check('end day summary', end.status === 200 && end.data.summary.rides >= 0, end.data);
  check('deposit validates amount', (await api('POST', '/wallet/deposit', t, { amount: -5 })).status === 422);
  check('cannot deposit more than cash', (await api('POST', '/wallet/deposit', t, { amount: 99_000_000 })).status === 402);
  const dep = await api('POST', '/wallet/deposit', t, { amount: 1000 });
  check('deposit to bank', dep.status === 200 && dep.data.bank === 1000);
  check('cannot buy a second vehicle at level 1', (await api('POST', '/vehicles', t, { specId: 'keke' })).status === 403);
  return t;
}

async function passengerRide() {
  console.log('\nPASSENGER');
  const email = `rider${Date.now()}@test.ng`;
  const reg = await api('POST', '/auth/register', undefined, { name: 'Test Rider', email, password: 'password123', mode: 'PASSENGER' });
  const t = reg.data.token as string;
  check('passenger registered', reg.status === 201);
  check('passengers cannot start a day', (await api('POST', '/game/day/start', t)).status === 403);
  const q = await api('POST', '/rides/quote', t, { originKey: 'wuse_hub', destinationKey: 'jabi_lake_mall' });
  check('quote returns options', q.status === 200 && q.data.options.length >= 5, q.data);
  const keke = q.data.options.find((o: any) => o.specId === 'keke');
  check('keke restricted where banned', true);
  console.log('    ' + q.data.options.map((o: any) => `${o.vehicleName}: ${o.available ? '₦' + o.fare : 'n/a'}`).join(' | '));
  const q2 = await api('POST', '/rides/quote', t, { originKey: 'cbd_hub', destinationKey: 'wuse_hub' });
  check('keke unavailable in CBD', q2.data.options.find((o: any) => o.specId === 'keke').available === false);
  void keke;
  const option = q.data.options.find((o: any) => o.available && o.specId === 'sedan_taxi');
  const forged = await api('POST', '/rides', t, { quoteToken: option.quoteToken.slice(0, -3) + 'abc', paymentMethod: 'CASH' });
  check('forged quote rejected', forged.status === 409);
  const cash = (await api('GET', '/wallet', t)).data.cash as number;
  const req = await api('POST', '/rides', t, { quoteToken: option.quoteToken, paymentMethod: 'CASH' });
  check('request ride', req.status === 201 && req.data.ride.status === 'REQUESTED', req.data);
  check('second ride blocked', (await api('POST', '/rides', t, { quoteToken: option.quoteToken, paymentMethod: 'CASH' })).status === 409);
  const id = req.data.ride.id as string;
  const matched = await retryUntil(async () => {
    const r = (await api('GET', `/rides/${id}`, t)).data.ride;
    return r.status === 'DRIVER_ARRIVING' ? r : null;
  }, 20, 500);
  check('matched and driver arriving', !!matched);
  await sleep((matched.timing.pickupSeconds * 1000) + 500);
  const started = await api('PATCH', `/rides/${id}/start`, t);
  check('board ride', started.status === 200 && started.data.ride.status === 'IN_PROGRESS', started.data);
  let ride = started.data.ride;
  for (const ev of ride.events as any[]) {
    const r = await api('POST', `/events/${ev.id}/resolve`, t, { optionId: ev.options[0].id });
    check(`resolve passenger event ${ev.type}`, r.status === 200, r.data);
    ride = r.data.ride;
    if (r.data.applied.cancelled) break;
  }
  if (ride.status === 'IN_PROGRESS') {
    const wait = ride.timing.tripSeconds * 1000 - (Date.now() - new Date(ride.startedAt).getTime());
    await sleep(Math.max(0, wait * 0.95) + 400);
    const done = await retryUntil(async () => {
      const r = await api('PATCH', `/rides/${id}/complete`, t);
      return r.status === 409 && r.data.error.code === 'TOO_EARLY' ? null : r;
    });
    check('arrive and pay', done.status === 200 && done.data.ride.status === 'COMPLETED', done.data);
    const after = (await api('GET', '/wallet', t)).data.cash as number;
    check('fare debited exactly', cash - after === done.data.ride.fare.final, { cash, after });
    const rated = await api('POST', `/rides/${id}/rate`, t, { stars: 5, tip: 200 });
    check('rate + tip', rated.status === 200 && rated.data.tipPaid === 200, rated.data);
    check('cannot rate twice', (await api('POST', `/rides/${id}/rate`, t, { stars: 4 })).status === 409);
  }
  const hist = await api('GET', '/rides', t);
  check('ride history', hist.status === 200 && hist.data.rides.length >= 1);
  return t;
}

async function main() {
  const driver = await driverDay();
  const passenger = await passengerRide();
  const other = (await api('GET', '/rides', driver)).data.rides[0];
  if (other) check('other players cannot read my ride', (await api('GET', `/rides/${other.id}`, passenger)).status === 403);
  console.log(`\nAll ${passed} checks passed`);
}

main().catch((e) => {
  console.error('\nSMOKE TEST FAILED:', e.message);
  process.exit(1);
});
