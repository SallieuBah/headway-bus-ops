/* Headway — bus operations console.
   Vanilla JS, no build step: wraps cleanly into Capacitor / a PWA shell later.
   Screens render from one state object (S). Signed in, S is loaded from Supabase, local edits are diffed and
   written back, and realtime changes from other users are merged in. Demo mode keeps S in localStorage. */
(() => {
'use strict';

// ---------------------------------------------------------------- utilities
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pad = n => String(n).padStart(2, '0');
const fmtTime = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const fmtNum = n => Math.round(n).toLocaleString('en-US');
const uid = p => p + Math.random().toString(36).slice(2, 7).toUpperCase();
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDate = () => dayKey(new Date());
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand01 = key => rng(hashStr(key))();
// smooth value noise in [0,1]; the same key and time give the same value on every device
const noise = (key, x) => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); const a = rand01(key + ':' + i), b = rand01(key + ':' + (i + 1)); return a + (b - a) * s; };
const niceMax = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
const money = n => `${S.settings.currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyK = n => n >= 10000 ? `${S.settings.currency}${(n / 1000).toFixed(1)}k` : money(n);

const store = {
  key: 'headway.v2',
  load() { try { return JSON.parse(localStorage.getItem(this.key)); } catch (e) { return null; } },
  save(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) { /* storage unavailable: keep running in memory */ } },
  clear() { try { localStorage.removeItem(this.key); } catch (e) {} }
};

// ---------------------------------------------------------------- icons
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v3M16 18v3"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ticket: '<path d="M3 7.5V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v1.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4.5a2.5 2.5 0 0 0 0-5z"/><path d="M14 5v2M14 10v2M14 15v3"/>',
  wrench: '<path d="M15 4a5 5 0 0 0-4.6 7L3.5 17.9a1.5 1.5 0 0 0 2.6 2.6l6.9-6.9A5 5 0 0 0 20 9l-3 1-2-2 1-3z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6M20 16v-9"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M10.3 4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/><path d="M12 10v4M12 17.5v.01"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2M6 10v4M10 10v4"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10"/><path d="M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14 4-5"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 14 10"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r=".8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18z"/>'
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// ---------------------------------------------------------------- static network
// A fictional mid-size city on a harbor; coordinates are in a 1000x640 map space.
const STOPS = [
  { id: 'S1', name: 'Harbor Terminal', x: 120, y: 470, hub: true },
  { id: 'S2', name: 'Fish Market', x: 205, y: 425 },
  { id: 'S3', name: 'Old Town Square', x: 300, y: 380 },
  { id: 'S4', name: 'Central Station', x: 450, y: 330, hub: true },
  { id: 'S5', name: 'City Hall', x: 545, y: 290 },
  { id: 'S6', name: 'Museum Quarter', x: 625, y: 238 },
  { id: 'S7', name: 'University', x: 725, y: 172 },
  { id: 'S8', name: 'Science Park', x: 850, y: 118 },
  { id: 'S9', name: 'Riverside', x: 400, y: 470 },
  { id: 'S10', name: 'Stadium', x: 560, y: 515 },
  { id: 'S11', name: 'General Hospital', x: 690, y: 430 },
  { id: 'S12', name: 'Lakeside', x: 830, y: 375 },
  { id: 'S13', name: 'Hilltop', x: 330, y: 185 },
  { id: 'S14', name: 'Market Hall', x: 445, y: 215 },
  { id: 'S15', name: 'Industrial Park', x: 170, y: 255 },
  { id: 'S16', name: 'Airport', x: 925, y: 555, hub: true },
  { id: 'S17', name: 'North Depot', x: 240, y: 110 },
  { id: 'S18', name: 'Garden District', x: 645, y: 352 }
];
const STOP = Object.fromEntries(STOPS.map(s => [s.id, s]));

const ROUTE_SEED = [
  { id: '12', name: 'Harbor Terminal – Science Park', color: '#e4572e', stops: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'], headway: 8, kind: 'city', fare: 1.8 },
  { id: '27', name: 'Industrial Park – Airport', color: '#13998a', stops: ['S15', 'S3', 'S9', 'S10', 'S11', 'S16'], headway: 12, kind: 'city', fare: 2.2 },
  { id: '33', name: 'North Depot – Lakeside', color: '#3a6fd8', stops: ['S17', 'S13', 'S14', 'S4', 'S18', 'S12'], headway: 10, kind: 'city', fare: 1.8 },
  { id: '45', name: 'University – Riverside', color: '#8e5bd6', stops: ['S7', 'S6', 'S18', 'S11', 'S10', 'S9'], headway: 15, kind: 'city', fare: 1.8 },
  { id: '51', name: 'Riverside Loop', color: '#4c9a2a', stops: ['S9', 'S4', 'S5', 'S18', 'S11'], headway: 20, kind: 'city', fare: 1.5 },
  { id: 'X1', name: 'Central Station – Airport Express', color: '#b8741a', stops: ['S4', 'S5', 'S18', 'S12', 'S16'], headway: 30, kind: 'coach', fare: 9.5, seats: 44 }
];

const DRIVER_NAMES = ['Amara Okafor', 'Lucas Ferreira', 'Elif Demir', 'Jonas Becker', 'Sofia Marino', 'Kwame Mensah', 'Hana Sato', 'Mateo Ruiz', 'Ingrid Larsen', 'Omar Haddad', 'Priya Nair', 'Tomasz Nowak', 'Chloé Martin', 'Daniel Kim', 'Leila Rahimi', 'Ivan Petrov', 'Grace Mwangi', 'Arjun Mehta', 'Nora Lindqvist', 'Samuel Adeyemi', 'Yara Costa', 'Mehmet Yıldız', 'Aoife Byrne', 'Rafael Souza', 'Zeynep Kaya', 'Felix Wagner', 'Mariam Diallo', 'Ethan Brooks'];
const AV_COLORS = ['#e4572e', '#13998a', '#3a6fd8', '#8e5bd6', '#4c9a2a', '#b8741a', '#c2417a', '#2b8bb3'];

const STATUS = {
  service: { label: 'In service', cls: 'ok' },
  depot: { label: 'At depot', cls: 'info' },
  maint: { label: 'Maintenance', cls: 'warn' },
  oos: { label: 'Out of service', cls: 'crit' }
};
const DSTATUS = { duty: { label: 'On duty', cls: 'ok' }, standby: { label: 'Standby', cls: 'info' }, off: { label: 'Off', cls: '' }, leave: { label: 'On leave', cls: 'warn' } };

// ---------------------------------------------------------------- seed
function seedState() {
  const R = rng(20261024);
  const pick = a => a[Math.floor(R() * a.length)];
  const routes = ROUTE_SEED.map(r => ({ ...r, stops: [...r.stops] }));

  const drivers = DRIVER_NAMES.map((name, i) => {
    const exp = new Date(); exp.setDate(exp.getDate() + Math.floor(R() * 700) - 20 + (i === 3 ? -40 : 0));
    if (i === 5 || i === 11) exp.setTime(Date.now() + (12 + i) * 864e5);
    return {
      id: 'D' + (201 + i), name, phone: `+1 555 01${pad(i)} ${pad(10 + Math.floor(R() * 89))}`,
      status: 'off', busId: null, hoursWeek: Math.round(18 + R() * 30),
      rating: Math.round((3.9 + R() * 1.1) * 10) / 10, licenseExp: exp.toISOString().slice(0, 10),
      since: 2008 + Math.floor(R() * 16), color: AV_COLORS[i % AV_COLORS.length], km: Math.round(40000 + R() * 300000)
    };
  });

  const MODELS = [['Mercedes-Benz eCitaro', 'Electric', 88], ['MAN Lion’s City 12', 'Diesel', 95], ['Karsan e-ATAK', 'Electric', 52], ['Otokar Kent C', 'CNG', 100], ['Solaris Urbino 18', 'Diesel', 140]];
  const plan = [['12', 4], ['27', 3], ['33', 3], ['45', 3], ['51', 2], ['X1', 2]];
  const buses = [];
  let n = 101, d = 0;
  for (const [rid, count] of plan) {
    for (let k = 0; k < count; k++) {
      const m = rid === 'X1' ? ['Mercedes-Benz Tourismo', 'Diesel', 44] : pick(MODELS);
      const drv = drivers[d++];
      drv.status = 'duty'; drv.busId = 'B-' + n;
      buses.push(makeBus(n++, m, 'service', rid, drv.id, R, k / count));
    }
  }
  const restStatus = ['depot', 'depot', 'depot', 'maint', 'maint', 'maint', 'oos'];
  for (const st of restStatus) buses.push(makeBus(n++, pick(MODELS), st, null, null, R, 0));
  // a few standby / leave drivers
  drivers.slice(d).forEach((dr, i) => { dr.status = i % 4 === 0 ? 'leave' : i % 2 === 0 ? 'standby' : 'off'; });

  const S0 = {
    v: 2, routes, drivers, buses,
    alerts: [], workOrders: [], bookings: [], messages: [], tripOverrides: [], shifts: [],
    passengersToday: 0, revenueToday: 0,
    settings: { id: 1, operator: 'Meridian City Transit', currency: '€', speed: 1 }
  };

  // alerts
  const now = Date.now();
  const A = (min, severity, title, detail, busId, type) => S0.alerts.push({ id: uid('A-'), time: now - min * 60000, severity, title, detail, busId, type, status: 'open' });
  A(3, 'critical', 'Door sensor fault', 'Rear door reports open while moving. Driver notified.', 'B-106', 'fault');
  A(9, 'warning', 'Line 27 running late', 'Congestion near Stadium is adding 6–8 min.', 'B-108', 'delay');
  A(17, 'warning', 'Low battery', 'State of charge at 18%. Suggest swap at Lakeside layover.', 'B-112', 'energy');
  A(42, 'info', 'Detour active on Line 33', 'Market Hall street works until 16:00.', null, 'detour');
  A(75, 'info', 'Driver shift change completed', 'Morning relief at Central Station.', null, 'ops');
  S0.alerts[4].status = 'resolved';

  // work orders
  const WO = (bus, title, type, status, days, mech, cost) => {
    const due = new Date(); due.setDate(due.getDate() + days);
    S0.workOrders.push({ id: 'WO-' + (4810 + S0.workOrders.length), busId: bus, title, type, status, due: due.toISOString().slice(0, 10), mechanic: mech, cost });
  };
  WO('B-120', 'Brake pads and discs, front axle', 'Corrective', 'doing', 0, 'R. Haas', 640);
  WO('B-121', '60,000 km preventive service', 'Preventive', 'doing', 1, 'M. Aydın', 920);
  WO('B-122', 'HVAC compressor replacement', 'Corrective', 'doing', 2, 'R. Haas', 2150);
  WO('B-104', 'Annual roadworthiness inspection', 'Inspection', 'todo', 3, 'J. Ortiz', 180);
  WO('B-109', 'Tyre rotation and alignment', 'Tyres', 'todo', 5, 'M. Aydın', 310);
  WO('B-123', 'Gearbox diagnostic, error P0730', 'Corrective', 'todo', 1, 'J. Ortiz', 0);
  WO('B-113', 'Wheelchair ramp hydraulic check', 'Inspection', 'done', -1, 'R. Haas', 95);
  WO('B-118', 'Battery pack thermal check', 'Preventive', 'done', -2, 'J. Ortiz', 260);

  // bookings on the coach line
  const coachNames = ['A. Laurent', 'B. Okoye', 'C. Yilmaz', 'D. Novak', 'E. Rossi', 'F. Haddad', 'G. Silva', 'H. Tanaka', 'I. Kowalski', 'J. Moreau'];
  for (const dep of coachDepartures()) {
    const taken = Math.floor(R() * 30) + 6;
    const seats = new Set();
    while (seats.size < taken) seats.add(1 + Math.floor(R() * 44));
    for (const seat of seats) S0.bookings.push({ id: uid('TK-'), date: localDate(), dep, seat, name: pick(coachNames), type: R() > .8 ? 'Student' : 'Adult', fare: 9.5, issued: now - R() * 864e5 });
  }
  // a week of earlier coach sales, so reports have history to show
  const FARES = [['Adult', 1], ['Adult', 1], ['Adult', 1], ['Student', .6], ['Senior', .5], ['Child', .4]];
  for (let back = 1; back <= 6; back++) {
    const day = new Date(); day.setDate(day.getDate() - back); const date = dayKey(day); const wk = [.8, 1, 1, 1, 1.1, 1.25, .9][day.getDay()];
    for (const dep of coachDepartures()) {
      const peak = Math.exp(-((dep / 60 - 8) ** 2) / 6) + Math.exp(-((dep / 60 - 17) ** 2) / 8);
      const n = Math.min(44, Math.round((6 + 22 * peak + R() * 8) * wk));
      for (let seat = 1; seat <= n; seat++) { const [type, mult] = pick(FARES); S0.bookings.push({ id: uid('TK-'), date, dep, seat, name: pick(coachNames), type, fare: Math.round(9.5 * mult * 100) / 100, issued: day.getTime() - R() * 864e5 }); }
    }
  }

  // messages
  S0.messages.push({ id: uid('M'), to: 'D201', from: 'Dispatch', text: 'Detour on Market Hall: follow signed diversion via Hilltop.', time: now - 25 * 60000 });

  return S0;
}
function makeBus(n, [model, fuel, cap], status, routeId, driverId, R, frac) {
  const energy = Math.round(40 + R() * 58);
  return {
    energyBase: energy, holdUntil: 0,
    id: 'B-' + n, plate: `HW ${n} ${String.fromCharCode(65 + (n % 26))}${String.fromCharCode(65 + ((n * 7) % 26))}`,
    model, fuel, capacity: cap, year: 2016 + Math.floor(R() * 9), status, routeId, driverId,
    t: routeId ? clamp(frac + R() * .15, 0, 1) : 0, dir: R() > .5 ? 1 : -1, pace: .85 + R() * .3,
    speed: 0, occ: Math.round(cap * (.2 + R() * .6)), delay: Math.round(R() * 4 - 1),
    energy, odo: Math.round(60000 + R() * 420000), nextService: Math.round(400 + R() * 9000)
  };
}

// demand curve: passengers per hour across the network
function demand(h) { return h < 5 ? 0 : 260 + 1500 * Math.exp(-((h - 8) ** 2) / 2.2) + 1250 * Math.exp(-((h - 17.5) ** 2) / 3) + 520 * Math.exp(-((h - 13) ** 2) / 6); }

// service clock: real local time during service hours, otherwise a simulated day loop
function nowMin() {
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  return (m >= 330 && m < 1380) ? m : 480 + (m % 120);
}
const inSimulatedHours = () => { const d = new Date(); const m = d.getHours() * 60 + d.getMinutes(); return !(m >= 330 && m < 1380); };

// seats are sold per service day; older bookings stay in S (demo mode) but never block today's seats
const bookingsToday = () => S.bookings.filter(b => b.date === localDate());
function coachDepartures() { const out = []; for (let m = 6 * 60; m <= 22 * 60; m += 60) out.push(m); return out; }

// ---------------------------------------------------------------- state
let S = null;            // the working state every screen renders from
let MODE = 'local';      // 'local' demo in this browser, or 'cloud' signed in to the team workspace
let ME = null;           // signed-in profile: { id, email, full_name, role, driver_id }
let LIVE = false;        // realtime channel connected
const CFG = window.HEADWAY_CONFIG || null;
const sb = CFG && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;

// ---------------------------------------------------------------- roles
const ROLE_LABEL = { admin: 'Admin', dispatcher: 'Dispatcher', mechanic: 'Mechanic', driver: 'Driver', viewer: 'Viewer' };
const ROLE_HINT = {
  admin: 'Everything, including lines, fleet records, settings and team roles',
  dispatcher: 'Live operations: dispatch, schedule, alerts, drivers and ticket sales',
  mechanic: 'Workshop: work orders and vehicle status',
  driver: 'Their own shift in the driver app, and issue reports',
  viewer: 'Read-only access to operations'
};
const role = () => MODE === 'cloud' ? (ME?.role || 'viewer') : 'admin';
const PERMS = {
  'fleet.add': ['admin'], 'fleet.edit': ['admin', 'dispatcher', 'mechanic'], 'routes.edit': ['admin'],
  'drivers.add': ['admin'], 'drivers.edit': ['admin', 'dispatcher'], 'dispatch': ['admin', 'dispatcher'],
  'tickets': ['admin', 'dispatcher'], 'maint': ['admin', 'dispatcher', 'mechanic'],
  'alerts.raise': ['admin', 'dispatcher', 'mechanic', 'driver'], 'alerts.manage': ['admin', 'dispatcher'],
  'settings': ['admin'], 'team': ['admin']
};
const can = p => PERMS[p].includes(role());
function guard(p) {
  if (can(p)) return true;
  toast(`Your role (${ROLE_LABEL[role()]}) can't do this. Ask an admin for access.`, 'warn', 'shield');
  return false;
}
const HIDDEN = { admin: [], dispatcher: [], mechanic: ['tickets', 'driverapp'], viewer: ['tickets', 'driverapp'], driver: ['dashboard', 'fleet', 'routes', 'drivers', 'maintenance', 'tickets', 'reports'] };
const allowedView = k => !HIDDEN[role()].includes(k);
const homeView = () => role() === 'driver' ? 'driverapp' : 'dashboard';

// ---------------------------------------------------------------- cloud sync
// Each table maps between database rows and the in-app objects. Local edits are found by diffing
// against the last known server snapshot, so screens keep mutating S directly and call save().
const isoT = t => new Date(t).toISOString();
const TABLES = {
  routes: {
    coll: () => S.routes,
    to: r => ({ id: r.id, name: r.name, color: r.color, stops: r.stops, headway: +r.headway, kind: r.kind, fare: +r.fare, seats: r.seats ?? null }),
    from: x => ({ id: x.id, name: x.name, color: x.color, stops: x.stops, headway: x.headway, kind: x.kind, fare: +x.fare, seats: x.seats })
  },
  drivers: {
    coll: () => S.drivers,
    to: d => ({ id: d.id, name: d.name, phone: d.phone || null, status: d.status, bus_id: d.busId || null, hours_week: +d.hoursWeek || 0, rating: +d.rating, license_exp: d.licenseExp || null, since: d.since || null, color: d.color || null, km: Math.round(d.km || 0) }),
    from: x => ({ id: x.id, name: x.name, phone: x.phone || '', status: x.status, busId: x.bus_id, hoursWeek: x.hours_week, rating: +x.rating, licenseExp: x.license_exp, since: x.since, color: x.color || AV_COLORS[0], km: x.km })
  },
  buses: {
    coll: () => S.buses,
    to: b => ({ id: b.id, plate: b.plate, model: b.model, fuel: b.fuel, capacity: +b.capacity, year: b.year || null, status: b.status, route_id: b.routeId || null, driver_id: b.driverId || null, energy: Math.round(b.energyBase * 10) / 10, odo: Math.round(b.odo), next_service: Math.round(b.nextService), pace: Math.round(b.pace * 1000) / 1000 }),
    from: x => ({ id: x.id, plate: x.plate, model: x.model, fuel: x.fuel, capacity: x.capacity, year: x.year, status: x.status, routeId: x.route_id, driverId: x.driver_id, energyBase: +x.energy, odo: x.odo, nextService: x.next_service, pace: +x.pace })
  },
  alerts: {
    coll: () => S.alerts,
    to: a => ({ id: a.id, time: isoT(a.time), severity: a.severity, title: a.title, detail: a.detail || null, bus_id: a.busId || null, type: a.type || null, status: a.status }),
    from: x => ({ id: x.id, time: Date.parse(x.time), severity: x.severity, title: x.title, detail: x.detail || '', busId: x.bus_id, type: x.type, status: x.status }),
    ignoreDup: true // scripted incidents get the same id on every device; the first insert wins
  },
  work_orders: {
    coll: () => S.workOrders,
    to: w => ({ id: w.id, bus_id: w.busId, title: w.title, type: w.type, status: w.status, due: w.due || null, mechanic: w.mechanic || null, cost: +w.cost || 0 }),
    from: x => ({ id: x.id, busId: x.bus_id, title: x.title, type: x.type, status: x.status, due: x.due, mechanic: x.mechanic || '', cost: +x.cost })
  },
  bookings: {
    coll: () => S.bookings,
    to: b => ({ id: b.id, dep_date: b.date || localDate(), dep: b.dep, seat: b.seat, name: b.name, type: b.type, fare: +b.fare, issued: isoT(b.issued) }),
    from: x => ({ id: x.id, date: x.dep_date, dep: x.dep, seat: x.seat, name: x.name, type: x.type, fare: +x.fare, issued: Date.parse(x.issued) }),
    rowFilter: x => x.dep_date === localDate()
  },
  messages: {
    coll: () => S.messages,
    to: m => ({ id: m.id, to_driver: m.to, sender: m.from, text: m.text, time: isoT(m.time) }),
    from: x => ({ id: x.id, to: x.to_driver, from: x.sender, text: x.text, time: Date.parse(x.time) })
  },
  trip_overrides: {
    coll: () => S.tripOverrides, conflict: 'trip_date,trip_id',
    to: o => ({ trip_date: localDate(), trip_id: o.id, driver_id: o.driverId || null, cancelled: !!o.cancelled }),
    from: x => ({ id: x.trip_id, driverId: x.driver_id, cancelled: x.cancelled }),
    keyRow: x => x.trip_id, match: k => ({ trip_date: localDate(), trip_id: k }), rowFilter: x => x.trip_date === localDate()
  },
  driver_shifts: {
    coll: () => S.shifts,
    to: s => ({ shift_date: localDate(), driver_id: s.id, checklist: s.checklist || {}, on_trip: s.onTrip !== false }),
    from: x => ({ id: x.driver_id, checklist: x.checklist || {}, onTrip: x.on_trip }),
    keyRow: x => x.driver_id, match: k => ({ shift_date: localDate(), driver_id: k }), rowFilter: x => x.shift_date === localDate()
  },
  settings: {
    coll: () => [S.settings],
    to: s => ({ id: 1, operator: s.operator, currency: s.currency, speed: +s.speed || 1 }),
    from: x => ({ id: 1, operator: x.operator, currency: x.currency, speed: +x.speed })
  }
};
const keyRowOf = (def, x) => def.keyRow ? def.keyRow(x) : x.id;
const matchOf = (def, k) => def.match ? def.match(k) : { id: k };
const busLive = b => Object.assign(b, { t: b.t ?? 0, dir: b.dir ?? 1, speed: 0, occ: b.occ ?? 0, delay: b.delay ?? 0, energy: b.energy ?? b.energyBase, holdUntil: b.holdUntil || 0 });

let snap = {};
function snapshotAll() { snap = {}; for (const [t, def] of Object.entries(TABLES)) snap[t] = new Map(def.coll().map(o => [o.id, JSON.stringify(def.to(o))])); }

async function loadCloud() {
  const d = localDate();
  const q = t => sb.from(t).select('*');
  const res = await Promise.all([
    q('routes').order('id'), q('drivers').order('id'), q('buses').order('id'),
    q('alerts').order('time', { ascending: false }).limit(200), q('work_orders').order('id'),
    q('bookings').eq('dep_date', d), q('messages').order('time', { ascending: false }).limit(100),
    q('trip_overrides').eq('trip_date', d), q('driver_shifts').eq('shift_date', d), q('settings').eq('id', 1)
  ]);
  const bad = res.find(r => r.error); if (bad) throw bad.error;
  const [routes, drivers, buses, alerts, wos, bookings, messages, ovr, shifts, settings] = res.map(r => r.data);
  const T = TABLES;
  S = {
    v: 2, routes: routes.map(T.routes.from), drivers: drivers.map(T.drivers.from), buses: buses.map(x => busLive(T.buses.from(x))),
    alerts: alerts.map(T.alerts.from), workOrders: wos.map(T.work_orders.from), bookings: bookings.map(T.bookings.from),
    messages: messages.map(T.messages.from), tripOverrides: ovr.map(T.trip_overrides.from), shifts: shifts.map(T.driver_shifts.from),
    settings: settings[0] ? T.settings.from(settings[0]) : { id: 1, operator: 'Transit operator', currency: '€', speed: 1 },
    passengersToday: 0, revenueToday: 0
  };
  TRIPS = buildTrips(); snapshotAll(); simulate();
}

let syncing = false, syncAgain = false, syncTimer = null;
function save() {
  if (!S) return;
  if (MODE === 'cloud') { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 250); }
  else store.save(S);
}
async function sync() {
  if (MODE !== 'cloud' || !S) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    for (const [t, def] of Object.entries(TABLES)) {
      const prev = snap[t] || new Map(); const cur = new Map();
      for (const o of def.coll()) cur.set(o.id, def.to(o));
      const added = [], changed = [], removed = [];
      for (const [k, row] of cur) { const j = JSON.stringify(row); if (!prev.has(k)) added.push(row); else if (prev.get(k) !== j) changed.push([k, row]); }
      for (const k of prev.keys()) if (!cur.has(k)) removed.push(k);
      if (!added.length && !changed.length && !removed.length) continue;
      snap[t] = new Map([...cur].map(([k, r]) => [k, JSON.stringify(r)]));
      if (added.length) {
        const { error } = def.ignoreDup ? await sb.from(t).upsert(added, { onConflict: def.conflict || 'id', ignoreDuplicates: true }) : await sb.from(t).insert(added);
        if (error) throw Object.assign(error, { table: t });
      }
      for (const [k, row] of changed) { const { error } = await sb.from(t).update(row).match(matchOf(def, k)); if (error) throw Object.assign(error, { table: t }); }
      for (const k of removed) { const { error } = await sb.from(t).delete().match(matchOf(def, k)); if (error) throw Object.assign(error, { table: t }); }
    }
  } catch (e) {
    console.error('sync failed', e);
    const msg = e.code === '23505' && e.table === 'bookings' ? 'That seat was just sold on another screen. Pick another seat.'
      : e.code === '42501' || /row-level security/i.test(e.message || '') ? `Your role (${ROLE_LABEL[role()]}) can't make that change, so it was undone.`
      : `Couldn't save your change: ${e.message || 'network error'}. Showing the latest saved data.`;
    toast(msg, 'crit', 'alert');
    try { await loadCloud(); } catch (_) {}
    rerender(true);
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; sync(); }
  }
}

let channel = null;
function subscribeCloud() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('headway-live');
  for (const t of Object.keys(TABLES)) channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => applyRemote(t, p));
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onProfileChange);
  channel.subscribe(status => { LIVE = status === 'SUBSCRIBED'; updateChrome(); });
}
function applyRemote(t, p) {
  if (!S) return;
  const def = TABLES[t]; const del = p.eventType === 'DELETE'; const row = del ? p.old : p.new;
  if (!del && def.rowFilter && !def.rowFilter(row)) return;
  const k = keyRowOf(def, row); const list = def.coll(); const i = list.findIndex(o => o.id === k);
  if (del) {
    if (i < 0) return;
    if (t !== 'settings') list.splice(i, 1);
    snap[t].delete(k);
  } else {
    const obj = def.from(row);
    if (i >= 0) Object.assign(list[i], obj);
    else if (t === 'alerts') {
      list.unshift(obj); list.sort((a, b) => b.time - a.time);
      if (Date.now() - obj.time < 180000) toast(`${obj.title}${obj.busId ? ' · ' + obj.busId : ''}`, obj.severity === 'critical' ? 'crit' : obj.severity === 'warning' ? 'warn' : 'info', 'alert');
    } else list.push(t === 'buses' ? busLive(obj) : obj);
    snap[t].set(k, JSON.stringify(def.to(i >= 0 ? list[i] : obj)));
  }
  if (['buses', 'routes', 'drivers', 'trip_overrides'].includes(t)) TRIPS = buildTrips();
  simulate(); rerender();
}
async function onProfileChange(p) {
  if (!ME || !p.new) return;
  if (p.new.id === ME.id) {
    const changed = p.new.role !== ME.role || p.new.driver_id !== ME.driver_id;
    ME = { ...ME, ...p.new };
    if (changed) {
      toast(`Your access changed: you are now ${ROLE_LABEL[ME.role]}.`, 'info', 'shield');
      try { await loadCloud(); } catch (_) {}
      shell(); route();
    }
  } else if (current === VIEWS.preferences) VIEWS.preferences.team();
}
// re-render the open screen after remote changes, without disturbing someone mid-edit
let rrTimer = null;
function rerender(now) {
  clearTimeout(rrTimer);
  rrTimer = setTimeout(() => {
    if (!current || !S) return;
    updateChrome();
    if (!now && ($('#overlay').children.length || document.activeElement?.matches?.('input, textarea, select'))) return;
    if (current === VIEWS.map) { current.list(); current.drawer(); return; }
    const y = window.scrollY; route(true); window.scrollTo(0, y);
  }, now ? 0 : 400);
}

const bus = id => S.buses.find(b => b.id === id);
const driver = id => S.drivers.find(d => d.id === id);
const routeOf = id => S.routes.find(r => r.id === id);
const openAlerts = () => S.alerts.filter(a => a.status !== 'resolved');

// geometry per route (cached on stop list)
const geomCache = {};
function geom(r) {
  const key = r.id + ':' + r.stops.join(',');
  if (geomCache[key]) return geomCache[key];
  const i = S.routes.indexOf(r);
  const off = (i - 2.5) * 2.4;
  const pts = r.stops.map(id => ({ x: STOP[id].x + off, y: STOP[id].y + off }));
  const segs = []; let total = 0;
  for (let k = 0; k < pts.length - 1; k++) { const L = Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y); segs.push({ a: pts[k], b: pts[k + 1], L, s: total }); total += L; }
  const stopT = [0]; segs.forEach(sg => stopT.push((sg.s + sg.L) / total));
  return (geomCache[key] = { pts, segs, total, stopT, minutes: Math.max(18, Math.round(total / 13)) });
}
function pointAt(g, t) {
  const d = clamp(t, 0, 1) * g.total;
  const sg = g.segs.find(s => d <= s.s + s.L) || g.segs[g.segs.length - 1];
  const f = sg.L ? (d - sg.s) / sg.L : 0;
  return { x: sg.a.x + (sg.b.x - sg.a.x) * f, y: sg.a.y + (sg.b.y - sg.a.y) * f };
}
function nextStops(b, count = 4) {
  const r = routeOf(b.routeId); if (!r) return [];
  const g = geom(r); const out = [];
  const idx = g.stopT.map((t, i) => ({ t, i }));
  const ahead = b.dir > 0 ? idx.filter(s => s.t > b.t + .002) : idx.filter(s => s.t < b.t - .002).reverse();
  for (const s of ahead.slice(0, count)) {
    const eta = Math.abs(s.t - b.t) * g.minutes + Math.max(0, b.delay) * .3;
    out.push({ stop: STOP[r.stops[s.i]], eta: Math.max(1, Math.round(eta)) });
  }
  return out;
}
function terminusOf(b) { const r = routeOf(b.routeId); if (!r) return '—'; return STOP[b.dir > 0 ? r.stops[r.stops.length - 1] : r.stops[0]].name; }

// ---------------------------------------------------------------- trips (today's timetable)
function buildTrips() {
  const trips = [];
  const servicing = S.buses.filter(b => b.routeId);
  servicing.forEach((b, i) => {
    const r = routeOf(b.routeId); if (!r) return;
    const g = geom(r); const dur = g.minutes; const lay = r.kind === 'coach' ? 25 : 8;
    let t = 330 + ((i * r.headway) % 60); let dir = 1; let n = 1;
    const relief = S.drivers.filter(d => d.status === 'standby' || d.status === 'off')[i % 8];
    while (t + dur < 1395) {
      const drv = t < 840 ? b.driverId : (relief ? relief.id : b.driverId);
      const id = `${b.id}-${n}`;
      trips.push({ id, busId: b.id, routeId: r.id, driverId: ovr(id)?.driverId || drv, start: t, end: t + dur, dir, n });
      t += dur + lay; dir *= -1; n++;
    }
  });
  return trips;
}
let TRIPS = [];
// dispatcher changes to today's timetable: driver swaps and cancellations
const ovr = id => S.tripOverrides.find(o => o.id === id);
const isCancelled = id => !!ovr(id)?.cancelled;
function setOvr(id, patch) { let o = ovr(id); if (!o) { o = { id, driverId: null, cancelled: false }; S.tripOverrides.push(o); } Object.assign(o, patch); }
const shiftOf = id => S.shifts.find(s => s.id === id);
function setShift(id, patch) { let s = shiftOf(id); if (!s) { s = { id, checklist: {}, onTrip: true }; S.shifts.push(s); } Object.assign(s, patch); }
function tripState(tr, m = nowMin()) {
  if (isCancelled(tr.id)) return 'cancelled';
  if (tr.end < m) return 'done';
  if (tr.start <= m) return 'running';
  return 'planned';
}

// ---------------------------------------------------------------- simulation
// Movement is a pure function of the clock, so every signed-in screen shows each bus in the same place
// without a server pushing positions. Replace this block with your AVL/GPS feed to go live.
const ALERT_TYPES = [
  b => b.delay >= 5 && { severity: 'warning', title: `Line ${b.routeId} running late`, detail: `${b.id} is ${b.delay} min behind schedule near ${nextStops(b, 1)[0]?.stop.name || 'terminus'}.`, type: 'delay' },
  b => b.occ / b.capacity > .8 && { severity: 'warning', title: 'Crowding reported', detail: `${b.id} at ${Math.round(b.occ / b.capacity * 100)}% load. Consider a short-turn extra.`, type: 'crowd' },
  b => ({ severity: 'critical', title: 'Engine warning light', detail: `${b.id} reports coolant temperature high. Driver asked to pull over safely.`, type: 'fault' }),
  b => ({ severity: 'info', title: 'Passenger assistance request', detail: `Wheelchair ramp requested on ${b.id} at ${nextStops(b, 1)[0]?.stop.name || 'next stop'}.`, type: 'ops' }),
  b => ({ severity: 'warning', title: 'Harsh braking event', detail: `Telematics logged 0.48 g deceleration on ${b.id}.`, type: 'safety' })
];
function raiseAlert(a) {
  if (a.id && S.alerts.some(x => x.id === a.id)) return;
  if (MODE === 'cloud' && !can('alerts.raise')) return;
  const al = { status: 'open', ...a, id: a.id || uid('A-'), time: a.time || Date.now() };
  S.alerts.unshift(al);
  if (MODE === 'local' && S.alerts.length > 120) S.alerts.length = 120;
  toast(`${a.title}${a.busId ? ' · ' + a.busId : ''}`, a.severity === 'critical' ? 'crit' : a.severity === 'warning' ? 'warn' : 'info', 'alert');
  updateChrome(); save();
}
// minutes behind schedule at a given epoch second; drives the live map and the on-time report
const delayAt = (id, sec) => Math.round(-1.5 + 12 * noise(id + 'd', sec / 300) ** 2);
function paxSoFar(m = nowMin()) { let p = 0; for (let x = 330; x < m; x += 5) p += demand(x / 60) * Math.min(5, m - x) / 60; return Math.round(p); }
function simulate() {
  if (!S) return;
  const now = Date.now() / 1000; const sp = +S.settings.speed || 1; const hour = nowMin() / 60;
  for (const b of S.buses) {
    if (b.status !== 'service' || !b.routeId) { b.speed = 0; continue; }
    const r = routeOf(b.routeId); if (!r) continue;
    const g = geom(r);
    const x = now * sp * b.pace / 360 + rand01(b.id) * 2;
    const m = x % 2; b.t = m < 1 ? m : 2 - m; b.dir = m < 1 ? 1 : -1;
    const nearStop = g.stopT.some(t => Math.abs(t - b.t) < .006);
    b.speed = nearStop ? 0 : Math.round(16 + 38 * noise(b.id + 's', now / 25));
    b.delay = delayAt(b.id, now) + (b.holdUntil > Date.now() ? 2 : 0);
    b.occ = Math.round(b.capacity * clamp(.1 + .8 * noise(b.id + 'o', now / 120) * (.35 + demand(hour) / 1700), .03, 1.02));
    b.energy = clamp(b.energyBase - Math.max(0, hour - 5.5) * (b.fuel === 'Electric' ? 3.4 : 2.4), 4, 100);
    if (b.energy < 15) raiseAlert({ id: `low-${b.id}-${localDate()}`, severity: 'warning', title: b.fuel === 'Electric' ? 'Low battery' : 'Low fuel', detail: `${b.id} at ${Math.round(b.energy)}%. Plan a swap at the next layover.`, busId: b.id, type: 'energy' });
  }
  S.passengersToday = paxSoFar();
  S.revenueToday = S.passengersToday * 1.74 + bookingsToday().reduce((a, bk) => a + (+bk.fare || 0), 0);
  // scripted incidents: one decision per 150-second window, identical on every device and stored once
  const win = Math.floor(Date.now() / 150000); const key = `sim-${win}`;
  if (rand01(key) < .4) {
    const active = S.buses.filter(b => b.status === 'service').sort((a, b) => a.id < b.id ? -1 : 1);
    const b = active[Math.floor(rand01(key + 'b') * active.length)];
    const gen = b && ALERT_TYPES[Math.floor(rand01(key + 't') * ALERT_TYPES.length)](b);
    if (gen) raiseAlert({ ...gen, id: key, busId: b.id, time: win * 150000 });
  }
}

// ---------------------------------------------------------------- charts (hand-drawn SVG, to scale)
function areaChart({ series, labels, w = 640, h = 220, fmt = fmtNum, xEvery = 2, yTicks = 4 }) {
  const P = { l: 44, r: 10, t: 12, b: 26 };
  const all = series.flatMap(s => s.values.filter(v => v != null));
  const max = niceMax(Math.max(...all, 1));
  const n = labels.length; const iw = w - P.l - P.r; const ih = h - P.t - P.b;
  const X = i => P.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const Y = v => P.t + ih - v / max * ih;
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  for (let k = 0; k <= yTicks; k++) { const v = max * k / yTicks; out += `<line class="grid" x1="${P.l}" x2="${w - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  labels.forEach((l, i) => { if (i % xEvery === 0) out += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle">${esc(l)}</text>`; });
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
    if (!pts.length) return;
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    if (s.fill) out += `<path d="${line} L${pts[pts.length - 1][0]} ${Y(0)} L${pts[0][0]} ${Y(0)}Z" fill="${s.color}" fill-opacity=".14"/>`;
    out += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="${s.dashed ? 1.6 : 2.4}" ${s.dashed ? 'stroke-dasharray="4 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    if (s.endpoint) { const p = pts[pts.length - 1]; out += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`; }
  });
  return out + '</svg>';
}
function barChart({ items, w = 640, h = 220, fmt = fmtNum, color = 'var(--info)', every = 1 }) {
  const P = { l: 44, r: 10, t: 18, b: 26 };
  const max = niceMax(Math.max(...items.map(i => i.value), 1));
  const iw = w - P.l - P.r; const ih = h - P.t - P.b; const bw = iw / items.length;
  const Y = v => P.t + ih - v / max * ih;
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  for (let k = 0; k <= 4; k++) { const v = max * k / 4; out += `<line class="grid" x1="${P.l}" x2="${w - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  items.forEach((it, i) => {
    const x = P.l + i * bw + bw * .18; const bwi = bw * .64;
    out += `<rect x="${x}" y="${Y(it.value)}" width="${bwi}" height="${Y(0) - Y(it.value)}" rx="4" fill="${it.color || color}" ${it.dim ? 'fill-opacity=".45"' : ''}/>`;
    if ((items.length - 1 - i) % every === 0) out += `<text x="${x + bwi / 2}" y="${h - 6}" text-anchor="middle">${esc(it.label)}</text>`;
    if (it.showVal) out += `<text class="val" x="${x + bwi / 2}" y="${Y(it.value) - 5}" text-anchor="middle">${fmt(it.value)}</text>`;
  });
  return out + '</svg>';
}
function hbarChart({ items, w = 640, fmt = fmtNum, max }) {
  const rowH = 34; const h = items.length * rowH + 6; const L = 120; const R = 70;
  const mx = max || niceMax(Math.max(...items.map(i => i.value), 1));
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  items.forEach((it, i) => {
    const y = i * rowH + 6; const bw = (w - L - R) * it.value / mx;
    out += `<text x="0" y="${y + 17}" style="fill:var(--fg);font-weight:600">${esc(it.label)}</text>`;
    out += `<rect x="${L}" y="${y + 4}" width="${w - L - R}" height="18" rx="5" fill="var(--surface-2)"/>`;
    out += `<rect x="${L}" y="${y + 4}" width="${Math.max(2, bw)}" height="18" rx="5" fill="${it.color}"/>`;
    out += `<text class="val" x="${w - R + 8}" y="${y + 17}">${fmt(it.value)}</text>`;
  });
  return out + '</svg>';
}
function donut(items, size = 150, centerTop = '', centerSub = '') {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const r = size / 2 - 12; const c = 2 * Math.PI * r; let acc = 0;
  let out = `<svg class="chart" viewBox="0 0 ${size} ${size}" style="width:${size}px;flex:none" role="img"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="18"/>`;
  items.forEach(it => {
    const len = it.value / total * c;
    if (len > 0) out += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${it.color}" stroke-width="18" stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    acc += len;
  });
  out += `<text x="50%" y="48%" text-anchor="middle" style="fill:var(--fg);font-family:var(--font-display);font-size:30px;font-weight:700">${centerTop}</text><text x="50%" y="63%" text-anchor="middle">${centerSub}</text>`;
  return out + '</svg>';
}
function spark(values, color) {
  const w = 120, h = 30; const max = Math.max(...values), min = Math.min(...values);
  const X = i => i * w / (values.length - 1); const Y = v => h - 3 - (v - min) / ((max - min) || 1) * (h - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d} L${w} ${h} L0 ${h}Z" fill="${color}" fill-opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}

// ---------------------------------------------------------------- network map
function mapSVG(id, { labels = true, filter = null } = {}) {
  let s = `<svg class="netmap" id="${id}" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid ${labels ? 'meet' : 'slice'}" role="img" aria-label="Network map with live bus positions">
    <defs><pattern id="${id}-g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" class="map-grid"/></pattern></defs>
    <rect x="-1000" y="-1000" width="3000" height="2640" class="map-land"/><rect x="-1000" y="-1000" width="3000" height="2640" fill="url(#${id}-g)"/>
    <path class="map-water" d="M-400 520 C40 500 90 560 200 548 S330 600 420 640 L-400 900Z"/>
    <path class="map-river" d="M360 -80 C350 90 420 180 480 260 S560 400 640 405 S800 440 1400 470"/>
    <path class="map-park" d="M280 150 q40 -40 90 -10 q30 30 -5 60 q-45 25 -85 -50z"/>
    <path class="map-park" d="M770 300 q50 -30 100 10 q20 40 -30 60 q-60 10 -70 -70z"/>
    <path class="map-park" d="M520 470 q40 -14 80 6 q10 34 -40 44 q-48 -6 -40 -50z"/>
    <text class="district" x="160" y="520">Harbor</text><text class="district" x="250" y="335">Old Town</text>
    <text class="district" x="700" y="110">Campus</text><text class="district" x="80" y="215">Industrial</text>
    <text class="district" x="760" y="610">Airport</text><text class="district" x="600" y="200">Museum Qtr</text>`;
  for (const r of S.routes) {
    const g = geom(r); const d = g.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    const dim = filter && !filter.has(r.id) ? ' dim' : '';
    s += `<path class="casing${dim}" d="${d}"/><path class="rline${r.kind === 'coach' ? ' dashed' : ''}${dim}" data-route="${r.id}" d="${d}" stroke="${r.color}"/>`;
  }
  for (const st of STOPS) {
    s += `<circle class="stop${st.hub ? ' hub' : ''}" cx="${st.x}" cy="${st.y}" r="${st.hub ? 7 : 5}"/>`;
    if (labels) s += `<text class="stop-label" x="${st.x + 10}" y="${st.y - 9}">${esc(st.name)}</text>`;
  }
  s += `<g class="buses">`;
  for (const b of S.buses.filter(b => b.status === 'service' && b.routeId)) {
    const r = routeOf(b.routeId); if (!r) continue;
    const p = pointAt(geom(r), b.t);
    const dim = filter && !filter.has(r.id) ? ' style="opacity:.15"' : '';
    s += `<g class="bus-m" data-bus="${b.id}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"${dim}><circle class="halo" r="12"/><circle class="ring" r="15"/><circle class="b" r="11.5" fill="${r.color}"/><text>${esc(r.id)}</text></g>`;
  }
  return s + '</g></svg>';
}
function updateMapBuses(svg, selected) {
  if (!svg) return;
  $$('.bus-m', svg).forEach(g => {
    const b = bus(g.dataset.bus); if (!b || !b.routeId) return;
    const r = routeOf(b.routeId); const p = pointAt(geom(r), b.t);
    g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    g.classList.toggle('late', b.delay >= 5);
    g.classList.toggle('sel', b.id === selected);
    g.style.display = b.status === 'service' ? '' : 'none';
  });
}
function panZoom(svg) {
  let vb = { x: 0, y: 0, w: 1000, h: 640 };
  const apply = () => svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
  const toSvg = (cx, cy) => { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const zoomAt = (k, p) => { const nw = clamp(vb.w * k, 180, 1400); const kk = nw / vb.w; vb.x = p.x - (p.x - vb.x) * kk; vb.y = p.y - (p.y - vb.y) * kk; vb.w = nw; vb.h = nw * .64; apply(); };
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, toSvg(e.clientX, e.clientY)); }, { passive: false });
  let drag = null; const pointers = new Map();
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vb: { ...vb }, moved: false };
    // capturing on a bus marker would retarget the click to the svg and lose the selection
    if (!e.target.closest('.bus-m')) svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { // pinch
      const [a, b] = [...pointers.values()];
      const oa = e.pointerId === [...pointers.keys()][0] ? prev : a; const ob = e.pointerId === [...pointers.keys()][1] ? prev : b;
      const d0 = Math.hypot(oa.x - ob.x, oa.y - ob.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 && d1) zoomAt(d0 / d1, toSvg((a.x + b.x) / 2, (a.y + b.y) / 2));
      if (drag) drag.moved = true; return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const scale = vb.w / svg.getBoundingClientRect().width;
    vb.x = drag.vb.x - dx * scale; vb.y = drag.vb.y - dy * scale; apply();
  });
  const end = e => { pointers.delete(e.pointerId); if (!pointers.size) setTimeout(() => { drag = null; }, 0); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  return {
    wasDrag: () => drag && drag.moved,
    zoom: k => zoomAt(k, { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }),
    reset: () => { vb = { x: 0, y: 0, w: 1000, h: 640 }; apply(); },
    focus: (x, y) => { vb.w = 460; vb.h = 460 * .64; vb.x = x - vb.w / 2; vb.y = y - vb.h / 2; apply(); }
  };
}

// ---------------------------------------------------------------- overlay: toasts, modals, sheets
function toast(msg, kind = 'ok', ic = 'check') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`; t.setAttribute('role', 'status');
  t.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3800);
}
function closeOverlay() { $('#overlay').innerHTML = ''; document.removeEventListener('keydown', escClose); }
function escClose(e) { if (e.key === 'Escape') closeOverlay(); }
function openModal({ title, body, actions = [], wide = false, onMount }) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="m-title">
    <header><h3 id="m-title">${title}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
    <div class="m-body">${body}</div>
    ${actions.length ? `<footer>${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-act="${i}">${a.icon ? icon(a.icon) : ''}${a.label}</button>`).join('')}</footer>` : ''}
  </div></div>`;
  const m = $('.modal', ov);
  $('.backdrop', ov).addEventListener('click', e => { if (e.target.classList.contains('backdrop')) closeOverlay(); });
  $('[data-close]', ov).onclick = closeOverlay;
  $$('[data-act]', ov).forEach(btn => btn.onclick = () => { const r = actions[+btn.dataset.act].onClick?.(m); if (r !== false) closeOverlay(); });
  document.addEventListener('keydown', escClose);
  onMount?.(m);
  setTimeout(() => $('input, select, textarea', m)?.focus(), 30);
  return m;
}
function field({ id, label, type = 'text', value = '', options, full, hint, min, max, step, placeholder }) {
  let ctl;
  if (type === 'select') ctl = `<select class="input" id="f-${id}" data-f="${id}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (type === 'textarea') ctl = `<textarea class="input" id="f-${id}" data-f="${id}" rows="3" placeholder="${esc(placeholder || '')}">${esc(value)}</textarea>`;
  else ctl = `<input class="input" id="f-${id}" data-f="${id}" type="${type}" value="${esc(value)}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} ${step != null ? `step="${step}"` : ''} placeholder="${esc(placeholder || '')}">`;
  return `<div class="fld ${full ? 'full' : ''}"><label for="f-${id}">${label}</label>${ctl}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
}
const readForm = el => Object.fromEntries($$('[data-f]', el).map(i => [i.dataset.f, i.value.trim()]));
function requireFields(el, keys) {
  for (const k of keys) { const i = $(`[data-f="${k}"]`, el); if (!i.value.trim()) { i.focus(); i.style.borderColor = 'var(--crit)'; toast(`Fill in ${i.closest('.fld').querySelector('label').textContent.toLowerCase()} to continue.`, 'warn', 'alert'); return false; } }
  return true;
}

// ---------------------------------------------------------------- shared fragments
const bullet = (rid, lg) => { const r = routeOf(rid); return r ? `<span class="line-bullet ${lg ? 'lg' : ''}" style="background:${r.color}">${esc(r.id)}</span>` : '<span class="muted">—</span>'; };
const statusChip = st => `<span class="chip ${STATUS[st].cls}">${STATUS[st].label}</span>`;
const dChip = st => `<span class="chip ${DSTATUS[st].cls}">${DSTATUS[st].label}</span>`;
const initials = n => n.split(' ').map(p => p[0]).slice(0, 2).join('');
const avatar = (d, lg) => `<span class="avatar ${lg ? 'lg' : ''}" style="background:${d.color}">${esc(initials(d.name))}</span>`;
const pctCls = p => p < 20 ? 'crit' : p < 40 ? 'warn' : '';
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`; };
const delayTxt = d => d <= -1 ? `<span style="color:var(--info)">${-d} min early</span>` : d <= 2 ? `<span style="color:var(--ok)">On time</span>` : d <= 5 ? `<span style="color:var(--warn)">+${d} min</span>` : `<span style="color:var(--crit)">+${d} min</span>`;
const daysTo = iso => Math.round((new Date(iso) - new Date(new Date().toISOString().slice(0, 10))) / 864e5);

function kpiData() {
  const active = S.buses.filter(b => b.status === 'service');
  const onTime = active.filter(b => b.delay <= 3).length;
  const loads = active.map(b => b.occ / b.capacity);
  return {
    active: active.length, fleet: S.buses.length,
    otp: active.length ? Math.round(onTime / active.length * 100) : 100,
    pax: Math.round(S.passengersToday), rev: S.revenueToday,
    alerts: openAlerts().length, crit: openAlerts().filter(a => a.severity === 'critical').length,
    load: loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length * 100) : 0
  };
}

// ---------------------------------------------------------------- views
const VIEWS = {};

// ---- Dashboard
VIEWS.dashboard = {
  title: 'Operations overview', crumb: 'Today',
  render(el) {
    const m = nowMin(); const hr = m < 720 ? 'Good morning' : m < 1080 ? 'Good afternoon' : 'Good evening';
    const k = kpiData();
    el.innerHTML = `
      <div class="hello">
        <div><h2>${hr}, Dispatch</h2><p>${esc(S.settings.operator)} · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · <span id="d-run">${k.active} buses on the road</span></p></div>
        <div class="spacer"></div>
        <div class="toolbar">
          ${can('tickets') ? `<button class="btn" data-go="tickets">${icon('ticket')}Sell coach seat</button>` : ''}
          ${can('alerts.raise') ? `<button class="btn" id="d-incident">${icon('alert')}Log incident</button>` : ''}
          <button class="btn primary" data-go="map">${icon('map')}Open live map</button>
        </div>
      </div>
      <div class="kpis" id="d-kpis"></div>
      <div class="dash-grid">
        <div class="card span-2"><div class="card-h"><h3>Live network</h3><span class="sub">${S.routes.length} lines · ${STOPS.length} stops</span><span class="spacer"></span><span class="chip ok">Live</span></div>
          <div class="map-mini" data-go="map" title="Open the live map">${mapSVG('mini', { labels: false })}</div>
        </div>
        <div class="card board"><div class="card-h"><h3>Next departures</h3><span class="sub" id="d-clock"></span></div><div id="d-board"></div></div>
        <div class="card span-2"><div class="card-h"><h3>Ridership today</h3><span class="sub">boardings per hour across all lines</span><span class="spacer"></span>
          <div class="legend"><span><i style="background:var(--accent)"></i>Today</span><span><i style="background:var(--muted)"></i>Same day last week</span></div></div><div id="d-rides"></div></div>
        <div class="card"><div class="card-h"><h3>Fleet status</h3><span class="spacer"></span><button class="btn sm ghost" data-go="fleet">View fleet ${icon('arrowR')}</button></div><div id="d-fleet"></div></div>
        <div class="card"><div class="card-h"><h3>Line performance</h3><span class="sub">on-time · load</span></div><div id="d-perf"></div></div>
        <div class="card"><div class="card-h"><h3>Open alerts</h3><span class="spacer"></span><button class="btn sm ghost" data-go="alerts">All alerts ${icon('arrowR')}</button></div><div class="feed" id="d-feed"></div></div>
        <div class="card"><div class="card-h"><h3>Needs attention</h3></div><div class="feed" id="d-attn"></div></div>
      </div>`;
    if ($('#d-incident')) $('#d-incident').onclick = () => incidentModal();
    this.tick(true);
  },
  tick(full) {
    const k = kpiData(); const m = nowMin(); const h = m / 60;
    const paxSeries = Array.from({ length: 12 }, (_, i) => demand(Math.max(5, h - 11 + i)));
    $('#d-run').textContent = `${k.active} buses on the road`;
    $('#d-kpis').innerHTML = [
      { go: 'fleet', l: 'Buses in service', ic: 'bus', v: `${k.active}<small>/${k.fleet}</small>`, f: `${k.fleet ? Math.round(k.active / k.fleet * 100) : 0}% fleet availability`, s: spark([12, 14, 15, 16, 17, 17, 16, 17, k.active], 'var(--info)') },
      { go: 'map', l: 'On-time performance', ic: 'clock', v: `${k.otp}<small>%</small>`, f: `<span class="${k.otp >= 85 ? 'up' : 'down'}">${k.otp >= 85 ? '▲' : '▼'}</span> target 85%`, s: spark([88, 91, 86, 84, 89, 92, 90, 87, k.otp], k.otp >= 85 ? 'var(--ok)' : 'var(--crit)') },
      { go: 'reports', l: 'Passengers today', ic: 'users', v: fmtNum(k.pax), f: `<span class="up">▲ 4.2%</span> vs last ${new Date().toLocaleDateString('en-GB', { weekday: 'short' })}`, s: spark(paxSeries, 'var(--accent)') },
      { go: 'reports', l: 'Fare revenue', ic: 'ticket', v: moneyK(k.rev), f: `avg load ${k.load}%`, s: spark(paxSeries.map(v => v * 1.74), 'var(--ok)') },
      { go: 'alerts', l: 'Open alerts', ic: 'bell', v: `${k.alerts}`, f: k.crit ? `<span class="down">${k.crit} critical</span>` : 'no critical issues', s: spark([3, 5, 4, 6, 5, 4, 6, 5, k.alerts], 'var(--crit)') }
    ].map(x => `<div class="kpi" data-go="${x.go}" tabindex="0"><div class="k-label">${icon(x.ic)}${x.l}</div><div class="k-val">${x.v}</div><div class="k-foot">${x.f}</div>${x.s}</div>`).join('');
    updateMapBuses($('#mini'));
    $('#d-clock').innerHTML = `${fmtTime(m)}<span class="blink">:</span>${pad(new Date().getSeconds())}`;
    // departure board
    const rows = S.routes.map(r => {
      const next = TRIPS.filter(t => t.routeId === r.id && t.start >= m && !isCancelled(t.id)).sort((a, b) => a.start - b.start)[0];
      if (!next) return '';
      const b = bus(next.busId); const due = Math.round(next.start - m); const late = b && b.delay > 3;
      const from = STOP[next.dir > 0 ? r.stops[0] : r.stops[r.stops.length - 1]].name;
      const to = STOP[next.dir > 0 ? r.stops[r.stops.length - 1] : r.stops[0]].name;
      return `<div class="board-row"><span class="line-bullet" style="background:${r.color}">${r.id}</span><span class="dest">${esc(to)}</span><span class="due ${late ? 'late' : ''}">${due <= 0 ? 'DUE' : due + ' min'}</span><span class="meta">from ${esc(from)} · ${next.busId} · ${late ? 'EXP +' + b.delay + ' MIN' : 'ON TIME'}</span></div>`;
    }).join('');
    $('#d-board').innerHTML = rows || '<p class="muted">Service has ended for today.</p>';
    if (full || Math.random() < .2) {
      const hrs = []; for (let x = 5; x <= 23; x++) hrs.push(x);
      const today = hrs.map(x => x <= h ? Math.round(demand(x) * (x + 1 > h ? (h - x) || .05 : 1) * (1 + Math.sin(x * 3.1) * .06)) : null);
      const lastWk = hrs.map(x => Math.round(demand(x) * (.94 + Math.cos(x * 1.7) * .05)));
      $('#d-rides').innerHTML = areaChart({ series: [{ values: lastWk, color: 'var(--muted)', dashed: true }, { values: today, color: 'var(--accent)', fill: true, endpoint: true }], labels: hrs.map(x => pad(x) + ':00'), h: 230, xEvery: 3 });
    }
    const cnt = st => S.buses.filter(b => b.status === st).length;
    const items = [{ label: 'In service', value: cnt('service'), color: 'var(--ok)' }, { label: 'At depot', value: cnt('depot'), color: 'var(--info)' }, { label: 'Maintenance', value: cnt('maint'), color: 'var(--warn)' }, { label: 'Out of service', value: cnt('oos'), color: 'var(--crit)' }];
    $('#d-fleet').innerHTML = `<div class="donut-wrap">${donut(items, 150, S.buses.length, 'buses')}<div class="legend">${items.map(i => `<span><span style="display:inline-flex;gap:6px;align-items:center"><i style="background:${i.color}"></i>${i.label}</span><b>${i.value}</b></span>`).join('')}</div></div>`;
    $('#d-perf').innerHTML = S.routes.map(r => {
      const bs = S.buses.filter(b => b.routeId === r.id && b.status === 'service');
      const otp = bs.length ? Math.round(bs.filter(b => b.delay <= 3).length / bs.length * 100) : 100;
      const load = bs.length ? Math.round(bs.reduce((a, b) => a + b.occ / b.capacity, 0) / bs.length * 100) : 0;
      return `<div class="perf-row">${bullet(r.id)}<div><div class="lbl"><span>${bs.length} buses · every ${r.headway} min</span><span>load ${load}%</span></div><div class="bar ${otp < 70 ? 'crit' : otp < 85 ? 'warn' : ''}"><i style="width:${otp}%"></i></div></div><span class="pct">${otp}%</span></div>`;
    }).join('');
    $('#d-feed').innerHTML = openAlerts().slice(0, 5).map(a => `<div class="feed-item"><span class="sev ${a.severity}"></span><div><b>${esc(a.title)}</b><span class="meta">${esc(a.detail)}</span></div><time>${ago(a.time)}</time></div>`).join('') || `<div class="empty">${icon('check')}<div>No open alerts</div></div>`;
    const attn = [];
    S.buses.filter(b => b.nextService < 1500).slice(0, 2).forEach(b => attn.push({ sev: 'warning', t: `${b.id} service due in ${fmtNum(b.nextService)} km`, d: `${b.model} · ${fmtNum(b.odo)} km on the clock`, go: 'maintenance' }));
    S.drivers.filter(d => daysTo(d.licenseExp) < 30).slice(0, 2).forEach(d => attn.push({ sev: daysTo(d.licenseExp) < 0 ? 'critical' : 'warning', t: `${d.name}: licence ${daysTo(d.licenseExp) < 0 ? 'expired' : 'expires in ' + daysTo(d.licenseExp) + ' days'}`, d: `Driver ${d.id} · renew before next roster`, go: 'drivers' }));
    S.drivers.filter(d => d.hoursWeek > 48).slice(0, 1).forEach(d => attn.push({ sev: 'info', t: `${d.name} at ${d.hoursWeek} h this week`, d: 'Approaching the 56 h weekly driving limit', go: 'drivers' }));
    $('#d-attn').innerHTML = attn.map(a => `<div class="feed-item" data-go="${a.go}" style="cursor:pointer"><span class="sev ${a.sev}"></span><div><b>${esc(a.t)}</b><span class="meta">${esc(a.d)}</span></div>${icon('arrowR')}</div>`).join('');
  }
};

// ---- Live map
let mapSel = null; let mapFilter = null;
VIEWS.map = {
  title: 'Live map', crumb: 'Real-time tracking',
  render(el) {
    el.innerHTML = `<div class="map-layout">
      <div class="map-side">
        <div class="card"><div class="eyebrow" style="margin-bottom:8px">Lines</div><div class="stop-picker" id="m-lines">
          <button class="${!mapFilter ? 'on' : ''}" data-line="*">All</button>
          ${S.routes.map(r => `<button data-line="${r.id}" class="${mapFilter?.has(r.id) ? 'on' : ''}"><span class="line-bullet" style="background:${r.color};min-width:0;height:18px;font-size:13px;padding:0 5px">${r.id}</span></button>`).join('')}
        </div></div>
        <div class="input-ic">${icon('search')}<input class="input" id="m-q" placeholder="Find bus, driver or stop"></div>
        <div class="card bus-list" id="m-list"></div>
      </div>
      <div class="map-stage" id="m-stage">${mapSVG('bigmap', { filter: mapFilter })}
        <div class="map-ctrl"><button id="m-zi" aria-label="Zoom in">${icon('plus')}</button><button id="m-zo" aria-label="Zoom out">${icon('minus')}</button><button id="m-zr" aria-label="Reset view">${icon('target')}</button></div>
        <div class="map-legend"><span><i style="background:var(--ok)"></i>On time</span><span><i style="border:2.5px solid var(--warn)"></i>Late 5+ min</span><span><i style="border:2.5px dashed var(--muted);border-radius:2px"></i>Coach</span><span class="muted">Drag to pan · scroll or pinch to zoom</span></div>
        <div id="m-drawer"></div>
      </div></div>`;
    const svg = $('#bigmap');
    const pz = this.pz = panZoom(svg);
    $('#m-zi').onclick = () => pz.zoom(1 / 1.3); $('#m-zo').onclick = () => pz.zoom(1.3); $('#m-zr').onclick = () => pz.reset();
    svg.addEventListener('click', e => { if (pz.wasDrag()) return; const g = e.target.closest('.bus-m'); if (g) this.select(g.dataset.bus); });
    $('#m-lines').onclick = e => {
      const b = e.target.closest('[data-line]'); if (!b) return;
      const id = b.dataset.line;
      if (id === '*') mapFilter = null; else { mapFilter = mapFilter || new Set(); mapFilter.has(id) ? mapFilter.delete(id) : mapFilter.add(id); if (!mapFilter.size) mapFilter = null; }
      this.render(el);
    };
    $('#m-q').oninput = () => this.list();
    this.list();
    if (mapSel) this.select(mapSel, true);
  },
  list() {
    const q = ($('#m-q')?.value || '').toLowerCase();
    const rows = S.buses.filter(b => b.status === 'service' && (!mapFilter || mapFilter.has(b.routeId))).filter(b => {
      const d = driver(b.driverId); return !q || [b.id, b.plate, d?.name, terminusOf(b), b.routeId].join(' ').toLowerCase().includes(q);
    });
    $('#m-list').innerHTML = rows.map(b => {
      const d = driver(b.driverId); const ns = nextStops(b, 1)[0];
      return `<div class="bus-row ${b.id === mapSel ? 'sel' : ''}" data-bus="${b.id}">${bullet(b.routeId)}<div style="min-width:0"><div class="t1">${b.id} <span class="muted" style="font-weight:400">→ ${esc(terminusOf(b))}</span></div><div class="t2">${esc(d?.name || 'Unassigned')} · next ${esc(ns?.stop.name || '—')}</div></div><span style="font-size:12.5px;font-weight:700">${delayTxt(b.delay)}</span></div>`;
    }).join('') || `<div class="empty">${icon('bus')}<div>No buses match</div></div>`;
    $$('#m-list .bus-row').forEach(r => r.onclick = () => this.select(r.dataset.bus));
  },
  select(id, keepView) {
    mapSel = id; const b = bus(id); if (!b || b.status !== 'service' || !routeOf(b.routeId)) { mapSel = null; return; }
    if (!keepView) { const p = pointAt(geom(routeOf(b.routeId)), b.t); this.pz.focus(p.x, p.y); }
    this.drawer(); this.list(); updateMapBuses($('#bigmap'), mapSel);
  },
  drawer() {
    const b = bus(mapSel); const box = $('#m-drawer'); if (!box) return;
    if (!b || b.status !== 'service') { box.innerHTML = ''; return; }
    const d = driver(b.driverId); const r = routeOf(b.routeId); const load = Math.round(b.occ / b.capacity * 100);
    box.innerHTML = `<div class="bus-drawer" style="--route:${r.color}">
      <div class="drawer-head">${bullet(r.id, true)}<div style="flex:1;min-width:0"><h3>${b.id}</h3><div class="muted" style="font-size:13px">to ${esc(terminusOf(b))}</div></div><button class="icon-btn" id="dr-x" aria-label="Close details">${icon('x')}</button></div>
      <div class="stat-grid">
        <div class="stat"><div class="s-l">Schedule</div><div class="s-v" style="font-size:18px">${delayTxt(b.delay)}</div></div>
        <div class="stat"><div class="s-l">Speed</div><div class="s-v">${b.speed} <small class="muted" style="font-size:13px">km/h</small></div></div>
        <div class="stat"><div class="s-l">Load</div><div class="s-v">${load}%</div><div class="bar ${load > 90 ? 'crit' : load > 75 ? 'warn' : 'info'}"><i style="width:${Math.min(100, load)}%"></i></div></div>
        <div class="stat"><div class="s-l">${b.fuel === 'Electric' ? 'Battery' : 'Fuel'}</div><div class="s-v">${Math.round(b.energy)}%</div><div class="bar ${pctCls(b.energy)}"><i style="width:${b.energy}%"></i></div></div>
      </div>
      <div><div class="eyebrow" style="margin-bottom:6px">Next stops</div><div class="next-stops">${nextStops(b, 4).map(n => `<div>${esc(n.stop.name)}<time>${n.eta} min</time></div>`).join('') || '<div>Terminus</div>'}</div></div>
      <dl class="kv"><dt>Driver</dt><dd>${esc(d?.name || 'Unassigned')}</dd><dt>Vehicle</dt><dd>${esc(b.model)}</dd><dt>Plate</dt><dd class="mono">${esc(b.plate)}</dd><dt>Passengers</dt><dd>${b.occ} / ${b.capacity}</dd></dl>
      ${can('dispatch') ? `<div class="toolbar"><button class="btn sm" id="dr-msg">${icon('message')}Message driver</button><button class="btn sm" id="dr-hold">${icon('clock')}Hold 2 min</button><button class="btn sm danger" id="dr-pull">${icon('undo')}Pull in</button></div>` : ''}
    </div>`;
    $('#dr-x').onclick = () => { mapSel = null; box.innerHTML = ''; this.list(); updateMapBuses($('#bigmap'), null); };
    if (!can('dispatch')) return;
    $('#dr-msg').onclick = () => messageModal(b);
    $('#dr-hold').onclick = () => {
      b.holdUntil = Date.now() + 120000;
      if (b.driverId) S.messages.unshift({ id: uid('M'), to: b.driverId, from: 'Dispatch', text: 'Hold at the next stop for 2 min for headway balancing.', time: Date.now() });
      save(); toast(`${b.id} told to hold 2 min for headway balancing`, 'ok', 'clock');
    };
    $('#dr-pull').onclick = () => openModal({
      title: `Pull ${b.id} out of service?`, body: `<p>The bus returns to the depot and its remaining trips today need cover. ${esc(d?.name || 'The driver')} goes to standby.</p>`,
      actions: [{ label: 'Keep in service' }, { label: 'Pull in to depot', kind: 'primary', onClick: () => { b.status = 'depot'; if (d) { d.status = 'standby'; } toast(`${b.id} sent to depot`, 'warn', 'undo'); mapSel = null; save(); route(); } }]
    });
  },
  tick() { updateMapBuses($('#bigmap'), mapSel); if (Math.random() < .34) { this.list(); } if (mapSel) this.drawer(); }
};

// ---- Fleet
let fleetFilter = 'all', fleetView = 'cards';
VIEWS.fleet = {
  title: 'Fleet', crumb: 'Vehicles',
  render(el) {
    const cnt = st => st === 'all' ? S.buses.length : S.buses.filter(b => b.status === st).length;
    el.innerHTML = `<div class="toolbar">
        <div class="seg" id="f-seg">${['all', 'service', 'depot', 'maint', 'oos'].map(s => `<button class="${fleetFilter === s ? 'on' : ''}" data-s="${s}">${s === 'all' ? 'All' : STATUS[s].label} <span class="muted">${cnt(s)}</span></button>`).join('')}</div>
        <div class="input-ic grow">${icon('search')}<input class="input" id="f-q" placeholder="Search by ID, plate, model or driver"></div>
        <div class="seg"><button class="${fleetView === 'cards' ? 'on' : ''}" data-v="cards">Cards</button><button class="${fleetView === 'table' ? 'on' : ''}" data-v="table">Table</button></div>
        <button class="btn primary" id="f-add">${icon('plus')}Add bus</button>
      </div><div id="f-out"></div>`;
    $('#f-seg').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { fleetFilter = b.dataset.s; this.render(el); } };
    $$('[data-v]', el).forEach(b => b.onclick = () => { fleetView = b.dataset.v; this.render(el); });
    $('#f-q').oninput = () => this.draw();
    $('#f-add').onclick = () => { if (guard('fleet.add')) busModal(); };
    this.draw();
  },
  draw() {
    const q = ($('#f-q')?.value || '').toLowerCase();
    const list = S.buses.filter(b => (fleetFilter === 'all' || b.status === fleetFilter) && (!q || [b.id, b.plate, b.model, b.fuel, driver(b.driverId)?.name].join(' ').toLowerCase().includes(q)));
    const out = $('#f-out');
    if (!list.length) { out.innerHTML = `<div class="card empty">${icon('bus')}<div>No buses match these filters.</div></div>`; return; }
    if (fleetView === 'table') {
      out.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Bus</th><th>Plate</th><th>Status</th><th>Line</th><th>Driver</th><th>Model</th><th>Energy</th><th>Odometer</th><th>Next service</th></tr></thead><tbody>
        ${list.map(b => `<tr data-bus="${b.id}"><td><b>${b.id}</b></td><td class="mono">${esc(b.plate)}</td><td>${statusChip(b.status)}</td><td>${b.routeId ? bullet(b.routeId) : '—'}</td><td>${esc(driver(b.driverId)?.name || '—')}</td><td>${esc(b.model)} <span class="muted">· ${b.fuel}</span></td><td>${Math.round(b.energy)}%</td><td>${fmtNum(b.odo)} km</td><td style="color:${b.nextService < 1500 ? 'var(--warn)' : 'inherit'}">${fmtNum(b.nextService)} km</td></tr>`).join('')}
      </tbody></table></div>`;
    } else {
      out.innerHTML = `<div class="cards">${list.map(b => {
        const d = driver(b.driverId); const load = Math.round(b.occ / b.capacity * 100);
        return `<div class="bus-card" data-bus="${b.id}" tabindex="0">
          <div class="top"><div><div class="id">${b.id}</div><span class="plate">${esc(b.plate)}</span></div>${statusChip(b.status)}</div>
          <dl class="kv"><dt>Line</dt><dd>${b.routeId ? bullet(b.routeId) : '—'}</dd><dt>Driver</dt><dd>${esc(d?.name || '—')}</dd><dt>Model</dt><dd>${esc(b.model)}</dd><dt>Odometer</dt><dd>${fmtNum(b.odo)} km</dd></dl>
          <div><div class="meter-lbl"><span>${icon(b.fuel === 'Electric' ? 'battery' : 'fuel')} ${b.fuel}</span><b>${Math.round(b.energy)}%</b></div><div class="bar ${pctCls(b.energy)}"><i style="width:${b.energy}%"></i></div></div>
          ${b.status === 'service' ? `<div><div class="meter-lbl"><span>Passenger load</span><b>${b.occ}/${b.capacity}</b></div><div class="bar info"><i style="width:${Math.min(100, load)}%"></i></div></div>` : `<div class="meter-lbl"><span>Next service</span><b style="color:${b.nextService < 1500 ? 'var(--warn)' : 'inherit'}">${fmtNum(b.nextService)} km</b></div>`}
        </div>`;
      }).join('')}</div>`;
    }
    $$('[data-bus]', out).forEach(x => x.onclick = () => busModal(bus(x.dataset.bus)));
  },
  tick() { if (Math.random() < .2 && !$('#overlay').children.length && document.activeElement?.id !== 'f-q') this.draw(); }
};
function busModal(b) {
  const isNew = !b;
  b = b || { id: 'B-' + (Math.max(100, ...S.buses.map(x => +x.id.slice(2) || 0)) + 1), plate: '', model: 'Mercedes-Benz eCitaro', fuel: 'Electric', capacity: 88, year: new Date().getFullYear(), status: 'depot', routeId: '', driverId: '' };
  const freeDrivers = S.drivers.filter(d => !d.busId || d.busId === b.id);
  openModal({
    title: isNew ? 'Add bus' : `${b.id} · ${esc(b.model)}`, wide: !isNew,
    body: `${!isNew ? `<div class="stat-grid" style="grid-template-columns:repeat(4,1fr)"><div class="stat"><div class="s-l">Odometer</div><div class="s-v">${fmtNum(b.odo)}</div></div><div class="stat"><div class="s-l">Energy</div><div class="s-v">${Math.round(b.energy)}%</div></div><div class="stat"><div class="s-l">Next service</div><div class="s-v">${fmtNum(b.nextService)}</div></div><div class="stat"><div class="s-l">Built</div><div class="s-v">${b.year}</div></div></div>` : ''}
      <div class="form-grid">
        ${isNew ? field({ id: 'id', label: 'Fleet number', value: b.id }) : ''}
        ${field({ id: 'plate', label: 'Licence plate', value: b.plate, placeholder: 'HW 125 XY' })}
        ${field({ id: 'model', label: 'Model', value: b.model })}
        ${field({ id: 'fuel', label: 'Propulsion', type: 'select', value: b.fuel, options: ['Electric', 'Diesel', 'CNG', 'Hydrogen'].map(x => [x, x]) })}
        ${field({ id: 'capacity', label: 'Capacity (passengers)', type: 'number', value: b.capacity, min: 10, max: 200 })}
        ${field({ id: 'status', label: 'Status', type: 'select', value: b.status, options: Object.entries(STATUS).map(([k, v]) => [k, v.label]) })}
        ${field({ id: 'routeId', label: 'Assigned line', type: 'select', value: b.routeId || '', options: [['', 'None'], ...S.routes.map(r => [r.id, `${r.id} · ${r.name}`])] })}
        ${field({ id: 'driverId', label: 'Driver', type: 'select', value: b.driverId || '', options: [['', 'Unassigned'], ...freeDrivers.map(d => [d.id, `${d.name} (${DSTATUS[d.status].label})`])] })}
      </div>`,
    actions: [
      ...(!isNew && can('maint') ? [{ label: 'Create work order', icon: 'wrench', onClick: () => { setTimeout(() => woModal({ busId: b.id }), 0); } }] : []),
      { label: 'Cancel' },
      {
        label: isNew ? 'Add bus' : 'Save changes', kind: 'primary', onClick: m => {
          if (!guard(isNew ? 'fleet.add' : 'fleet.edit')) return false;
          if (!requireFields(m, isNew ? ['id', 'plate', 'model'] : ['plate', 'model'])) return false;
          const f = readForm(m);
          if (!isNew) f.id = b.id; // the fleet number is the record key
          if (isNew && S.buses.some(x => x.id === f.id)) { toast(`${f.id} already exists. Pick another fleet number.`, 'warn', 'alert'); return false; }
          if (f.status === 'service' && (!f.routeId || !f.driverId)) { toast('A bus in service needs a line and a driver.', 'warn', 'alert'); return false; }
          if ((f.driverId || null) !== (b.driverId || null) && !can('drivers.edit')) { toast('Only dispatch can change who drives a bus.', 'warn', 'shield'); return false; }
          const target = isNew ? makeBus(+f.id.replace(/\D/g, '') || 199, [f.model, f.fuel, +f.capacity], f.status, null, null, Math.random, 0) : b;
          const oldDriver = driver(target.driverId);
          if (oldDriver && oldDriver.id !== f.driverId) { oldDriver.busId = null; if (oldDriver.status === 'duty') oldDriver.status = 'standby'; }
          Object.assign(target, { id: f.id, plate: f.plate.toUpperCase(), model: f.model, fuel: f.fuel, capacity: +f.capacity || 80, status: f.status, routeId: f.routeId || null, driverId: f.driverId || null });
          const nd = driver(target.driverId); if (nd) { nd.busId = target.id; if (target.status === 'service') nd.status = 'duty'; }
          if (target.status === 'service' && target.t == null) target.t = 0;
          if (isNew) S.buses.push(target);
          TRIPS = buildTrips(); save(); route();
          toast(isNew ? `${target.id} added to the fleet` : `${target.id} updated`);
        }
      }
    ]
  });
}

// ---- Routes
VIEWS.routes = {
  title: 'Lines & stops', crumb: 'Network',
  render(el) {
    el.innerHTML = `<div class="toolbar"><div class="grow muted">${S.routes.length} lines serving ${STOPS.length} stops. Bus markers on each strip move in real time.</div><button class="btn primary" id="r-add">${icon('plus')}New line</button></div>
      <div style="display:flex;flex-direction:column;gap:14px">${S.routes.map(r => {
        const g = geom(r); const bs = S.buses.filter(b => b.routeId === r.id && b.status === 'service');
        const trips = TRIPS.filter(t => t.routeId === r.id).length;
        return `<div class="route-card"><div class="head">${bullet(r.id, true)}<div style="flex:1;min-width:200px"><h3>${esc(r.name)}</h3><div class="facts">
            <span><b>${r.stops.length}</b> stops</span><span>every <b>${r.headway}</b> min</span><span><b>${g.minutes}</b> min end to end</span><span><b>${bs.length}</b> buses live</span><span><b>${trips}</b> trips today</span><span>fare <b>${money(r.fare)}</b></span></div></div>
            <span class="chip ${r.kind === 'coach' ? 'accent' : 'info'} nodot">${r.kind === 'coach' ? 'Coach · reserved seats' : 'City bus'}</span>
            <button class="btn sm" data-edit="${r.id}">Edit</button></div>
          <div class="strip-wrap"><div class="strip" data-strip="${r.id}"><div class="track" style="background:${r.color}"></div>
            ${r.stops.map((sid, i) => `<span class="st" style="left:${g.stopT[i] * 100}%;border-color:${r.color}"></span><span class="st-l ${i % 2 ? 'alt' : ''}" style="left:${g.stopT[i] * 100}%">${esc(STOP[sid].name)}</span>`).join('')}
            <div class="bdots"></div></div></div></div>`;
      }).join('')}</div>`;
    $('#r-add').onclick = () => { if (guard('routes.edit')) routeModal(); };
    $$('[data-edit]', el).forEach(b => b.onclick = () => { if (guard('routes.edit')) routeModal(routeOf(b.dataset.edit)); });
    this.tick();
  },
  tick() {
    $$('[data-strip]').forEach(s => {
      const bs = S.buses.filter(b => b.routeId === s.dataset.strip && b.status === 'service');
      $('.bdots', s).innerHTML = bs.map(b => `<span class="bdot ${b.delay >= 5 ? 'late' : ''}" style="left:${b.t * 100}%" title="${b.id} ${b.dir > 0 ? '→' : '←'}">${b.dir > 0 ? '' : '‹'}${b.id.slice(2)}${b.dir > 0 ? '›' : ''}</span>`).join('');
    });
  }
};
function routeModal(r) {
  const isNew = !r;
  const sel = r ? [...r.stops] : [];
  const draw = m => { $('#stop-pick', m).innerHTML = STOPS.map(s => { const i = sel.indexOf(s.id); return `<button type="button" class="${i >= 0 ? 'on' : ''}" data-sid="${s.id}">${i >= 0 ? `<span class="o">${i + 1}</span>` : ''}${esc(s.name)}</button>`; }).join(''); };
  openModal({
    title: isNew ? 'New line' : `Edit line ${r.id}`, wide: true,
    body: `<div class="form-grid">
      ${isNew ? field({ id: 'id', label: 'Line number', value: '', placeholder: 'e.g. 62' }) : ''}
      ${field({ id: 'name', label: 'Line name', value: r?.name || '', placeholder: 'Harbor Terminal – Airport' })}
      ${field({ id: 'headway', label: 'Headway (minutes)', type: 'number', value: r?.headway || 12, min: 3, max: 120 })}
      ${field({ id: 'fare', label: `Fare (${S.settings.currency})`, type: 'number', value: r?.fare || 1.8, step: .1, min: 0 })}
      ${field({ id: 'color', label: 'Line colour', type: 'color', value: r?.color || '#2b8bb3' })}
      ${field({ id: 'kind', label: 'Service type', type: 'select', value: r?.kind || 'city', options: [['city', 'City bus'], ['coach', 'Coach with reserved seats']] })}
      </div>
      <div class="fld"><label>Stops in running order <span class="muted">· tap to add, tap again to remove</span></label><div class="stop-picker" id="stop-pick"></div></div>`,
    onMount: m => { draw(m); $('#stop-pick', m).onclick = e => { const b = e.target.closest('[data-sid]'); if (!b) return; const i = sel.indexOf(b.dataset.sid); i >= 0 ? sel.splice(i, 1) : sel.push(b.dataset.sid); draw(m); }; },
    actions: [
      ...(!isNew ? [{ label: 'Delete line', kind: 'danger', onClick: () => { if (S.buses.some(b => b.routeId === r.id && b.status === 'service')) { toast(`Move the buses off line ${r.id} before deleting it.`, 'warn', 'alert'); return false; } S.routes = S.routes.filter(x => x !== r); TRIPS = buildTrips(); save(); route(); toast(`Line ${r.id} deleted`, 'warn'); } }] : []),
      { label: 'Cancel' },
      {
        label: isNew ? 'Create line' : 'Save line', kind: 'primary', onClick: m => {
          if (!requireFields(m, isNew ? ['id', 'name'] : ['name'])) return false;
          if (sel.length < 2) { toast('Pick at least two stops for the line.', 'warn', 'alert'); return false; }
          const f = readForm(m);
          if (!isNew) f.id = r.id; // the line number is the record key that buses point at
          if (isNew && routeOf(f.id)) { toast(`Line ${f.id} already exists.`, 'warn', 'alert'); return false; }
          const target = r || {};
          Object.assign(target, { id: f.id, name: f.name, headway: +f.headway || 10, fare: +f.fare || 0, color: f.color, kind: f.kind, stops: [...sel] });
          if (f.kind === 'coach') target.seats = 44;
          if (isNew) S.routes.push(target);
          TRIPS = buildTrips(); save(); route(); toast(isNew ? `Line ${f.id} created` : `Line ${f.id} saved`);
        }
      }
    ]
  });
}

// ---- Drivers
let drvFilter = 'all';
VIEWS.drivers = {
  title: 'Drivers', crumb: 'Crew',
  render(el) {
    const cnt = s => s === 'all' ? S.drivers.length : S.drivers.filter(d => d.status === s).length;
    el.innerHTML = `<div class="toolbar"><div class="seg" id="dv-seg">${['all', 'duty', 'standby', 'off', 'leave'].map(s => `<button class="${drvFilter === s ? 'on' : ''}" data-s="${s}">${s === 'all' ? 'All' : DSTATUS[s].label} <span class="muted">${cnt(s)}</span></button>`).join('')}</div>
      <div class="input-ic grow">${icon('search')}<input class="input" id="dv-q" placeholder="Search name or ID"></div><button class="btn primary" id="dv-add">${icon('plus')}Add driver</button></div><div class="cards" id="dv-out"></div>`;
    $('#dv-seg').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { drvFilter = b.dataset.s; this.render(el); } };
    $('#dv-q').oninput = () => this.draw();
    $('#dv-add').onclick = () => { if (guard('drivers.add')) driverModal(); };
    this.draw();
  },
  draw() {
    const q = ($('#dv-q')?.value || '').toLowerCase();
    const list = S.drivers.filter(d => (drvFilter === 'all' || d.status === drvFilter) && (!q || (d.name + ' ' + d.id).toLowerCase().includes(q)));
    $('#dv-out').innerHTML = list.map(d => {
      const b = bus(d.busId); const lic = daysTo(d.licenseExp); const hrsPct = Math.min(100, d.hoursWeek / 56 * 100);
      return `<div class="bus-card drv-card" data-d="${d.id}" tabindex="0">
        <div class="top">${avatar(d)}<div style="flex:1;min-width:0"><div class="name">${esc(d.name)}</div><div class="muted mono">${d.id} · since ${d.since}</div></div>${dChip(d.status)}</div>
        <dl class="kv"><dt>Bus</dt><dd>${b ? `${b.id} ${b.routeId ? bullet(b.routeId) : ''}` : '—'}</dd><dt>Rating</dt><dd><span class="stars">${'★'.repeat(Math.round(d.rating))}${'☆'.repeat(5 - Math.round(d.rating))}</span> ${d.rating.toFixed(1)}</dd>
        <dt>Licence</dt><dd>${lic < 0 ? '<span class="chip crit">Expired</span>' : lic < 30 ? `<span class="chip warn">${lic} days left</span>` : esc(d.licenseExp)}</dd></dl>
        <div><div class="meter-lbl"><span>Driving hours this week</span><b>${d.hoursWeek} / 56 h</b></div><div class="bar ${d.hoursWeek > 50 ? 'crit' : d.hoursWeek > 44 ? 'warn' : ''}"><i style="width:${hrsPct}%"></i></div></div>
      </div>`;
    }).join('') || `<div class="card empty">${icon('users')}<div>No drivers match.</div></div>`;
    $$('[data-d]').forEach(x => x.onclick = () => driverModal(driver(x.dataset.d)));
  }
};
function driverModal(d) {
  const isNew = !d;
  d = d || { id: 'D' + (Math.max(200, ...S.drivers.map(x => +x.id.slice(1) || 0)) + 1), name: '', phone: '', status: 'standby', busId: null, hoursWeek: 0, rating: 5, licenseExp: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), since: new Date().getFullYear(), color: AV_COLORS[S.drivers.length % AV_COLORS.length], km: 0 };
  const myTrips = TRIPS.filter(t => t.driverId === d.id);
  openModal({
    title: isNew ? 'Add driver' : esc(d.name), wide: !isNew,
    body: `${!isNew ? `<div style="display:flex;gap:14px;align-items:center">${avatar(d, true)}<div><div class="mono muted">${d.id} · ${esc(d.phone)}</div><div>${dChip(d.status)} <span class="muted" style="font-size:13px">· ${fmtNum(d.km)} km driven · ${myTrips.length} trips today</span></div></div></div>` : ''}
      <div class="form-grid">
        ${field({ id: 'name', label: 'Full name', value: d.name })}
        ${field({ id: 'phone', label: 'Phone', value: d.phone, type: 'tel' })}
        ${field({ id: 'status', label: 'Status', type: 'select', value: d.status, options: Object.entries(DSTATUS).map(([k, v]) => [k, v.label]) })}
        ${field({ id: 'licenseExp', label: 'Licence valid until', type: 'date', value: d.licenseExp })}
        ${field({ id: 'hoursWeek', label: 'Hours driven this week', type: 'number', value: d.hoursWeek, min: 0, max: 90 })}
      </div>
      ${myTrips.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Today's duty</div><div class="stop-picker">${myTrips.slice(0, 12).map(t => `<span class="chip nodot">${fmtTime(t.start)} ${t.routeId} · ${t.busId}</span>`).join('')}</div></div>` : ''}`,
    actions: [{ label: 'Cancel' }, {
      label: isNew ? 'Add driver' : 'Save', kind: 'primary', onClick: m => {
        if (!guard(isNew ? 'drivers.add' : 'drivers.edit')) return false;
        if (!requireFields(m, ['name'])) return false;
        const f = readForm(m);
        if (f.status !== 'duty' && d.busId) { const b = bus(d.busId); if (b && b.status === 'service') { toast(`${d.name} still drives ${b.id}. Reassign the bus first.`, 'warn', 'alert'); return false; } }
        Object.assign(d, { name: f.name, phone: f.phone, status: f.status, licenseExp: f.licenseExp, hoursWeek: +f.hoursWeek || 0 });
        if (isNew) S.drivers.push(d);
        save(); route(); toast(isNew ? `${d.name} added` : `${d.name} updated`);
      }
    }]
  });
}

// ---- Schedule
let schedLine = 'all';
VIEWS.schedule = {
  title: 'Schedule & dispatch', crumb: 'Today’s blocks',
  render(el) {
    const m = nowMin();
    const trips = TRIPS.filter(t => schedLine === 'all' || t.routeId === schedLine);
    const st = { done: 0, running: 0, planned: 0, cancelled: 0 }; trips.forEach(t => st[tripState(t, m)]++);
    const busesWith = [...new Set(trips.map(t => t.busId))];
    const H0 = 5, H1 = 24, PX = 80;
    const x = min => (min - H0 * 60) / 60 * PX;
    el.innerHTML = `<div class="big-stats">
        <div class="big-stat"><div class="l">Trips today</div><div class="v">${trips.length}</div><div class="d">${busesWith.length} vehicle blocks</div></div>
        <div class="big-stat"><div class="l">Completed</div><div class="v" style="color:var(--ok)">${st.done}</div><div class="d">${trips.length ? Math.round(st.done / trips.length * 100) : 0}% of the day</div></div>
        <div class="big-stat"><div class="l">Running now</div><div class="v" style="color:var(--accent-ink)">${st.running}</div><div class="d">planned ahead: ${st.planned}</div></div>
        <div class="big-stat"><div class="l">Cancelled</div><div class="v" style="color:var(--crit)">${st.cancelled}</div><div class="d">lost service minutes ${trips.filter(t => isCancelled(t.id)).reduce((a, t) => a + t.end - t.start, 0)}</div></div></div>
      <div class="toolbar"><div class="seg" id="sc-seg"><button data-l="all" class="${schedLine === 'all' ? 'on' : ''}">All lines</button>${S.routes.map(r => `<button data-l="${r.id}" class="${schedLine === r.id ? 'on' : ''}">${r.id}</button>`).join('')}</div>
        <span class="grow"></span><span class="muted" style="font-size:13px">${can('dispatch') ? 'Tap a trip to reassign driver or cancel.' : 'Tap a trip for details.'} Dotted line marks the 14:00 driver relief.</span></div>
      <div class="gantt-wrap" id="sc-wrap"><div class="gantt">
        <div class="g-row head"><div class="g-label">Vehicle block</div><div class="g-track">${Array.from({ length: H1 - H0 }, (_, i) => `<span class="g-hour" style="left:${i * PX}px">${pad(H0 + i)}:00</span>`).join('')}</div></div>
        ${busesWith.map(bid => {
          const b = bus(bid); const ts = trips.filter(t => t.busId === bid);
          return `<div class="g-row"><div class="g-label"><b>${bid}</b><small>${esc(driver(b.driverId)?.name || '—')}</small></div><div class="g-track">
            ${Array.from({ length: H1 - H0 }, (_, i) => `<span class="g-hour" style="left:${i * PX}px;padding:0"></span>`).join('')}
            <span class="g-shift" style="left:${x(840)}px"></span>
            ${ts.map(t => { const r = routeOf(t.routeId); const s = tripState(t, m); return `<button class="g-trip ${s}" data-trip="${t.id}" style="left:${x(t.start)}px;width:${Math.max(18, x(t.end) - x(t.start))}px;background:${r.color}" title="${r.id} ${fmtTime(t.start)}–${fmtTime(t.end)}">${r.id} ${fmtTime(t.start)}</button>`; }).join('')}
          </div></div>`;
        }).join('')}
        <div class="g-now" data-t="${fmtTime(m)}" style="left:${150 + x(m)}px"></div>
      </div></div>`;
    $('#sc-seg').onclick = e => { const b = e.target.closest('[data-l]'); if (b) { schedLine = b.dataset.l; this.render(el); } };
    $$('[data-trip]', el).forEach(b => b.onclick = () => tripModal(TRIPS.find(t => t.id === b.dataset.trip)));
    const wrap = $('#sc-wrap'); wrap.scrollLeft = Math.max(0, x(m) - wrap.clientWidth / 3);
  }
};
function tripModal(t) {
  const r = routeOf(t.routeId); const st = tripState(t);
  const from = STOP[t.dir > 0 ? r.stops[0] : r.stops[r.stops.length - 1]].name, to = STOP[t.dir > 0 ? r.stops[r.stops.length - 1] : r.stops[0]].name;
  const avail = S.drivers.filter(d => d.status !== 'leave');
  openModal({
    title: `Trip ${esc(t.id)}`,
    body: `<div style="display:flex;gap:12px;align-items:center">${bullet(r.id, true)}<div><b>${esc(from)} → ${esc(to)}</b><div class="muted">${fmtTime(t.start)} – ${fmtTime(t.end)} · ${t.end - t.start} min · ${t.busId}</div></div><span style="margin-left:auto" class="chip ${st === 'running' ? 'accent' : st === 'done' ? 'ok' : st === 'cancelled' ? 'crit' : 'info'}">${st[0].toUpperCase() + st.slice(1)}</span></div>
      ${field({ id: 'driverId', label: 'Driver for this trip', type: 'select', value: t.driverId, options: avail.map(d => [d.id, `${d.name} · ${DSTATUS[d.status].label}`]) })}`,
    actions: (can('dispatch') ? [
      st === 'cancelled' ? { label: 'Restore trip', icon: 'undo', onClick: () => { setOvr(t.id, { cancelled: false }); save(); route(); toast(`Trip ${t.id} restored`); } }
        : st !== 'done' ? { label: 'Cancel trip', kind: 'danger', onClick: () => { setOvr(t.id, { cancelled: true }); save(); route(); toast(`Trip ${t.id} cancelled. Passengers informed on displays.`, 'warn', 'x'); } } : null,
      { label: 'Close' },
      { label: 'Save assignment', kind: 'primary', onClick: m => { const id = readForm(m).driverId; setOvr(t.id, { driverId: id }); t.driverId = id; save(); route(); toast(`${driver(id).name} assigned to ${fmtTime(t.start)} trip`); } }
    ] : [{ label: 'Close' }]).filter(Boolean)
  });
}

// ---- Tickets (coach line, reserved seats)
let tkDep = null, tkSeat = null, lastTicket = null;
VIEWS.tickets = {
  title: 'Coach tickets', crumb: 'Line X1 · reserved seats',
  render(el) {
    const coach = S.routes.find(r => r.kind === 'coach');
    if (!coach) { el.innerHTML = `<div class="card empty">${icon('ticket')}<div>No coach line exists. Create a line with service type “Coach” to sell reserved seats.</div></div>`; return; }
    const m = nowMin(); const deps = coachDepartures();
    if (tkDep == null || tkDep < m - 1) tkDep = deps.find(d => d > m) ?? deps[deps.length - 1];
    const seatsTotal = coach.seats || 44;
    const today = bookingsToday(); const depBookings = today.filter(b => b.dep === tkDep);
    const taken = new Set(depBookings.map(b => b.seat));
    const fare = coach.fare;
    el.innerHTML = `<div class="book-grid">
      <div class="card"><div class="card-h"><h3>Departures</h3><span class="sub">${esc(coach.name)}</span></div><div class="dep-list">
        ${deps.filter(d => d >= m).map(d => { const left = seatsTotal - today.filter(b => b.dep === d).length; return `<button class="dep ${d === tkDep ? 'sel' : ''}" data-dep="${d}"><span class="tm">${fmtTime(d)}</span><span class="muted" style="font-size:12.5px">${left} seats left</span>${left < 8 ? '<span class="chip warn nodot">Few left</span>' : '<span></span>'}</button>`; }).join('') || '<p class="muted">No more departures today.</p>'}
      </div>${deps.some(d => d < m) ? `<p class="muted" style="font-size:12.5px;margin:10px 0 0">${deps.filter(d => d < m).length} earlier departures have left.</p>` : ''}</div>
      <div class="card"><div class="card-h"><h3>Choose a seat</h3><span class="sub">${fmtTime(tkDep)} departure · ${seatsTotal - taken.size} free</span><span class="spacer"></span>
        <div class="legend"><span><i style="background:var(--surface);border:1.5px solid var(--line)"></i>Free</span><span><i style="background:var(--line)"></i>Taken</span><span><i style="background:var(--accent)"></i>Selected</span></div></div>
        <div class="coach"><div class="front"><span>${icon('user')} Driver</span><span>${icon('door')} Door</span></div><div class="seats">
        ${(() => { let h = ''; let n = 1; for (let row = 0; n <= seatsTotal; row++) { for (let c = 0; c < 5; c++) { if (c === 2) { h += '<span></span>'; continue; } if (row === 5 && c > 2) { h += '<span class="seat door"></span>'; continue; } if (n > seatsTotal) { h += '<span></span>'; continue; } const tk = taken.has(n); h += `<button class="seat ${tk ? 'taken' : ''} ${tkSeat === n ? 'sel' : ''}" data-seat="${n}" ${tk ? 'disabled aria-label="Seat ' + n + ' taken"' : 'aria-label="Seat ' + n + '"'}>${n}</button>`; n++; } } return h; })()}
        </div></div></div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card"><div class="card-h"><h3>Passenger</h3></div><div style="display:flex;flex-direction:column;gap:12px">
          ${field({ id: 'tk-name', label: 'Name on ticket', placeholder: 'e.g. Jamie Rivera' })}
          ${field({ id: 'tk-type', label: 'Fare type', type: 'select', value: 'Adult', options: [['Adult', `Adult · ${money(fare)}`], ['Student', `Student · ${money(fare * .6)}`], ['Senior', `Senior 65+ · ${money(fare * .5)}`], ['Child', `Child under 12 · ${money(fare * .4)}`]] })}
          <div class="meter-lbl" style="font-size:14px"><span>Seat</span><b id="tk-seat-l">${tkSeat ? 'No. ' + tkSeat : 'Pick one on the plan'}</b></div>
          <button class="btn primary" id="tk-issue" ${tkSeat ? '' : 'disabled'} style="justify-content:center">${icon('ticket')}Issue ticket</button></div></div>
        <div id="tk-last"></div>
      </div></div>
      <div class="card"><div class="card-h"><h3>Bookings for ${fmtTime(tkDep)}</h3><span class="sub">${taken.size} passengers · ${money(depBookings.reduce((a, b) => a + b.fare, 0))}</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Ticket</th><th>Seat</th><th>Name</th><th>Fare</th><th>Amount</th><th></th></tr></thead><tbody>
        ${[...depBookings].sort((a, b) => a.seat - b.seat).map(b => `<tr style="cursor:default"><td class="mono">${b.id}</td><td>${b.seat}</td><td>${esc(b.name)}</td><td>${b.type}</td><td>${money(b.fare)}</td><td style="text-align:right"><button class="btn sm ghost danger" data-refund="${b.id}">Refund</button></td></tr>`).join('')}
        </tbody></table></div></div>`;
    $$('[data-dep]', el).forEach(b => b.onclick = () => { tkDep = +b.dataset.dep; tkSeat = null; this.render(el); });
    $$('[data-seat]', el).forEach(b => b.onclick = () => { tkSeat = +b.dataset.seat; $$('.seat.sel', el).forEach(s => s.classList.remove('sel')); b.classList.add('sel'); $('#tk-seat-l').textContent = 'No. ' + tkSeat; $('#tk-issue').disabled = false; });
    $$('[data-refund]', el).forEach(b => b.onclick = () => { if (!guard('tickets')) return; const bk = S.bookings.find(x => x.id === b.dataset.refund); S.bookings = S.bookings.filter(x => x !== bk); save(); this.render(el); toast(`Ticket ${bk.id} refunded · seat ${bk.seat} released`, 'warn', 'undo'); });
    $('#tk-issue').onclick = () => {
      if (!guard('tickets')) return;
      const f = readForm(el);
      if (!f['tk-name']) { $('#f-tk-name').focus(); toast('Enter the passenger name to issue the ticket.', 'warn', 'alert'); return; }
      const mult = { Adult: 1, Student: .6, Senior: .5, Child: .4 }[f['tk-type']];
      const bk = { id: uid('TK-'), date: localDate(), dep: tkDep, seat: tkSeat, name: f['tk-name'], type: f['tk-type'], fare: Math.round(fare * mult * 100) / 100, issued: Date.now() };
      S.bookings.push(bk); lastTicket = bk; tkSeat = null; save();
      this.render(el); toast(`Ticket issued · seat ${bk.seat}, ${fmtTime(bk.dep)}`);
    };
    if (lastTicket && lastTicket.dep === tkDep) this.showTicket(lastTicket, coach);
  },
  showTicket(bk, coach) {
    $('#tk-last').innerHTML = `<div class="ticket"><div class="t-top"><b>${esc(S.settings.operator.split(' ')[0].toUpperCase())} ${coach.id}</b><span class="mono">${bk.id}</span></div>
      <div class="t-body"><div><div class="s-l">Passenger</div><div class="s-v">${esc(bk.name)}</div></div><div><div class="s-l">Seat</div><div class="s-v">${bk.seat}</div></div>
      <div><div class="s-l">Departs</div><div class="s-v">${fmtTime(bk.dep)} · Central Stn</div></div><div><div class="s-l">Fare</div><div class="s-v">${money(bk.fare)} · ${bk.type}</div></div></div>
      <div class="t-qr"><canvas id="qr" width="25" height="25"></canvas><div style="font-size:13px" class="muted">Scan at boarding. Valid for the ${fmtTime(bk.dep)} departure only.<br><button class="btn sm" id="tk-copy" style="margin-top:8px">${icon('copy')}Copy ticket code</button></div></div></div>`;
    drawCode($('#qr'), bk.id);
    $('#tk-copy').onclick = () => copyText(bk.id, `Code ${bk.id} copied`);
  }
};
// QR-style boarding code (visual identifier, deterministic per ticket)
function drawCode(cv, text) {
  const c = cv.getContext('2d'); const N = 25; const R = rng([...text].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  c.fillStyle = '#fff'; c.fillRect(0, 0, N, N); c.fillStyle = '#0f2231';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (R() > .52) c.fillRect(x, y, 1, 1);
  const finder = (x, y) => { c.fillStyle = '#fff'; c.fillRect(x - 1, y - 1, 9, 9); c.fillStyle = '#0f2231'; c.fillRect(x, y, 7, 7); c.fillStyle = '#fff'; c.fillRect(x + 1, y + 1, 5, 5); c.fillStyle = '#0f2231'; c.fillRect(x + 2, y + 2, 3, 3); };
  finder(1, 1); finder(N - 8, 1); finder(1, N - 8);
}
function copyText(text, okMsg) {
  try { navigator.clipboard.writeText(text).then(() => toast(okMsg), () => toast('Copy was blocked here. Select the text and copy it manually.', 'warn', 'alert')); }
  catch (e) { toast('Copy was blocked here. Select the text and copy it manually.', 'warn', 'alert'); }
}

// ---- Maintenance
VIEWS.maintenance = {
  title: 'Maintenance', crumb: 'Workshop',
  render(el) {
    const cols = [['todo', 'Scheduled'], ['doing', 'In workshop'], ['done', 'Completed']];
    const dueSoon = S.buses.filter(b => b.nextService < 2500).sort((a, b) => a.nextService - b.nextService);
    const spend = S.workOrders.reduce((a, w) => a + (+w.cost || 0), 0);
    el.innerHTML = `<div class="big-stats">
        <div class="big-stat"><div class="l">Open work orders</div><div class="v">${S.workOrders.filter(w => w.status !== 'done').length}</div><div class="d">${S.workOrders.filter(w => w.status === 'doing').length} in the workshop now</div></div>
        <div class="big-stat"><div class="l">Fleet availability</div><div class="v">${S.buses.length ? Math.round(S.buses.filter(b => b.status !== 'maint' && b.status !== 'oos').length / S.buses.length * 100) : 0}%</div><div class="d">target 90%</div></div>
        <div class="big-stat"><div class="l">Service due &lt; 2,500 km</div><div class="v" style="color:var(--warn)">${dueSoon.length}</div><div class="d">${dueSoon.slice(0, 3).map(b => b.id).join(', ') || 'none'}</div></div>
        <div class="big-stat"><div class="l">Parts &amp; labour this month</div><div class="v">${moneyK(spend)}</div><div class="d">${S.workOrders.length} orders</div></div></div>
      <div class="toolbar"><span class="grow muted">${can('maint') ? 'Drag cards between columns, or use the arrows. Moving a card to “In workshop” takes the bus out of service.' : 'Read-only: the workshop and dispatch manage work orders.'}</span>${can('maint') ? `<button class="btn primary" id="wo-add">${icon('plus')}New work order</button>` : ''}</div>
      <div class="kanban">${cols.map(([k, l]) => { const items = S.workOrders.filter(w => w.status === k); return `<div class="k-col" data-col="${k}"><h3>${l}<span class="n">${items.length}</span></h3>
        ${items.map(w => { const dd = daysTo(w.due); return `<div class="wo" draggable="true" data-wo="${w.id}"><div class="row"><span class="mono muted">${w.id}</span><span class="chip nodot ${w.type === 'Corrective' ? 'crit' : w.type === 'Preventive' ? 'ok' : w.type === 'Inspection' ? 'info' : 'accent'}">${w.type}</span></div>
          <b>${esc(w.title)}</b><div class="row" style="font-size:13px"><span>${icon('bus')} ${w.busId}</span><span class="muted">· ${esc(w.mechanic)}</span></div>
          <div class="foot"><span style="color:${k !== 'done' && dd < 0 ? 'var(--crit)' : 'inherit'}">${k === 'done' ? 'Closed' : dd === 0 ? 'Due today' : dd < 0 ? `${-dd} d overdue` : `Due in ${dd} d`} · ${w.cost ? money(+w.cost) : 'quote pending'}</span>
          <span class="moves">${k !== 'todo' ? `<button data-mv="-1" aria-label="Move back">‹</button>` : ''}${k !== 'done' ? `<button data-mv="1" aria-label="Move forward">›</button>` : ''}</span></div></div>`; }).join('') || '<div class="empty" style="padding:20px">Nothing here</div>'}
      </div>`; }).join('')}</div>`;
    if (!can('maint')) { $$('.wo .moves', el).forEach(x => x.remove()); $$('.wo', el).forEach(c => { c.draggable = false; c.style.cursor = 'default'; }); return; }
    $('#wo-add').onclick = () => woModal();
    const order = ['todo', 'doing', 'done'];
    $$('.wo', el).forEach(c => {
      c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.wo); });
      $$('[data-mv]', c).forEach(b => b.onclick = e => { e.stopPropagation(); const w = S.workOrders.find(x => x.id === c.dataset.wo); moveWO(w, order[order.indexOf(w.status) + +b.dataset.mv]); });
      c.addEventListener('click', () => woModal(S.workOrders.find(x => x.id === c.dataset.wo)));
    });
    $$('.k-col', el).forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const w = S.workOrders.find(x => x.id === e.dataTransfer.getData('text/plain')); if (w) moveWO(w, col.dataset.col); });
    });
  }
};
function moveWO(w, to) {
  if (!to || w.status === to || !guard('maint')) return;
  w.status = to; const b = bus(w.busId);
  if (b) {
    if (to === 'doing' && b.status === 'service' && can('drivers.edit')) { const d = driver(b.driverId); if (d) d.status = 'standby'; }
    if (to === 'doing') b.status = 'maint';
    if (to === 'done' && b.status === 'maint' && !S.workOrders.some(x => x.busId === b.id && x.status === 'doing')) { b.status = 'depot'; if (w.type === 'Preventive') b.nextService = 15000; }
  }
  save(); route();
  toast(`${w.id} moved to ${{ todo: 'Scheduled', doing: 'In workshop', done: 'Completed' }[to]}${b && to === 'done' ? ` · ${b.id} back at depot` : ''}`);
}
function woModal(w = {}) {
  const isNew = !w.id;
  openModal({
    title: isNew ? 'New work order' : `${w.id}`,
    body: `<div class="form-grid">
      ${field({ id: 'busId', label: 'Bus', type: 'select', value: w.busId || '', options: S.buses.map(b => [b.id, `${b.id} · ${b.model}`]) })}
      ${field({ id: 'type', label: 'Type', type: 'select', value: w.type || 'Preventive', options: ['Preventive', 'Corrective', 'Inspection', 'Tyres'].map(x => [x, x]) })}
      ${field({ id: 'title', label: 'Work to do', value: w.title || '', full: true, placeholder: 'e.g. Replace rear brake pads' })}
      ${field({ id: 'mechanic', label: 'Mechanic', value: w.mechanic || 'R. Haas' })}
      ${field({ id: 'due', label: 'Due date', type: 'date', value: w.due || new Date().toISOString().slice(0, 10) })}
      ${field({ id: 'cost', label: `Estimated cost (${S.settings.currency})`, type: 'number', value: w.cost ?? '', min: 0 })}
      </div>`,
    actions: [
      ...(!isNew ? [{ label: 'Delete', kind: 'danger', onClick: () => { if (!guard('maint')) return false; S.workOrders = S.workOrders.filter(x => x !== w); save(); route(); toast(`${w.id} deleted`, 'warn'); } }] : []),
      { label: 'Cancel' },
      { label: isNew ? 'Create work order' : 'Save', kind: 'primary', onClick: m => {
        if (!guard('maint')) return false;
        if (!requireFields(m, ['title'])) return false;
        const f = readForm(m);
        if (!f.busId) { toast('Add a bus to the fleet before creating work orders.', 'warn', 'alert'); return false; }
        if (isNew) { S.workOrders.push({ id: uid('WO-'), status: 'todo', ...f, cost: +f.cost || 0 }); }
        else Object.assign(w, f, { cost: +f.cost || 0 });
        save(); if (location.hash !== '#maintenance') location.hash = 'maintenance'; else route();
        toast(isNew ? `Work order created for ${f.busId}` : 'Work order saved');
      } }
    ]
  });
}

// ---- Alerts
let alFilter = 'open';
VIEWS.alerts = {
  title: 'Alerts & incidents', crumb: 'Control room',
  render(el) {
    const list = S.alerts.filter(a => alFilter === 'all' ? true : alFilter === 'open' ? a.status !== 'resolved' : a.status === alFilter);
    const c = s => s === 'all' ? S.alerts.length : s === 'open' ? openAlerts().length : S.alerts.filter(a => a.status === s).length;
    el.innerHTML = `<div class="toolbar"><div class="seg" id="al-seg">${[['open', 'Open'], ['ack', 'Acknowledged'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => `<button data-s="${k}" class="${alFilter === k ? 'on' : ''}">${l} <span class="muted">${c(k)}</span></button>`).join('')}</div><span class="grow"></span>
      ${can('alerts.manage') ? `<button class="btn" id="al-ackall">${icon('check')}Acknowledge all</button>` : ''}${can('alerts.raise') ? `<button class="btn primary" id="al-new">${icon('plus')}Log incident</button>` : ''}</div>
      <div class="card" style="padding:0">${list.map(a => `<div class="alert-item ${a.status}"><span class="sev ${a.severity}"></span><span class="ai-ic ${a.severity}">${icon(a.severity === 'info' ? 'bell' : 'alert')}</span>
        <div style="min-width:0"><b>${esc(a.title)}</b><div class="meta">${esc(a.detail)}</div><div class="meta">${new Date(a.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${ago(a.time)}${a.busId ? ` · ${a.busId}` : ''}${a.status === 'ack' ? ' · <span style="color:var(--info)">acknowledged</span>' : a.status === 'resolved' ? ' · <span style="color:var(--ok)">resolved</span>' : ''}</div></div>
        <div class="acts">${a.busId && bus(a.busId)?.status === 'service' ? `<button class="btn sm" data-locate="${a.busId}">${icon('pin')}Locate</button>` : ''}${a.status === 'open' && can('alerts.manage') ? `<button class="btn sm" data-ack="${a.id}">Acknowledge</button>` : ''}${a.status !== 'resolved' && can('alerts.manage') ? `<button class="btn sm primary" data-res="${a.id}">Resolve</button>` : ''}</div></div>`).join('') || `<div class="empty">${icon('shield')}<div>All clear. Nothing in this list.</div></div>`}</div>`;
    $('#al-seg').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { alFilter = b.dataset.s; this.render(el); } };
    if ($('#al-new')) $('#al-new').onclick = () => incidentModal();
    if ($('#al-ackall')) $('#al-ackall').onclick = () => { S.alerts.forEach(a => { if (a.status === 'open') a.status = 'ack'; }); save(); this.render(el); updateChrome(); toast('All open alerts acknowledged'); };
    $$('[data-ack]', el).forEach(b => b.onclick = () => { S.alerts.find(a => a.id === b.dataset.ack).status = 'ack'; save(); this.render(el); updateChrome(); });
    $$('[data-res]', el).forEach(b => b.onclick = () => { S.alerts.find(a => a.id === b.dataset.res).status = 'resolved'; save(); this.render(el); updateChrome(); toast('Alert resolved'); });
    $$('[data-locate]', el).forEach(b => b.onclick = () => { mapSel = b.dataset.locate; location.hash = 'map'; });
    this.count = S.alerts.length;
  },
  tick() { if (S.alerts.length !== this.count && !$('#overlay').children.length) this.render($('#view')); }
};
function incidentModal(busId) {
  if (!guard('alerts.raise')) return;
  openModal({
    title: 'Log incident',
    body: `<div class="form-grid">
      ${field({ id: 'title', label: 'What happened', full: true, placeholder: 'e.g. Minor collision at City Hall stop' })}
      ${field({ id: 'severity', label: 'Severity', type: 'select', value: 'warning', options: [['critical', 'Critical · service affected'], ['warning', 'Warning · needs follow-up'], ['info', 'Info · for the log']] })}
      ${field({ id: 'busId', label: 'Bus involved', type: 'select', value: busId || '', options: [['', 'None'], ...S.buses.map(b => [b.id, b.id + (b.routeId ? ' · line ' + b.routeId : '')])] })}
      ${field({ id: 'detail', label: 'Details', type: 'textarea', full: true, placeholder: 'Location, people involved, actions taken' })}
    </div>`,
    actions: [{ label: 'Cancel' }, { label: 'Log incident', kind: 'primary', onClick: m => {
      if (!requireFields(m, ['title'])) return false;
      const f = readForm(m);
      raiseAlert({ severity: f.severity, title: f.title, detail: f.detail || `Logged by ${MODE === 'cloud' ? ME.full_name : 'dispatch'}.`, busId: f.busId || null, type: 'incident' });
      if (current === VIEWS.alerts) route();
    } }]
  });
}
function messageModal(b) {
  if (!guard('dispatch')) return;
  const d = driver(b.driverId);
  if (!d) { toast(`${b.id} has no driver assigned to message.`, 'warn', 'alert'); return; }
  openModal({
    title: `Message ${esc(d?.name || b.id)}`,
    body: `<div class="stop-picker" id="quick">${['Hold at next stop for 2 min', 'Skip next stop, running bunched', 'Short-turn at Central Station', 'Detour active: follow diversion signs', 'Call dispatch when safe'].map(t => `<button type="button">${t}</button>`).join('')}</div>${field({ id: 'text', label: 'Message', type: 'textarea', full: true, placeholder: 'Shows on the driver’s console' })}`,
    onMount: m => { $('#quick', m).onclick = e => { if (e.target.tagName === 'BUTTON') $('[data-f="text"]', m).value = e.target.textContent; }; },
    actions: [{ label: 'Cancel' }, { label: 'Send to driver console', kind: 'primary', icon: 'message', onClick: m => {
      const t = readForm(m).text; if (!t) { toast('Write a message or pick a quick reply.', 'warn', 'alert'); return false; }
      S.messages.unshift({ id: uid('M'), to: b.driverId, from: MODE === 'cloud' ? ME.full_name : 'Dispatch', text: t, time: Date.now() }); save();
      toast(`Sent to ${d?.name || b.id}'s console`, 'ok', 'message');
    } }]
  });
}

// ---- Reports
// Coach ticket sales, alerts and maintenance are recorded data. Boardings and on-time figures come from the
// service model that moves the buses, until a ticketing or AVL feed replaces it.
let repDays = 7;
let repCache = null; // cloud mode: grouped totals from the report_* database functions
const REP_RANGES = [[1, 'Today'], [7, '7 days'], [30, '30 days']];
const ALERT_LABEL = { delay: 'Delays', crowd: 'Crowding', fault: 'Vehicle faults', energy: 'Energy', safety: 'Safety', ops: 'Operations', detour: 'Detours', driver: 'Driver reports', other: 'Other' };
const ALERT_COLOR = { delay: 'var(--warn)', crowd: 'var(--accent)', fault: 'var(--crit)', energy: 'var(--ok)', safety: 'var(--crit)', ops: 'var(--info)', detour: 'var(--info)', driver: 'var(--accent)', other: 'var(--muted)' };
const FARE_COLOR = { Adult: 'var(--info)', Student: 'var(--accent)', Senior: 'var(--ok)', Child: 'var(--warn)' };
const repDayList = n => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1) + i); return d; });
function paxModelled(d) {
  if (dayKey(d) === localDate()) return Math.round(S.passengersToday);
  return Math.round(paxSoFar(1380) * [.55, 1, 1, 1, 1, 1.04, .7][d.getDay()] * (.94 + rand01('pax' + dayKey(d)) * .12));
}
// share of 15-minute samples within 3 min of schedule, per line, with the live map's delay model
function otpModelled(days) {
  const out = {}; const end = Date.now();
  for (const r of S.routes) {
    const buses = S.buses.filter(b => b.routeId === r.id); let ok = 0, n = 0;
    for (const d of days) for (let m = 330; m < 1380; m += 15) {
      const t = d.getTime() + m * 60000; if (t > end) break;
      for (const b of buses) { n++; if (delayAt(b.id, t / 1000) <= 3) ok++; }
    }
    out[r.id] = n ? Math.round(ok / n * 100) : null;
  }
  return out;
}
function salesFrom(bookings) {
  const m = new Map();
  for (const b of bookings) { const k = `${b.date}|${b.dep}|${b.type}`; const x = m.get(k) || { date: b.date, dep: b.dep, type: b.type, tickets: 0, revenue: 0 }; x.tickets++; x.revenue += +b.fare || 0; m.set(k, x); }
  return [...m.values()];
}
// Recorded data for the range. Demo mode reads S; signed in, earlier days come from the database (cached for a minute)
// and today's sales from S so new tickets show at once. sales is null when the role can't read bookings.
function repData(days) {
  const from = dayKey(days[0]), to = dayKey(days[days.length - 1]), today = localDate();
  if (MODE !== 'cloud') {
    const inR = k => k >= from && k <= to;
    return { sales: salesFrom(S.bookings.filter(b => inR(b.date))), alerts: S.alerts.map(a => ({ day: dayKey(new Date(a.time)), type: a.type || 'other', severity: a.severity, status: a.status, n: 1 })).filter(a => inR(a.day)) };
  }
  const key = from + to + role();
  if (!repCache || repCache.key !== key || (!repCache.loading && Date.now() - repCache.at > 60000)) repFetch(key, days, from, to);
  const c = repCache;
  return { loading: c.loading && !c.alerts, error: c.error, alerts: c.alerts, sales: c.sales && [...c.sales.filter(x => x.date !== today), ...salesFrom(bookingsToday())] };
}
async function repFetch(key, days, from, to) {
  repCache = { ...(repCache?.key === key ? repCache : { alerts: null, sales: null }), key, at: Date.now(), loading: true };
  const end = new Date(days[days.length - 1]); end.setDate(end.getDate() + 1);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    const [sa, al] = await Promise.all([
      can('tickets') ? sb.rpc('report_ticket_sales', { from_date: from, to_date: to }) : { data: null },
      sb.rpc('report_alerts', { from_ts: days[0].toISOString(), to_ts: end.toISOString(), tz })
    ]);
    const err = sa.error || al.error; if (err) throw err;
    repCache = { key, at: Date.now(), loading: false, error: null,
      sales: sa.data && sa.data.map(x => ({ date: x.dep_date, dep: x.dep, type: x.fare_type, tickets: +x.tickets, revenue: +x.revenue })),
      alerts: al.data.map(x => ({ day: x.day, type: x.type, severity: x.severity, status: x.status, n: +x.alerts })) };
  } catch (e) {
    repCache = { key, at: Date.now(), loading: false, error: e.message || 'network error', sales: null, alerts: null };
  }
  if (current === VIEWS.reports) rerender(true);
}
function downloadText(text, name, type = 'text/csv') {
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) { toast('Download was blocked here. Use Copy CSV instead.', 'warn', 'alert'); }
}
VIEWS.reports = {
  title: 'Reports', crumb: () => repDays === 1 ? 'Today' : `Last ${repDays} days`,
  render(el) {
    const days = repDayList(repDays); const one = repDays === 1; const today = localDate();
    const from = dayKey(days[0]), to = dayKey(days[days.length - 1]);
    const D = repData(days);
    const coach = S.routes.find(r => r.kind === 'coach'); const seats = coach?.seats || 44;
    const empty = (ic, txt) => `<div class="empty">${icon(ic)}<div>${txt}</div></div>`;
    const modelled = '<span class="spacer"></span><span class="chip nodot" title="From the service model until a ticketing or AVL feed is connected">Modelled</span>';
    const dayLabel = d => repDays <= 7 ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const every = repDays > 7 ? Math.ceil(repDays / 8) : 1;
    const k1 = v => v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : String(Math.round(v));
    const moneyAxis = v => S.settings.currency + k1(v);

    // boardings (modelled): per day, or per hour for today
    const pax = days.map(paxModelled); const paxTotal = pax.reduce((a, b) => a + b, 0);
    const m = nowMin();
    const paxItems = one
      ? Array.from({ length: 18 }, (_, i) => { const h = 5 + i; const v = h * 60 < m ? paxSoFar(Math.min(m, h * 60 + 60)) - paxSoFar(h * 60) : 0; return { label: pad(h), value: Math.max(0, v), color: 'var(--info)' }; })
      : days.map((d, i) => ({ label: dayLabel(d), value: pax[i], color: dayKey(d) === today ? 'var(--accent)' : 'var(--info)', showVal: repDays <= 7 }));

    // coach ticket sales (recorded)
    const sales = D.sales;
    const sum = (rows, f) => rows.reduce((a, x) => a + f(x), 0);
    const tickets = sales ? sum(sales, x => x.tickets) : 0, revenue = sales ? sum(sales, x => x.revenue) : 0;
    const deps = coachDepartures();
    const revItems = !sales ? [] : one
      ? deps.map(dp => ({ label: fmtTime(dp).slice(0, 2), value: sum(sales.filter(x => x.dep === dp), x => x.revenue), color: 'var(--accent)' }))
      : days.map(d => ({ label: dayLabel(d), value: sum(sales.filter(x => x.date === dayKey(d)), x => x.revenue), color: 'var(--accent)', showVal: repDays <= 7 }));
    const loadItems = !sales ? [] : deps.map(dp => ({ label: fmtTime(dp).slice(0, 2), value: Math.round(sum(sales.filter(x => x.dep === dp), x => x.tickets) / days.length / seats * 100), color: 'var(--accent)' }));
    const avgLoad = sales && tickets ? Math.round(tickets / (days.length * deps.length) / seats * 100) : 0;
    const fareMix = !sales ? [] : ['Adult', 'Student', 'Senior', 'Child'].map(t => ({ label: t, value: sum(sales.filter(x => x.type === t), x => x.tickets), rev: sum(sales.filter(x => x.type === t), x => x.revenue), color: FARE_COLOR[t] })).filter(x => x.value);

    // alerts (recorded)
    const al = D.alerts || [];
    const alTotal = sum(al, x => x.n), alCrit = sum(al.filter(x => x.severity === 'critical'), x => x.n), alOpen = sum(al.filter(x => x.status === 'open'), x => x.n);
    const alTypes = Object.keys(ALERT_LABEL).map(t => ({ label: ALERT_LABEL[t], value: sum(al.filter(x => (ALERT_LABEL[x.type] ? x.type : 'other') === t), x => x.n), color: ALERT_COLOR[t] })).filter(x => x.value).sort((a, b) => b.value - a.value);

    // maintenance (recorded; work orders are dated by due date)
    const wos = S.workOrders.filter(w => w.due && w.due >= from && w.due <= to);
    const done = wos.filter(w => w.status === 'done'); const spend = sum(done, w => +w.cost || 0);
    const openNow = S.workOrders.filter(w => w.status !== 'done').length;
    const woTypes = [...new Set(S.workOrders.map(w => w.type))].map(t => ({ label: t, value: sum(done.filter(w => w.type === t), w => +w.cost || 0), color: 'var(--warn)' })).filter(x => x.value).sort((a, b) => b.value - a.value);

    const otp = otpModelled(days);
    const otpItems = S.routes.filter(r => otp[r.id] != null).map(r => ({ label: `Line ${r.id}`, value: otp[r.id], color: r.color }));

    const noSales = MODE === 'cloud' && !can('tickets');
    const wait = D.loading ? empty('clock', 'Loading report data…') : D.error ? empty('alert', `Couldn’t load report data: ${esc(D.error)}. Check your connection, then reopen Reports.`) : '';
    const salesBlock = (html, none) => noSales ? empty('shield', 'Ticket sales are visible to admins and dispatchers.') : wait || (tickets ? html : empty('ticket', none));

    // CSV export
    const csv = [
      'date,boardings_modelled,coach_tickets,coach_revenue,alerts,critical_alerts,maintenance_spend',
      ...days.map((d, i) => { const k = dayKey(d); const ds = sales ? sales.filter(x => x.date === k) : null; const da = al.filter(x => x.day === k);
        return [k, pax[i], ds ? sum(ds, x => x.tickets) : '', ds ? sum(ds, x => x.revenue).toFixed(2) : '', sum(da, x => x.n), sum(da.filter(x => x.severity === 'critical'), x => x.n), sum(done.filter(w => w.due === k), w => +w.cost || 0).toFixed(2)].join(','); }),
      '', 'line,on_time_pct_modelled', ...otpItems.map(x => `${x.label.replace('Line ', '')},${x.value}`),
      ...(sales ? ['', 'fare_type,tickets,revenue', ...fareMix.map(x => `${x.label},${x.value},${x.rev.toFixed(2)}`)] : []),
      '', 'alert_type,alerts', ...alTypes.map(x => `${x.label},${x.value}`),
      '', 'job_type,completed_cost', ...woTypes.map(x => `${x.label},${x.value.toFixed(2)}`)
    ].join('\n');

    const ev = S.buses.filter(b => b.fuel === 'Electric').length;
    el.innerHTML = `<div class="toolbar"><div class="seg" id="rp-seg">${REP_RANGES.map(([n, l]) => `<button data-n="${n}" class="${repDays === n ? 'on' : ''}">${l}</button>`).join('')}</div><span class="grow"></span>
        <span class="muted" style="font-size:13px">${one ? days[0].toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[days.length - 1].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}</span></div>
      <div class="big-stats">
        <div class="big-stat"><div class="l">Boardings</div><div class="v">${fmtNum(paxTotal)}</div><div class="d">${one ? 'so far today' : `avg ${fmtNum(paxTotal / days.length)} per day`} · modelled</div></div>
        <div class="big-stat"><div class="l">Coach ticket revenue</div><div class="v">${noSales || !sales ? '—' : moneyK(revenue)}</div><div class="d">${noSales ? 'Admins and dispatchers only' : !sales ? (D.error ? 'Couldn’t load' : 'Loading…') : `${fmtNum(tickets)} tickets · ${avgLoad}% of seats sold`}</div></div>
        <div class="big-stat"><div class="l">Alerts raised</div><div class="v">${D.alerts ? fmtNum(alTotal) : '—'}</div><div class="d">${D.alerts ? `<span style="color:${alCrit ? 'var(--crit)' : 'inherit'}">${alCrit} critical</span> · ${alOpen} still open` : D.error ? 'Couldn’t load' : 'Loading…'}</div></div>
        <div class="big-stat"><div class="l">Maintenance spend</div><div class="v">${moneyK(spend)}</div><div class="d">${done.length} job${done.length === 1 ? '' : 's'} completed · ${openNow} open now</div></div></div>
      <div class="rep-grid">
        <div class="card"><div class="card-h"><h3>${one ? 'Boardings by hour' : 'Daily boardings'}</h3><span class="sub">${one ? 'today so far' : 'today is partial'}</span>${modelled}</div>${barChart({ items: paxItems, h: 240, fmt: k1, every: one ? 2 : every })}</div>
        <div class="card"><div class="card-h"><h3>Coach ticket revenue</h3><span class="sub">${coach ? `Line ${esc(coach.id)} · ${one ? 'by departure' : 'per day'}` : 'no coach line'}</span></div>${salesBlock(barChart({ items: revItems, h: 240, fmt: moneyAxis, every: one ? 2 : every }), 'No coach tickets sold in this period.')}</div>
        <div class="card"><div class="card-h"><h3>Coach seats sold by departure</h3><span class="sub">average share of ${seats} seats${one ? ', today' : ' per day'}</span></div>${salesBlock(barChart({ items: loadItems, h: 220, fmt: v => Math.round(v) + '%', every: 2 }), 'No coach tickets sold in this period.')}</div>
        <div class="card"><div class="card-h"><h3>Tickets by fare type</h3></div>${salesBlock(`<div class="donut-wrap">${donut(fareMix, 160, fmtNum(tickets), 'tickets')}<div class="legend">${fareMix.map(i => `<span><span style="display:inline-flex;gap:6px;align-items:center"><i style="background:${i.color}"></i>${i.label}</span><b style="white-space:nowrap">${fmtNum(i.value)} <span class="muted" style="font-weight:500">${moneyK(i.rev)}</span></b></span>`).join('')}</div></div>`, 'No coach tickets sold in this period.')}</div>
        <div class="card"><div class="card-h"><h3>Alerts by type</h3><span class="sub">${D.alerts ? `${fmtNum(alTotal)} raised` : ''}</span></div>${wait || (alTypes.length ? hbarChart({ items: alTypes }) : empty('check', 'No alerts raised in this period.'))}</div>
        <div class="card"><div class="card-h"><h3>Maintenance cost by job type</h3><span class="sub">completed work orders, by due date</span></div>${woTypes.length ? hbarChart({ items: woTypes, fmt: v => moneyK(v) }) : empty('wrench', 'No work orders completed in this period.')}</div>
        <div class="card"><div class="card-h"><h3>On-time performance by line</h3><span class="sub">share of time within 3 min</span>${modelled}</div>${otpItems.length ? hbarChart({ items: otpItems, max: 100, fmt: v => v + '%' }) : empty('route', 'No buses are assigned to lines.')}</div>
        <div class="card"><div class="card-h"><h3>Fleet energy mix</h3><span class="sub">current fleet</span></div>${(() => { const mix = ['Electric', 'Diesel', 'CNG', 'Hydrogen'].map((f, i) => ({ label: f, value: S.buses.filter(b => b.fuel === f).length, color: ['var(--ok)', 'var(--muted)', 'var(--info)', 'var(--accent)'][i] })).filter(x => x.value); return `<div class="donut-wrap">${donut(mix, 160, (S.buses.length ? Math.round(ev / S.buses.length * 100) : 0) + '%', 'electric')}<div class="legend">${mix.map(i => `<span><span style="display:inline-flex;gap:6px;align-items:center"><i style="background:${i.color}"></i>${i.label}</span><b>${i.value}</b></span>`).join('')}</div></div>`; })()}</div>
      </div>
      <p class="muted" style="font-size:13px;margin:0">Coach ticket sales, alerts and maintenance are your recorded data. Boardings and on-time performance come from the service model until a ticketing or GPS/AVL feed is connected.</p>
      <div class="card"><div class="card-h"><h3>Export</h3><span class="sub">CSV for spreadsheets or your BI tool</span><span class="spacer"></span><button class="btn" id="rp-copy">${icon('copy')}Copy</button><button class="btn primary" id="rp-dl">${icon('download')}Download CSV</button></div><pre class="mono" style="margin:0;max-height:160px;overflow:auto;background:var(--surface-2);padding:12px;border-radius:10px;user-select:all">${esc(csv)}</pre></div>`;
    $$('#rp-seg [data-n]', el).forEach(b => b.onclick = () => { repDays = +b.dataset.n; route(); });
    $('#rp-copy').onclick = () => copyText(csv, 'CSV copied to clipboard');
    $('#rp-dl').onclick = () => downloadText(csv, `headway-report-${from}_${to}.csv`);
  }
};

// ---- Driver app (the phone experience)
let daDriver = null;
const CHECK_ITEMS = ['Tyres and wheel nuts', 'Lights and indicators', 'Doors and ramp', 'Mirrors and cameras', 'Fire extinguisher, first-aid kit'];
VIEWS.driverapp = {
  title: () => role() === 'driver' ? 'My shift' : 'Driver app',
  crumb: () => role() === 'driver' ? 'Driver console' : 'Mobile preview',
  render(el) {
    if (role() === 'driver') {
      daDriver = ME?.driver_id || null;
      el.innerHTML = `<div class="driver-stage solo"><div class="phone"><div class="phone-screen" id="da-screen"></div></div></div>`;
      return this.screen();
    }
    const onDuty = S.drivers.filter(d => d.status === 'duty' && bus(d.busId)?.status === 'service');
    if (!daDriver || !onDuty.find(d => d.id === daDriver)) daDriver = onDuty[0]?.id;
    el.innerHTML = `<div class="driver-stage">
      <div class="card" style="display:flex;flex-direction:column;gap:14px">
        <div class="card-h" style="margin:0"><h3>The same platform, in the driver's cab</h3></div>
        <p style="margin:0;max-width:62ch" class="muted">This is what a driver sees when they sign in with the Driver role on a phone or in-cab tablet. Messages sent from the live map arrive here, issues reported here land in the control room alerts, and the pre-trip check is stored per shift.</p>
        ${field({ id: 'da-d', label: 'Preview as driver', type: 'select', value: daDriver, options: onDuty.map(d => [d.id, `${d.name} · ${d.busId}`]) })}
        <div class="legend"><span>${icon('message')} Two-way messaging</span><span>${icon('shield')} Pre-trip safety check</span><span>${icon('alert')} One-tap issue reporting</span><span>${icon('clock')} Live headway status</span></div>
      </div>
      <div class="phone"><div class="phone-screen" id="da-screen"></div></div></div>`;
    $('#f-da-d').onchange = e => { daDriver = e.target.value; this.screen(); };
    this.screen();
  },
  screen() {
    const box = $('#da-screen'); if (!box) return;
    const d = driver(daDriver);
    if (!d) {
      box.innerHTML = `<div class="empty" style="padding:60px 20px">${icon('user')}<div>${role() === 'driver' ? 'Your account isn’t linked to a driver record yet. Ask an admin to link it under Preferences, Team & roles.' : 'No drivers on duty.'}</div></div>`;
      return;
    }
    const b = bus(d.busId); const r = b && routeOf(b.routeId);
    const msgs = S.messages.filter(m => m.to === d.id).sort((x, y) => y.time - x.time).slice(0, 3);
    const t = new Date();
    const status = `<div class="ph-status"><span>${pad(t.getHours())}:${pad(t.getMinutes())}</span><span>5G ▮▮▮ 82%</span></div>`;
    const msgCard = `<div class="ph-next"><div class="eyebrow" style="display:flex;justify-content:space-between"><span>Messages from dispatch</span><span>${msgs.length}</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${msgs.map(m => `<div class="msg">${esc(m.text)}<time>${esc(m.from)} · ${ago(m.time)}</time></div>`).join('') || '<span class="muted" style="font-size:13px">No messages yet.</span>'}</div></div>`;
    if (!b || b.status !== 'service' || !r) {
      box.innerHTML = `${status}<div class="ph-head"><div class="who">${avatar(d)}<div><b>${esc(d.name)}</b><br><small>${DSTATUS[d.status].label}</small></div></div></div>
        <div class="ph-body"><div class="ph-next"><div class="eyebrow">This shift</div><div class="stop" style="font-size:24px">No bus assigned right now</div><p class="muted" style="margin:6px 0 0">Dispatch assigns your vehicle. It appears here as soon as they do.</p></div>${msgCard}</div>`;
      return;
    }
    const ns = nextStops(b, 4);
    const sh = shiftOf(d.id) || { checklist: {}, onTrip: true };
    const ck = sh.checklist || {}; const done = CHECK_ITEMS.filter(i => ck[i]).length; const tripOn = sh.onTrip !== false;
    const mayReport = can('alerts.raise'); const mayShift = MODE === 'local' || can('dispatch') || ME?.driver_id === d.id;
    box.innerHTML = `${status}
      <div class="ph-head"><div class="who">${avatar(d)}<div><b>${esc(d.name)}</b><br><small>${b.id} · ${esc(b.plate)}</small></div><span style="margin-left:auto">${bullet(r.id, true)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>to <b>${esc(terminusOf(b))}</b></span><span>${b.delay > 2 ? `<b style="color:#ff9b7a">+${b.delay} min late</b>` : '<b style="color:#6fe0ae">On schedule</b>'}</span></div></div>
      <div class="ph-body">
        <div class="ph-next"><div class="eyebrow">Next stop · ${ns[0]?.eta ?? '—'} min</div><div class="stop">${esc(ns[0]?.stop.name || 'Terminus')}</div>
          <div class="next-stops" style="--route:${r.color};margin-top:10px">${ns.slice(1).map(n => `<div style="font-weight:400">${esc(n.stop.name)}<time>${n.eta} min</time></div>`).join('')}</div></div>
        <div class="ph-btns">
          ${mayShift ? `<button class="ph-btn ${tripOn ? 'stop' : 'go'}" id="da-trip">${icon(tripOn ? 'pause' : 'play')}${tripOn ? 'End trip' : 'Start trip'}</button>` : ''}
          ${mayReport ? `<button class="ph-btn" data-issue="Passenger needs assistance">${icon('user')}Passenger help</button>
          <button class="ph-btn" data-issue="Vehicle fault reported by driver">${icon('wrench')}Vehicle fault</button>
          <button class="ph-btn" data-issue="Traffic blockage ahead">${icon('alert')}Road blocked</button>
          <button class="ph-btn" data-issue="Security incident on board" style="color:var(--crit)">${icon('shield')}Emergency</button>` : ''}
        </div>
        ${msgCard}
        <div class="ph-next"><div class="eyebrow" style="display:flex;justify-content:space-between"><span>Pre-trip check</span><span>${done}/${CHECK_ITEMS.length}</span></div><div class="bar" style="margin:8px 0"><i style="width:${done / CHECK_ITEMS.length * 100}%"></i></div>
          ${CHECK_ITEMS.map((it, i) => `<label class="check-row"><input type="checkbox" id="ck-${i}" data-ck="${esc(it)}" ${ck[it] ? 'checked' : ''} ${mayShift ? '' : 'disabled'}>${esc(it)}</label>`).join('')}</div>
      </div>`;
    $('#da-trip')?.addEventListener('click', () => { setShift(d.id, { onTrip: !tripOn }); save(); this.screen(); toast(tripOn ? `${d.name} ended the trip` : `${d.name} started the trip`, 'ok', tripOn ? 'pause' : 'play'); });
    $$('[data-issue]', box).forEach(btn => btn.onclick = () => { const crit = btn.dataset.issue.startsWith('Security'); raiseAlert({ severity: crit ? 'critical' : 'warning', title: btn.dataset.issue, detail: `Reported from the cab by ${d.name} near ${ns[0]?.stop.name || 'terminus'}.`, busId: b.id, type: 'driver' }); });
    $$('[data-ck]', box).forEach(c => c.onchange = () => { setShift(d.id, { checklist: { ...ck, [c.dataset.ck]: c.checked } }); save(); this.screen(); });
  },
  tick() { if (Math.random() < .25 && !$('#da-screen input:focus')) this.screen(); }
};

// ---- Preferences: account, team, workspace
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const avatarMe = (cls = '') => `<span class="avatar ${cls}" style="background:${AV_COLORS[hashStr(ME?.id || 'x') % AV_COLORS.length]}">${esc(initials(ME?.full_name || ME?.email || '?').toUpperCase())}</span>`;
VIEWS.preferences = {
  title: 'Preferences', crumb: 'Account & workspace',
  render(el) {
    const theme = getTheme(); const admin = can('settings'); const cloud = MODE === 'cloud';
    const segOpts = (id, opts, cur, attr) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-${attr}="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${admin || attr === 't' ? '' : 'disabled'}>${l}</button>`).join('')}</div>`;
    el.innerHTML = `<div class="card"><div class="card-h"><h3>Account</h3></div>
      ${cloud ? `<div class="acct">${avatarMe('lg')}<div style="flex:1;min-width:180px"><b>${esc(ME.full_name || ME.email)}</b><div class="muted">${esc(ME.email || '')}</div></div><span class="chip accent nodot">${ROLE_LABEL[ME.role]}</span><button class="btn" id="pf-out">${icon('logout')}Sign out</button></div>
        <p class="muted" style="margin:12px 0 0">${ROLE_HINT[ME.role]}.</p>`
      : `<div class="acct"><span class="avatar lg" style="background:var(--muted)">${icon('user')}</span><div style="flex:1;min-width:180px"><b>Demo mode</b><div class="muted">Sample data that stays in this browser only.</div></div>${sb ? `<button class="btn primary" id="pf-in">${icon('cloud')}Sign in to team workspace</button>` : ''}</div>`}
    </div>
    ${cloud && can('team') ? `<div class="card"><div class="card-h"><h3>Team &amp; roles</h3></div>
      <p class="muted" style="margin:-6px 0 14px;max-width:75ch">Teammates create their own account on the sign-in page and start as Viewer. Set their role here, and link drivers to their driver record so their shift shows in the driver app. Changes apply on their screen right away.</p>
      <div id="pf-team"><div class="muted">Loading team…</div></div></div>` : ''}
    <div class="card"><div class="card-h"><h3>Workspace</h3>${!admin ? '<span class="sub">Only admins can change workspace settings.</span>' : ''}</div><div class="settings-list">
      <div class="set-row"><div class="txt"><b>Operator name</b><span>Shown on tickets and the dashboard greeting.</span></div>${admin ? `<input class="input" id="pf-op" style="max-width:320px" value="${esc(S.settings.operator)}">` : `<b>${esc(S.settings.operator)}</b>`}</div>
      <div class="set-row"><div class="txt"><b>Appearance</b><span>Follow the device, or pick light or dark. Saved on this device only.</span></div>${segOpts('pf-theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], theme, 't')}</div>
      <div class="set-row"><div class="txt"><b>Currency symbol</b><span>Used for fares, revenue and work-order costs.</span></div>${segOpts('pf-cur', ['€', '$', '£', '₺'].map(c => [c, c]), S.settings.currency, 'c')}</div>
      <div class="set-row"><div class="txt"><b>Simulation speed</b><span>Bus movement is simulated until you connect AVL/GPS feeds. Every signed-in screen uses the same speed.</span></div>${segOpts('pf-speed', [.5, 1, 2, 4].map(s => [s, s + '×']), S.settings.speed, 's')}</div>
      <div class="set-row"><div class="txt"><b>Install as an app</b><span>Add Headway to the home screen or desktop.</span></div><button class="btn" id="pf-install">${icon('download')}Install</button></div>
      ${!cloud ? `<div class="set-row"><div class="txt"><b>Reset demo data</b><span>Restores the sample fleet, drivers, bookings and alerts in this browser. Your changes are lost.</span></div><div id="pf-reset-box"><button class="btn danger" id="pf-reset">Reset data</button></div></div>` : ''}
    </div></div>
    <div class="card"><div class="card-h"><h3>Ready for mobile</h3></div><p class="muted" style="margin:0;max-width:70ch">One responsive web app: a sidebar on desktop, a bottom tab bar on phones, safe-area aware, touch-friendly with pinch-zoom on the map. It installs as a PWA today and wraps with Capacitor for the App Store and Google Play without a rewrite.</p></div>`;
    $('#pf-out')?.addEventListener('click', signOut);
    $('#pf-in')?.addEventListener('click', toSignIn);
    $('#pf-op')?.addEventListener('change', e => { if (!guard('settings')) return; S.settings.operator = e.target.value.trim() || 'Transit operator'; save(); toast('Operator name saved'); });
    $('#pf-theme').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { setTheme(b.dataset.t); this.render(el); } };
    $('#pf-cur').onclick = e => { const b = e.target.closest('[data-c]'); if (b && guard('settings')) { S.settings.currency = b.dataset.c; save(); this.render(el); } };
    $('#pf-speed').onclick = e => { const b = e.target.closest('[data-s]'); if (!b || !guard('settings')) return; S.settings.speed = +b.dataset.s; save(); this.render(el); toast(`Simulation at ${b.dataset.s}×`, 'ok', 'play'); };
    $('#pf-install').onclick = async () => { if (installEvt) { installEvt.prompt(); installEvt = null; } else toast('Use your browser menu: “Install app” or “Add to Home Screen”.', 'info', 'download'); };
    $('#pf-reset')?.addEventListener('click', () => {
      $('#pf-reset-box').innerHTML = `<div class="inline-confirm">Erase all changes?<button class="btn sm" id="pf-no">Keep</button><button class="btn sm primary" id="pf-yes">Reset</button></div>`;
      $('#pf-no').onclick = () => this.render(el);
      $('#pf-yes').onclick = () => { store.clear(); S = seedState(); TRIPS = buildTrips(); save(); mapSel = null; lastTicket = null; route(); toast('Demo data restored'); };
    });
    if (cloud && can('team')) this.team();
  },
  async team() {
    if (!$('#pf-team')) return;
    const { data, error } = await sb.from('profiles').select('*').order('created_at');
    const box = $('#pf-team'); if (!box) return;
    if (error) { box.innerHTML = `<div class="muted">Couldn’t load the team: ${esc(error.message)}</div>`; return; }
    this.people = data;
    box.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Person</th><th>Role</th><th>Linked driver record</th><th>Joined</th></tr></thead><tbody>
      ${data.map(p => `<tr style="cursor:default"><td><b>${esc(p.full_name || '—')}</b>${p.id === ME.id ? ' <span class="chip nodot">You</span>' : ''}<div class="muted" style="font-size:12.5px">${esc(p.email || '')}</div></td>
        <td><select class="input" id="role-${p.id}" data-role="${p.id}" aria-label="Role for ${esc(p.full_name || p.email)}" style="min-width:140px">${Object.keys(ROLE_LABEL).map(r => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select></td>
        <td><select class="input" id="link-${p.id}" data-link="${p.id}" aria-label="Driver record for ${esc(p.full_name || p.email)}" style="min-width:190px"><option value="">Not a driver</option>${S.drivers.map(d => `<option value="${d.id}" ${p.driver_id === d.id ? 'selected' : ''}>${esc(d.name)} · ${d.id}</option>`).join('')}</select></td>
        <td>${new Date(p.created_at).toLocaleDateString('en-GB')}</td></tr>`).join('')}
    </tbody></table></div>`;
    $$('[data-role]', box).forEach(s => s.onchange = () => this.updatePerson(s.dataset.role, { role: s.value }, s));
    $$('[data-link]', box).forEach(s => s.onchange = () => this.updatePerson(s.dataset.link, { driver_id: s.value || null }, s));
  },
  async updatePerson(id, patch, ctl) {
    const p = this.people.find(x => x.id === id); const who = p.full_name || p.email;
    if (patch.role && p.role === 'admin' && patch.role !== 'admin' && this.people.filter(x => x.role === 'admin').length === 1) {
      toast('Keep at least one admin. Make someone else admin first.', 'warn', 'shield'); ctl.value = 'admin'; return;
    }
    const { error } = await sb.from('profiles').update(patch).eq('id', id);
    if (error) { toast(`Couldn’t update ${who}: ${error.message}`, 'crit', 'alert'); this.team(); return; }
    Object.assign(p, patch);
    toast(patch.role ? `${who} is now ${ROLE_LABEL[patch.role]}` : patch.driver_id ? `${who} linked to ${driver(patch.driver_id)?.name}` : `${who} unlinked from driver record`, 'ok', 'shield');
    if (patch.role === 'driver' && !p.driver_id) toast(`Link ${who} to their driver record so their shift shows up.`, 'info', 'user');
  }
};

// ---- First sign-in to an empty database
let setupSkipped = false;
const needsSetup = () => MODE === 'cloud' && !setupSkipped && !S.routes.length && !S.buses.length;
VIEWS.setup = {
  title: 'Set up your workspace', crumb: 'Welcome',
  render(el) {
    const admin = can('team');
    el.innerHTML = `<div class="card setup">
      <div class="eyebrow">${icon('cloud')} Connected to your team database</div>
      <h2>Your workspace is empty</h2>
      ${admin ? `<p>Start from a complete sample network with 6 lines, 24 buses, 28 drivers, work orders and coach bookings, then edit it into your own operation. Or start empty and add your lines, fleet and drivers yourself.</p>
        <div class="toolbar"><button class="btn primary" id="su-sample">${icon('cloud')}Load sample network</button><button class="btn" id="su-empty">Start empty</button></div>`
      : `<p>An admin hasn’t set up the network yet. When they do, it appears here automatically.</p>`}
    </div>`;
    if (!admin) return;
    $('#su-sample').onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Saving sample data…';
      const seed = seedState();
      for (const k of ['routes', 'drivers', 'buses', 'alerts', 'workOrders', 'bookings', 'messages']) S[k] = seed[k];
      TRIPS = buildTrips(); simulate();
      await sync();
      route(); toast('Sample network saved to your database');
    };
    $('#su-empty').onclick = () => { setupSkipped = true; location.hash = 'routes'; route(); };
  }
};

// ---------------------------------------------------------------- theme
function getTheme() { try { return localStorage.getItem('headway.theme') || 'system'; } catch (e) { return 'system'; } }
function setTheme(t) {
  try { localStorage.setItem('headway.theme', t); } catch (e) {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  updateChrome();
}
const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };

// ---------------------------------------------------------------- shell
const NAV = [
  ['Operate', [['dashboard', 'Overview', 'grid'], ['map', 'Live map', 'map'], ['schedule', 'Schedule', 'calendar'], ['alerts', 'Alerts', 'bell']]],
  ['Assets', [['fleet', 'Fleet', 'bus'], ['routes', 'Lines & stops', 'route'], ['drivers', 'Drivers', 'users'], ['maintenance', 'Maintenance', 'wrench']]],
  ['Business', [['tickets', 'Coach tickets', 'ticket'], ['reports', 'Reports', 'chart']]],
  ['Apps', [['driverapp', 'Driver app', 'phone'], ['preferences', 'Preferences', 'sliders']]]
];
const tabsFor = () => role() === 'driver'
  ? [['driverapp', 'My shift', 'phone'], ['map', 'Map', 'map'], ['schedule', 'Schedule', 'calendar'], ['alerts', 'Alerts', 'bell']]
  : [['dashboard', 'Overview', 'grid'], ['map', 'Map', 'map'], ['fleet', 'Fleet', 'bus'], ['alerts', 'Alerts', 'bell']];
let TABS = tabsFor();
const navName = (k, l) => k === 'driverapp' && role() === 'driver' ? 'My shift' : l;

function shell() {
  TABS = tabsFor();
  const cloud = MODE === 'cloud';
  $('#app').innerHTML = `<div class="shell">
    <aside class="rail" aria-label="Main navigation">
      <a class="brand" href="#${homeView()}"><span class="brand-mark">${icon('bus')}</span><span><b>HEADWAY</b><small>Bus operations</small></span></a>
      ${NAV.map(([g, items]) => { const vis = items.filter(([k]) => allowedView(k)); return vis.length ? `<nav class="nav-group"><div class="nav-label">${g}</div>${vis.map(([k, l, ic]) => `<a class="nav-item" href="#${k}" data-nav="${k}">${icon(ic)}${navName(k, l)}${k === 'alerts' ? '<span class="count" id="nav-al"></span>' : ''}</a>`).join('')}</nav>` : ''; }).join('')}
      <div class="rail-foot"><span>Service clock</span><span class="clock" id="rail-clock">--:--</span><span id="rail-sim"></span>
        ${cloud ? `<div class="rail-user">${avatarMe()}<div class="ru-txt"><b>${esc(ME.full_name || ME.email)}</b><span>${ROLE_LABEL[ME.role]}</span></div><button class="icon-btn" id="rail-out" aria-label="Sign out" title="Sign out">${icon('logout')}</button></div>`
          : `<div class="rail-user"><div class="ru-txt"><b>Demo mode</b><span>Data stays in this browser</span></div>${sb ? '<button class="btn sm" id="rail-in">Sign in</button>' : ''}</div>`}
      </div>
    </aside>
    <div class="main">
      <header class="topbar"><div class="title"><div class="crumb" id="tb-crumb"></div><h1 id="tb-title"></h1></div>
        <div class="top-actions">
          <span class="mode-pill" id="tb-mode"></span>
          <span class="sim-pill" id="tb-sim" hidden>${icon('clock')}Simulated day</span>
          <button class="searchbox" id="tb-search" aria-label="Search">${icon('search')}<span>Search buses, drivers, lines</span><kbd>Ctrl K</kbd></button>
          <button class="icon-btn" id="tb-bell" aria-label="Notifications">${icon('bell')}<span class="dot" id="tb-dot" hidden></span></button>
          <button class="icon-btn" id="tb-theme" aria-label="Toggle theme"></button>
          ${cloud ? `<a class="icon-btn me-btn" href="#preferences" aria-label="Account" title="${esc(ME.full_name || '')} · ${ROLE_LABEL[ME.role]}">${avatarMe('sm')}</a>` : ''}
        </div></header>
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Tabs">${TABS.map(([k, l, ic]) => `<a href="#${k}" data-tab="${k}">${icon(ic)}${l}${k === 'alerts' ? '<span class="badge" id="tab-al"></span>' : ''}</a>`).join('')}<a href="#more" id="tab-more" data-tab="more">${icon('more')}More</a></nav>
  </div>`;
  $('#tb-search').onclick = palette;
  $('#tb-bell').onclick = bellPopover;
  $('#tb-theme').onclick = () => setTheme(isDark() ? 'light' : 'dark');
  $('#tab-more').onclick = e => { e.preventDefault(); moreSheet(); };
  $('#rail-out')?.addEventListener('click', signOut);
  $('#rail-in')?.addEventListener('click', toSignIn);
}
function moreSheet() {
  const all = NAV.flatMap(([, items]) => items).filter(([k]) => allowedView(k) && !TABS.some(t => t[0] === k));
  $('#overlay').innerHTML = `<div class="backdrop sheet-backdrop"><div class="sheet" role="dialog" aria-label="More"><div class="grab"></div><div class="sheet-grid">${all.map(([k, l, ic]) => `<a href="#${k}">${icon(ic)}${navName(k, l)}</a>`).join('')}</div>
    ${MODE === 'cloud' ? `<div class="sheet-user">${avatarMe()}<div class="ru-txt"><b>${esc(ME.full_name || ME.email)}</b><span>${ROLE_LABEL[ME.role]}</span></div><button class="btn sm" id="sheet-out">${icon('logout')}Sign out</button></div>` : ''}</div></div>`;
  $('.backdrop').onclick = e => { if (e.target.classList.contains('backdrop') || e.target.closest('a')) closeOverlay(); };
  $('#sheet-out')?.addEventListener('click', signOut);
  document.addEventListener('keydown', escClose);
}
function bellPopover() {
  if ($('.popover')) { closeOverlay(); return; }
  const list = openAlerts().slice(0, 6);
  $('#overlay').innerHTML = `<div class="popover" role="dialog" aria-label="Notifications"><div class="card-h" style="margin-bottom:6px"><h3>Notifications</h3><span class="spacer"></span><button class="btn sm ghost" data-go="alerts">See all</button></div>
    <div class="feed">${list.map(a => `<div class="feed-item"><span class="sev ${a.severity}"></span><div><b>${esc(a.title)}</b><span class="meta">${esc(a.detail)}</span></div><time>${ago(a.time)}</time></div>`).join('') || '<div class="empty">You are all caught up.</div>'}</div></div>`;
  setTimeout(() => document.addEventListener('click', function off(e) { if (!e.target.closest('.popover') && !e.target.closest('#tb-bell')) { closeOverlay(); document.removeEventListener('click', off); } }), 0);
  $('.popover [data-go]').addEventListener('click', closeOverlay);
}
function palette() {
  const items = [
    ...NAV.flatMap(([, it]) => it).filter(([k]) => allowedView(k)).map(([k, l, ic]) => ({ k: 'page', label: navName(k, l), ic, go: () => { location.hash = k; } })),
    ...S.buses.map(b => ({ k: 'bus', label: `${b.id} · ${b.plate} · ${b.model}`, ic: 'bus', go: () => { if (b.status === 'service') { mapSel = b.id; location.hash = 'map'; } else if (allowedView('fleet')) { location.hash = 'fleet'; setTimeout(() => busModal(b), 50); } } })),
    ...(allowedView('drivers') ? S.drivers.map(d => ({ k: 'driver', label: `${d.name} · ${d.id}`, ic: 'user', go: () => { location.hash = 'drivers'; setTimeout(() => driverModal(d), 50); } })) : []),
    ...S.routes.map(r => ({ k: 'line', label: `Line ${r.id} · ${r.name}`, ic: 'route', go: () => { location.hash = allowedView('routes') ? 'routes' : 'map'; } })),
    ...STOPS.map(s => ({ k: 'stop', label: s.name, ic: 'pin', go: () => { location.hash = 'map'; setTimeout(() => VIEWS.map.pz?.focus(s.x, s.y), 60); } }))
  ];
  $('#overlay').innerHTML = `<div class="backdrop palette"><div class="box" role="dialog" aria-label="Search"><div class="in">${icon('search')}<input id="pal-q" placeholder="Jump to a bus, driver, line, stop or page" autocomplete="off"></div><ul id="pal-l"></ul></div></div>`;
  let sel = 0; let shown = [];
  const draw = () => {
    const q = $('#pal-q').value.toLowerCase().trim();
    shown = items.filter(i => !q || i.label.toLowerCase().includes(q)).slice(0, 40); sel = Math.min(sel, Math.max(0, shown.length - 1));
    $('#pal-l').innerHTML = shown.map((i, n) => `<li class="${n === sel ? 'on' : ''}" data-i="${n}">${icon(i.ic)}${esc(i.label)}<small>${i.k}</small></li>`).join('') || '<li class="muted">No matches</li>';
  };
  const go = i => { if (!shown[i]) return; closeOverlay(); shown[i].go(); };
  $('#pal-q').oninput = () => { sel = 0; draw(); };
  $('#pal-q').onkeydown = e => {
    if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter') go(sel);
  };
  $('#pal-l').onclick = e => { const li = e.target.closest('[data-i]'); if (li) go(+li.dataset.i); };
  $('.palette').onclick = e => { if (e.target.classList.contains('palette')) closeOverlay(); };
  document.addEventListener('keydown', escClose);
  draw(); $('#pal-q').focus();
}
function updateChrome() {
  if (!S) return;
  const n = openAlerts().length;
  const set = (el, v) => { if (el) { el.textContent = v || ''; el.hidden = !v; } };
  set($('#nav-al'), n); set($('#tab-al'), n); set($('#tb-dot'), n);
  const m = nowMin();
  if ($('#rail-clock')) $('#rail-clock').textContent = fmtTime(m) + ':' + pad(new Date().getSeconds());
  const sim = inSimulatedHours();
  if ($('#tb-sim')) $('#tb-sim').hidden = !sim;
  if ($('#rail-sim')) $('#rail-sim').textContent = sim ? `Simulated service day · ${S.settings.speed}×` : `Live service clock · sim ${S.settings.speed}×`;
  const mode = $('#tb-mode');
  if (mode) {
    const st = MODE === 'cloud' ? (LIVE ? ['ok', 'Live · synced'] : ['warn', 'Connecting…']) : ['', 'Demo data'];
    mode.className = `mode-pill ${st[0]}`; mode.textContent = st[1];
  }
  if ($('#tb-theme')) $('#tb-theme').innerHTML = icon(isDark() ? 'sun' : 'moon');
}

// ---------------------------------------------------------------- sign-in
const loadingHtml = msg => `<div class="auth-loading">${icon('bus')}<span>${esc(msg)}</span></div>`;
const authMsg = e => {
  const m = e?.message || '';
  if (/invalid login/i.test(m)) return 'That email and password don’t match an account.';
  if (/not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/already registered/i.test(m)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute, then try again.';
  if (/fetch|network/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
  return esc(m || 'Something went wrong. Try again.');
};
function authScreen(mode = 'signin', note = '', isErr = false) {
  closeOverlay(); current = null;
  const T = {
    signin: ['Sign in', 'Sign in to your team’s operations console.', 'Sign in'],
    signup: ['Create your account', 'New accounts start as Viewer until an admin assigns a role.', 'Create account'],
    reset: ['Reset your password', 'Enter your email and we’ll send you a link to choose a new password.', 'Send reset link'],
    newpw: ['Choose a new password', 'Use at least 8 characters.', 'Save password']
  }[mode];
  $('#app').innerHTML = `<div class="auth">
    <section class="auth-brand">
      <div class="brand"><span class="brand-mark">${icon('bus')}</span><span><b>HEADWAY</b><small>Bus operations</small></span></div>
      <div class="auth-pitch"><h1>Every bus, every driver, one console.</h1><p>Live fleet tracking, dispatch, workshop and ticketing, shared with your whole team in real time.</p></div>
      <div class="board auth-board" aria-hidden="true">
        ${[['12', '#e4572e', 'Science Park', '2 min'], ['27', '#13998a', 'Airport', '6 min'], ['X1', '#b8741a', 'Airport Express', '14 min']].map(([id, c, d, t]) => `<div class="board-row"><span class="line-bullet" style="background:${c}">${id}</span><span class="dest">${d}</span><span class="due">${t}</span></div>`).join('')}
      </div>
    </section>
    <section class="auth-main">
      <form class="auth-card" id="auth-form" novalidate>
        <h2>${T[0]}</h2><p class="muted auth-lead">${T[1]}</p>
        ${note ? `<div class="auth-note ${isErr ? 'err' : ''}" role="status">${note}</div>` : ''}
        ${mode === 'signup' ? field({ id: 'name', label: 'Full name', placeholder: 'e.g. Amara Okafor' }) : ''}
        ${mode !== 'newpw' ? field({ id: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com' }) : ''}
        ${mode !== 'reset' ? field({ id: 'password', label: mode === 'newpw' ? 'New password' : 'Password', type: 'password', hint: mode === 'signup' ? 'At least 8 characters' : '' }) : ''}
        <button class="btn primary auth-submit" type="submit" id="auth-go">${T[2]}</button>
        <div class="auth-links">
          ${mode === 'signin' ? `<button type="button" class="link" data-mode="reset">Forgot password?</button><span>New here? <button type="button" class="link" data-mode="signup">Create an account</button></span>` : ''}
          ${mode === 'signup' || mode === 'reset' ? `<span>Have an account? <button type="button" class="link" data-mode="signin">Sign in</button></span>` : ''}
        </div>
        ${mode !== 'newpw' ? `<div class="auth-or"><span>or</span></div><button type="button" class="btn auth-demo" id="auth-demo">${icon('play')}Explore the demo without an account</button>` : ''}
      </form>
    </section></div>`;
  $('#f-email')?.setAttribute('autocomplete', 'email');
  $('#f-name')?.setAttribute('autocomplete', 'name');
  $('#f-password')?.setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
  $$('[data-mode]').forEach(b => b.onclick = () => authScreen(b.dataset.mode));
  $('#auth-demo')?.addEventListener('click', startLocal);
  $('#auth-form').onsubmit = async e => {
    e.preventDefault();
    const f = readForm(e.target); const btn = $('#auth-go');
    const fail = msg => {
      btn.disabled = false; btn.textContent = T[2];
      let n = $('.auth-note'); if (!n) { n = document.createElement('div'); $('.auth-lead').after(n); }
      n.className = 'auth-note err'; n.setAttribute('role', 'alert'); n.innerHTML = msg;
    };
    if (mode !== 'newpw' && !/^\S+@\S+\.\S+$/.test(f.email || '')) return fail('Enter a valid email address.');
    if ((mode === 'signup' || mode === 'newpw') && (f.password || '').length < 8) return fail('Use a password of at least 8 characters.');
    if (mode === 'signin' && !f.password) return fail('Enter your password.');
    btn.disabled = true; btn.textContent = 'Please wait…';
    try {
      const back = location.origin + location.pathname;
      if (mode === 'signin') { const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password }); if (error) throw error; return startCloud(); }
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name || f.email.split('@')[0] }, emailRedirectTo: back } });
        if (error) throw error;
        if (data.session) return startCloud();
        return authScreen('signin', `<b>Check your inbox.</b> We sent a confirmation link to ${esc(f.email)}. Open it, then sign in here.`);
      }
      if (mode === 'reset') { const { error } = await sb.auth.resetPasswordForEmail(f.email, { redirectTo: back }); if (error) throw error; return authScreen('signin', `If ${esc(f.email)} has an account, a reset link is on its way.`); }
      if (mode === 'newpw') { const { error } = await sb.auth.updateUser({ password: f.password }); if (error) throw error; toast('Password updated'); return startCloud(); }
    } catch (err) { fail(authMsg(err)); }
  };
}

// ---------------------------------------------------------------- start-up
function teardownCloud() {
  if (channel && sb) { sb.removeChannel(channel); channel = null; }
  clearTimeout(syncTimer);
  LIVE = false; MODE = 'local'; ME = null; S = null; current = null; snap = {}; setupSkipped = false; mapSel = null; lastTicket = null;
}
async function startCloud() {
  $('#app').innerHTML = loadingHtml('Loading your workspace…');
  try {
    const { data: { user }, error: ue } = await sb.auth.getUser();
    if (ue || !user) return authScreen('signin');
    const { data: prof, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    teardownCloud();
    ME = prof; MODE = 'cloud';
    await loadCloud();
    subscribeCloud();
    startApp();
  } catch (e) {
    teardownCloud();
    authScreen('signin', `<b>Couldn’t load your workspace.</b> ${authMsg(e)}`, true);
  }
}
function startLocal() {
  teardownCloud();
  S = store.load(); if (!S || S.v !== 2) S = seedState();
  TRIPS = buildTrips(); simulate(); startApp();
}
function startApp() { shell(); route(); }
async function signOut() { teardownCloud(); try { await sb.auth.signOut(); } catch (e) {} authScreen('signin', 'You are signed out.'); }
function toSignIn() { if (S && MODE === 'local') store.save(S); teardownCloud(); authScreen('signin'); }

// ---------------------------------------------------------------- router + loop
let current = null;
function route() {
  if (!S || !$('#view')) return;
  const name = location.hash.slice(1);
  let key = VIEWS[name] && name !== 'setup' ? name : homeView();
  if (!allowedView(key)) key = homeView();
  if (needsSetup() && key !== 'preferences') key = 'setup';
  current = VIEWS[key];
  closeOverlay();
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === key));
  $$('[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === key || (a.dataset.tab === 'more' && !TABS.some(t => t[0] === key))));
  const val = v => typeof v === 'function' ? v() : v;
  $('#tb-title').textContent = val(current.title); $('#tb-crumb').textContent = val(current.crumb);
  document.title = `${val(current.title)} · Headway`;
  const v = $('#view'); v.innerHTML = ''; current.render(v);
  updateChrome();
}
function globalListeners() {
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && S && $('#tb-search')) { e.preventDefault(); palette(); } });
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && S && !e.target.closest('.bus-m')) { location.hash = g.dataset.go; } });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-go],.bus-card')) e.target.click(); });
  window.addEventListener('hashchange', () => { if (!S || !$('#view')) return; route(); window.scrollTo(0, 0); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', updateChrome);
  setInterval(() => { if (!S || !current) return; simulate(); try { current.tick?.(); } catch (e) { console.error(e); } updateChrome(); }, 1000);
  setInterval(() => { if (S && MODE === 'local') save(); }, 5000);
  window.addEventListener('pagehide', () => { if (S && MODE === 'local') store.save(S); });
}
async function boot() {
  const t = getTheme(); if (t !== 'system') document.documentElement.setAttribute('data-theme', t);
  globalListeners();
  if (!sb) return startLocal();
  const params = new URLSearchParams(location.hash.slice(1));
  const linkErr = params.get('error_description');
  const recovering = params.get('type') === 'recovery';
  sb.auth.onAuthStateChange(ev => {
    if (ev === 'PASSWORD_RECOVERY') setTimeout(() => authScreen('newpw'), 0);
    if (ev === 'SIGNED_OUT' && MODE === 'cloud') { teardownCloud(); authScreen('signin', 'You have been signed out.'); }
  });
  $('#app').innerHTML = loadingHtml('Checking your sign-in…');
  let session = null;
  try { session = (await sb.auth.getSession()).data.session; } catch (e) { /* offline: show sign-in */ }
  if (linkErr) history.replaceState(null, '', location.pathname);
  if (session && recovering) return authScreen('newpw');
  if (session) return startCloud();
  authScreen('signin', linkErr ? esc(linkErr) : '', !!linkErr);
}
boot();
})();
