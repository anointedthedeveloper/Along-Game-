import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, CloudRain, Fuel, Gauge, Map as MapIcon, Moon, ShieldAlert, Siren, TrafficCone, Truck, Wrench } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Atmosphere } from '@/components/landing/Atmosphere';
import { LiveTicker } from '@/components/landing/LiveTicker';
import { RoadStrip } from '@/components/landing/RoadStrip';
import { useAuth } from '@/store/auth';

const DISTRICTS = ['Wuse', 'Garki', 'Area 1', 'Area 2', 'Maitama', 'Asokoro', 'Jabi', 'Utako', 'Gwarinpa', 'Kubwa', 'Airport Road', 'Central Business District'];

const VEHICLES = [
  { id: 'sedan_taxi', name: 'Sedan Taxi', line: 'The green-and-white city cab' },
  { id: 'corolla', name: 'Toyota Corolla', line: 'Nigeria\'s favourite' },
  { id: 'camry', name: 'Toyota Camry', line: 'Comfort for long trips' },
  { id: 'keke', name: 'Keke Napep', line: 'Three wheels, narrow lanes' },
  { id: 'minibus', name: 'Minibus', line: 'A full load on busy routes' },
  { id: 'bus', name: 'Coaster Bus', line: 'Big earnings, big bills' },
  { id: 'okada', name: 'Okada', line: 'Quick — where allowed' },
  { id: 'private_car', name: 'Private Car', line: 'Chauffeur-class rides' },
];

const EVENTS = [
  { icon: TrafficCone, title: 'Gridlock & diversions', text: 'A convoy shuts the road. Side street, or wait it out?' },
  { icon: CloudRain, title: 'Sudden downpours', text: 'Floods, slow roads, surging demand. Rain changes everything.' },
  { icon: Wrench, title: 'Breakdowns', text: 'Flat tyre, overheating engine — fix it yourself or pay the mechanic.' },
  { icon: Siren, title: 'Checkpoints', text: 'Papers in order? A worn-out car invites a fine.' },
  { icon: Fuel, title: 'Fuel scarcity', text: 'Queue for hours or buy from a jerrycan seller at a price.' },
  { icon: ShieldAlert, title: 'Security risk on route', text: 'Reports ahead. Alternate route, continue, or wait?' },
];

const LEVELS = ['New Driver', 'Regular Driver', 'Experienced Driver', 'Professional Driver', 'Transport Boss'];

export default function Landing() {
  const status = useAuth((s) => s.status);
  const authed = status === 'authenticated';
  const driverTo = authed ? '/play' : '/register?mode=driver';
  const riderTo = authed ? '/play' : '/register?mode=passenger';

  return (
    <div className="bg-asphalt-950 text-cream">
      {/* ------------------------------------------------------------ hero */}
      <header className="relative isolate min-h-[100svh] overflow-hidden">
        <img src="/images/taxis-painted.jpg" alt="Green and white taxis circling a roundabout in Abuja" className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ animation: 'ken-burns 38s ease-in-out infinite alternate' }} fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-asphalt-950 via-asphalt-950/55 to-asphalt-950/35" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#050a24]" style={{ animation: 'day-night 42s ease-in-out infinite', mixBlendMode: 'multiply' }} />
        <div aria-hidden className="absolute -right-24 -top-24 -z-10 h-[34rem] w-[34rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,214,120,0.55), rgba(255,170,60,0) 65%)', animation: 'sun-glare 14s ease-in-out infinite' }} />
        <Atmosphere />

        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo size={26} />
          <div className="flex items-center gap-2">
            {authed ? (
              <Link to="/play" className="rounded-lg bg-taxi px-4 py-2 font-display font-bold uppercase tracking-wide text-asphalt-950">Continue playing</Link>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-4 py-2 font-semibold hover:bg-white/10">Sign in</Link>
                <Link to="/register" className="hidden rounded-lg bg-taxi px-4 py-2 font-display font-bold uppercase tracking-wide text-asphalt-950 sm:block">Create account</Link>
              </>
            )}
          </div>
        </nav>

        <div className="mx-auto flex max-w-6xl flex-col justify-end px-5 pb-40 pt-16 sm:pt-28 lg:pb-48">
          <div className="mb-5"><LiveTicker /></div>
          <h1 className="font-display text-[clamp(3.2rem,11vw,9rem)] font-extrabold uppercase leading-[0.88] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            Move. Drive.<br /><span className="text-taxi">Experience Along.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-cream/90 sm:text-xl">
            A living Nigerian capital, seen from the driver&rsquo;s seat and the back seat. Chase the morning rush from Gwarinpa to the CBD, beat the rain to Jabi, argue with a checkpoint, and stretch ₦25,000 into a transport empire.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={driverTo} className="group inline-flex items-center gap-2 rounded-xl bg-taxi px-7 py-4 font-display text-xl font-extrabold uppercase tracking-wide text-asphalt-950 shadow-[0_4px_0_#9a7300] transition-transform hover:-translate-y-0.5">
              Play as driver <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to={riderTo} className="group inline-flex items-center gap-2 rounded-xl border-2 border-cream/80 bg-black/30 px-7 py-4 font-display text-xl font-extrabold uppercase tracking-wide text-cream backdrop-blur transition-colors hover:bg-cream hover:text-asphalt-950">
              Play as passenger <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0"><RoadStrip /></div>
      </header>

      {/* --------------------------------------------------- two perspectives */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-abuja">Two seats, one city</p>
        <h2 className="mt-2 max-w-3xl font-display text-5xl font-extrabold uppercase leading-none sm:text-6xl">Whoever is paying, the road decides.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="group overflow-hidden rounded-3xl border border-white/10 bg-asphalt-800">
            <div className="relative h-72 overflow-hidden">
              <img src="/images/transport-3.jpg" alt="A yellow keke napep parked on an Abuja street" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-asphalt-800 to-transparent" />
              <span className="absolute bottom-3 left-5 font-display text-4xl font-extrabold uppercase">Driver</span>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-cream/90">Start with a tired sedan and a nearly empty tank. Check the car, buy fuel, take your first fare, and keep a passenger smiling while the traffic doesn&rsquo;t.</p>
              <ul className="grid gap-1.5 text-sm text-asphalt-300 sm:grid-cols-2">
                {['Accept or decline live ride requests', 'Fuel, repairs, tyres, car wash', 'Ratings shape the passengers you get', 'Unlock Maitama, Kubwa, Asokoro…', 'Buy a fleet and hire drivers'].map((t) => (<li key={t} className="flex gap-2"><span className="text-taxi">▸</span>{t}</li>))}
              </ul>
            </div>
          </article>
          <article className="group overflow-hidden rounded-3xl border border-white/10 bg-asphalt-800">
            <div className="relative h-72 overflow-hidden">
              <img src="/images/public-2.jpg" alt="A minibus and a keke on an Abuja street under palm trees" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-asphalt-800 to-transparent" />
              <span className="absolute bottom-3 left-5 font-display text-4xl font-extrabold uppercase">Passenger</span>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-cream/90">Pick where you are and where you&rsquo;re going. Compare a keke against a Camry, watch the price climb in the rain, and decide how much of the journey you can afford.</p>
              <ul className="grid gap-1.5 text-sm text-asphalt-300 sm:grid-cols-2">
                {['Compare fares, ETAs and driver ratings', 'Honest surge pricing at rush hour', 'Pay cash or from your bank', 'Rate and tip your driver', 'Survive roadblocks and floods'].map((t) => (<li key={t} className="flex gap-2"><span className="text-abuja">▸</span>{t}</li>))}
              </ul>
            </div>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------------------- the city */}
      <section className="relative isolate overflow-hidden py-24">
        <img src="/images/scenes/night-jabi.jpg" alt="Night traffic at Jabi junction with a yellow keke in the foreground" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-asphalt-950 via-asphalt-950/60 to-asphalt-950" />
        <div className="mx-auto max-w-6xl px-5">
          <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-taxi">A living city</p>
          <h2 className="mt-2 max-w-3xl font-display text-5xl font-extrabold uppercase leading-none sm:text-6xl">Morning rush. Evening rain. Night shift.</h2>
          <p className="mt-4 max-w-2xl text-lg text-cream/80">The clock never stops. Commuters flood the roads at 7 AM, the sky opens at 4 PM, and by night the streetlights come on and the risks change. A game day lasts 24 real minutes — everyone shares the same sky.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EVENTS.map((e) => (
              <div key={e.title} className="rounded-2xl border border-white/10 bg-asphalt-900/80 p-5 backdrop-blur transition-colors hover:border-taxi/60">
                <e.icon className="h-7 w-7 text-taxi" />
                <p className="mt-3 font-display text-2xl font-bold uppercase leading-tight">{e.title}</p>
                <p className="mt-1 text-sm text-asphalt-300">{e.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- the map */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-abuja">Real places, real roads</p>
            <h2 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none sm:text-6xl">Twelve districts. One capital.</h2>
            <p className="mt-4 text-lg text-cream/80">Expressways with green medians, tree-lined avenues, roundabouts, petrol stations on every corner and a lake by Jabi. Every road, junction and landmark is simulated — and every route you take is the one the server calculated.</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {DISTRICTS.map((d) => (<li key={d} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-display text-lg font-semibold uppercase tracking-wide">{d}</li>))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <figure className="col-span-2 overflow-hidden rounded-2xl border border-white/10"><img src="/images/game/map-day.jpg" alt="ALONG city map by day with a route in progress" loading="lazy" className="w-full" /></figure>
            <figure className="overflow-hidden rounded-2xl border border-white/10"><img src="/images/game/map-night.jpg" alt="ALONG city map at night with streetlights and headlights" loading="lazy" className="h-full w-full object-cover" /></figure>
            <figure className="overflow-hidden rounded-2xl border border-white/10"><img src="/images/game/map-rain.jpg" alt="ALONG city map in heavy rain" loading="lazy" className="h-full w-full object-cover" /></figure>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ vehicles */}
      <section className="bg-asphalt-900 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-taxi">The rides</p>
          <h2 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none sm:text-6xl">From okada to coaster bus.</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VEHICLES.map((v) => (
              <li key={v.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-asphalt-800">
                <div className="h-40 overflow-hidden"><img src={`/images/vehicles/${v.id}.jpg`} alt={v.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /></div>
                <div className="p-4"><p className="font-display text-2xl font-bold uppercase leading-none">{v.name}</p><p className="mt-1 text-sm text-asphalt-300">{v.line}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------- progression */}
      <section className="relative isolate overflow-hidden py-24">
        <img src="/images/scenes/sunset.jpg" alt="Sunset over a Nigerian highway lined with streetlights" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-asphalt-900 via-transparent to-asphalt-950" />
        <div className="mx-auto max-w-6xl px-5">
          <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-abuja">Career</p>
          <h2 className="mt-2 max-w-3xl font-display text-5xl font-extrabold uppercase leading-none sm:text-6xl">Earn it, one fare at a time.</h2>
          <ol className="mt-10 grid gap-3 md:grid-cols-5">
            {LEVELS.map((l, i) => (
              <li key={l} className="rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur" style={{ marginTop: `${(4 - i) * 10}px` }}>
                <p className="font-display text-sm font-bold uppercase tracking-widest text-taxi">Level {i + 1}</p>
                <p className="font-display text-2xl font-extrabold uppercase leading-tight">{l}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[{ icon: Banknote, t: 'Honest economy', d: 'Every naira is validated and recorded by the server — no client can award itself money.' }, { icon: Gauge, t: 'Reputation matters', d: 'Clean car, on-time arrivals and fair prices bring better passengers and bigger fares.' }, { icon: Truck, t: 'Run a business', d: 'Own several vehicles, hire drivers, and collect earnings while you sleep.' }].map((f) => (
              <div key={f.t} className="rounded-2xl bg-asphalt-900/80 p-5"><f.icon className="h-6 w-6 text-abuja" /><p className="mt-2 font-display text-xl font-bold uppercase">{f.t}</p><p className="text-sm text-asphalt-300">{f.d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- final */}
      <section className="mx-auto max-w-4xl px-5 py-24 text-center">
        <Moon className="mx-auto h-8 w-8 text-taxi" />
        <h2 className="mt-3 font-display text-5xl font-extrabold uppercase leading-none sm:text-7xl">The road is waiting.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-cream/80">Free to play in your browser. Your first day starts the moment you register.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={driverTo} className="rounded-xl bg-taxi px-7 py-4 font-display text-xl font-extrabold uppercase tracking-wide text-asphalt-950 shadow-[0_4px_0_#9a7300]">Play as driver</Link>
          <Link to={riderTo} className="rounded-xl border-2 border-cream/70 px-7 py-4 font-display text-xl font-extrabold uppercase tracking-wide hover:bg-cream hover:text-asphalt-950">Play as passenger</Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-sm text-asphalt-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Logo size={18} />
          <p className="flex items-center gap-2"><MapIcon className="h-4 w-4" /> A fictional city inspired by Abuja.</p>
          <Link to="/credits" className="hover:text-cream">Photo credits</Link>
        </div>
      </footer>
    </div>
  );
}
