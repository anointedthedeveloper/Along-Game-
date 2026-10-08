# ALONG

**Move. Drive. Experience Along.**
A realistic Nigerian transportation simulation set in a fictional capital city inspired by Abuja. Play as a **driver** (fuel, fares, repairs, reputation, a growing fleet) or as a **passenger** (compare fares, ride across the city, tip, rate) in a living world with a day/night cycle, weather, traffic and road events.

The repository holds two **fully independent applications** that talk only over HTTP and Socket.IO:

```
Along-Game-/
├── backend/    Node + Express + TypeScript + MongoDB (Mongoose) + Socket.IO   → authoritative game server
└── frontend/   React + TypeScript + Vite + Tailwind + React Router + Zustand  → the game client
```

Neither imports code from the other. Deploy them separately (e.g. `https://along.example.com` + `https://api.along.example.com`).

## Quick start

Requirements: Node 20+ and a MongoDB (local, or free MongoDB Atlas). For a zero-setup try-out the backend can boot an in-memory MongoDB.

```bash
# 1. API
cd backend
cp .env.example .env            # set JWT_SECRET and MONGODB_URI
npm install
npm run dev                     # http://localhost:5000   (or: npm run dev:memory — no MongoDB needed)

# 2. Game client (new terminal)
cd frontend
cp .env.example .env            # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                     # http://localhost:5173
```

Open http://localhost:5173, create an account, pick **Driver** or **Passenger**, and enter the city.

### Environment variables

| App | Variable | Purpose |
|---|---|---|
| backend | `PORT` | API port (default 5000) |
| backend | `MONGODB_URI` | MongoDB connection string (Atlas in production) |
| backend | `JWT_SECRET` | Signs sessions — **required in production** |
| backend | `CLIENT_URL` | Allowed browser origin(s), comma separated (CORS + Socket.IO) |
| backend | `JWT_EXPIRES_IN`, `ADMIN_EMAILS`, `GAME_SPEED`, `USE_MEMORY_DB` | optional, see `backend/.env.example` |
| frontend | `VITE_API_URL` | API base URL including `/api`; Socket.IO derives its host from it |

Nothing is hard-coded: no URLs, secrets or credentials. `.env` files are git-ignored; both apps ship an `.env.example`.

## How the game works

**A day in the life of a driver:** *start day → check the vehicle and fuel → find passengers → accept a ride → drive (the car follows the server-calculated route) → meet road events → complete the trip → get paid → keep working → maintain the vehicle → end day.*

**A trip as a passenger:** *choose where you are → choose a destination → compare vehicles and fares → request → matched with a driver → watch them arrive → ride → pay → rate and tip.*

* **City** – 12 districts (Wuse, Garki, Area 1 & 2, Maitama, Asokoro, Jabi, Utako, Gwarinpa, Kubwa, Airport Road, CBD), 62 places (petrol stations, garages, bus stops, markets, malls, hospitals, hotels, an airport…), expressways/arterials/local roads, roundabouts and a lake. The map is rendered on Leaflet with a procedural canvas city (curved roads with lane markings, extruded buildings, trees, parks).
* **Time** – a game day lasts 24 real minutes. Demand and traffic follow the clock (morning and evening rush, quiet nights with pricier fares). The visuals change with it: dawn/sunset tint, dark night with streetlights, headlights and lit windows.
* **Weather** – sunny, cloudy, rain, heavy rain. Rain slows roads, floods streets, raises demand and fares and changes the visuals.
* **Events** – 20 event types with real consequences (heavy traffic, construction, closures, diversions, sudden rain, floods, breakdowns, flat tyres, overheating, fuel scarcity, passenger cancellations / destination changes / discount requests, VIPs, police checkpoints, violations, accidents, demand surges, unsafe-area warnings and *robbery risk* — kept non-graphic: *take alternate route / continue / wait*). Every choice has weighted outcomes that change money, time, fuel, vehicle condition, fares or ratings.
* **Economy** – Naira (₦). Every transaction is recorded (`RIDE_EARNING`, `RIDE_PAYMENT`, `FUEL_PURCHASE`, `MAINTENANCE`, `VEHICLE_PURCHASE`, `VEHICLE_UPGRADE`, `FINE`, `REWARD`, `TIP`, fleet income/wages…). Cash vs bank; bank money is safe from road incidents.
* **Vehicles** – Sedan taxi (Nissan Sunny), Toyota Corolla, Toyota Camry, Honda Accord private car, keke, okada, HiAce minibus, Coaster bus; each with price, fuel use, capacity, speed, comfort, reliability, upkeep, demand. City by-laws apply: keke are banned in the CBD/Maitama/Asokoro, okada only operate in the outer districts.
* **Reputation & progression** – five levels (*New Driver → Regular → Experienced → Professional → Transport Boss*). Ratings depend on punctuality, cleanliness, vehicle condition, comfort and the fairness of your choices. Higher levels unlock districts, vehicles, premium/VIP passengers, a larger fleet and the ability to **hire drivers** who work spare vehicles for a share of the profit.

## Architecture

### Backend (`backend/src`)

```
config/        env + database connection
models/        User, Vehicle, Ride, Transaction, PlayerProgress, GameEvent, Rating, Notification, Location
services/      all game logic: wallet, rides, offers, quotes, fares, routing, events, world clock/weather,
               vehicles, fleet, progression, auth, notifications, socket registry
controllers/   thin HTTP handlers      routes/   routing + validation wiring
middleware/    auth (JWT), role/mode authorisation, zod validation, rate limits, error handling
data/          world geography, vehicle catalogue, event catalogue (pure data)
sockets/       Socket.IO server (authenticated rooms, offer pump, world ticks)
scripts/       smoke.ts (HTTP end-to-end) and logic.test.ts (system tests)
```

**The server is authoritative.** The client never sends a balance, a fare, a distance or a result:

* Money moves only through `wallet.service`, using atomic conditional updates (`cash >= amount`) plus an immutable ledger entry — concurrent requests cannot overdraw (covered by a test that fires 20 simultaneous debits).
* Fares are computed by one function (`fare.service`) from real route distance/duration, vehicle, demand, weather and time. Passenger quotes are **signed JWTs**, so a price cannot be tampered with.
* Rides are a state machine: `REQUESTED → MATCHED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED | CANCELLED`. The server enforces **minimum real time** for each leg (pick-up, trip), blocks completion while a road event is unresolved, and decides event outcomes.
* World state (clock, weather, traffic, incidents, fuel price) is a pure function of server time, identical for every player and instance.
* Fuel, wear, ratings, XP, levels and unlocks are all computed server-side.

### Frontend (`frontend/src`)

```
pages/         Landing, auth pages, Play (the city), Garage, Wallet, Profile, Fleet, Credits
components/    HUD, driver dock, passenger planner, ride cards, event modal, UI kit
game/          engine (Leaflet + canvas), procedural city generator, tiles, sprites, traffic sim, Stage (trip animation)
store/         Zustand stores (auth, game, ui, plan, toast) and player actions
services/      typed API client layer      lib/  fetch wrapper, socket, formatting
```

The game screen is a Leaflet map with a custom procedural tile layer (no map-tile downloads — it works offline and at any zoom) and a canvas overlay for traffic, vehicles, weather, day/night lighting and markers. The `Stage` interpolates the player along the **server-provided route** and raises events at the right point; React renders only the UI chrome.

## API (all under `/api`)

| | |
|---|---|
| Auth | `POST /auth/register` · `/auth/login` · `/auth/logout` · `/auth/forgot-password` · `/auth/reset-password` · `GET /auth/session` |
| Users | `GET /users/me` · `PATCH /users/me` · `PATCH /users/me/password` · `GET /users/me/notifications` · `/users/me/ratings` |
| Game | `GET /game/state` · `GET /game/progress` · `POST /game/day/start` · `/game/day/end` · `GET /game/day/checklist` · `POST /game/travel` · `POST /game/location` |
| Vehicles | `GET /vehicles` · `GET /vehicles/catalog` · `POST /vehicles` (buy) · `PATCH /vehicles/:id/activate` · `POST /vehicles/:id/refuel` · `/repair` · `/wash` · `/upgrade` |
| Fleet | `GET /fleet` · `POST /fleet/:id/hire` · `DELETE /fleet/:id/driver` · `POST /fleet/collect` |
| Rides | `GET /rides` · `GET /rides/active` · `GET /rides/offers` · `POST /rides/quote` · `POST /rides` · `GET /rides/:id` · `PATCH /rides/:id/accept` · `/decline` · `/start` · `/complete` · `/cancel` · `POST /rides/:id/rate` |
| Wallet | `GET /wallet` · `POST /wallet/deposit` · `/wallet/withdraw` · `GET /transactions` |
| Events | `GET /events` · `POST /events/:id/resolve` |
| World | `GET /world` · `GET /world/map` · `GET /world/route` · `GET /locations` · `GET /leaderboard` |
| Admin | `GET /admin/overview` (role `ADMIN`; set `ADMIN_EMAILS`) |

**Real-time (Socket.IO)** – authenticated by JWT; pushes `ride:offer`, `ride:update`, `wallet:update`, `notification`, `world:tick`, and relays `driver:position` between players of a ride.

## Testing

```bash
cd backend
npm run test:logic                                   # self-contained (in-memory MongoDB): wallet races, levels, vehicles, fleet, routing, events
BASE_URL=http://localhost:5000/api npm test          # end-to-end against a running API: full driver day + full passenger ride + authorization
npm run typecheck && cd ../frontend && npm run build
```

## Deployment

* **Frontend** → Vercel / Netlify / Cloudflare Pages: build `npm run build`, publish `dist`, set `VITE_API_URL`. SPA rewrites are included (`vercel.json`, `public/_redirects`).
* **Backend** → Render / Railway / Fly.io / VPS: `backend/Dockerfile` is provided (or `npm run build && npm start`). Set `MONGODB_URI` (MongoDB Atlas), `JWT_SECRET`, `CLIENT_URL` (your frontend origin).
* `render.yaml` is a blueprint that deploys both independently.

## Credits

Photographs are from Wikimedia Commons under Creative Commons licences — see `/credits` in the app (`frontend/src/data/credits.ts`). City art, vehicle sprites and the map are generated procedurally.
