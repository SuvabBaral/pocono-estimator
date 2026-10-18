// One-off: spends the remaining StayAPI budget and bakes everything into server/data/static.json.
// Run once:  node server/prefetch.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(dir, "..", ".env"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const KEY = process.env.STAYAPI_KEY;
const CACHE = path.join(dir, "data", "cache.json");
const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));

// Real usage on the StayAPI dashboard was 4 when this ran (2 were made before the app counted).
const HARD_LIMIT = 49; // never exceed (limit 50)
if (!cache.realUsage) cache.realUsage = 4 + (cache.usage - 2);
const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache));

const CHECK_IN = "2026-11-13", CHECK_OUT = "2026-11-15", NIGHTS = 2;
const EXTRA_SEARCHES = ["Pocono Farms, PA", "Pocono Summit, PA", "Mount Pocono, PA", "Blakeslee, PA"];
const DEEP_LISTINGS = 20; // listings that get overview (beds/baths) + 12-month calendar = 2 requests each

async function stay(p, params = {}) {
  if (cache.realUsage >= HARD_LIMIT) throw new Error("budget guard");
  cache.realUsage++;
  save();
  const u = new URL("https://api.stayapi.com" + p);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { "X-API-Key": KEY } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.detail || j.title || ""}`);
  return j;
}
const num = (s) => { const n = Number(String(s || "").replace(/[^0-9.]/g, "")); return n > 0 ? n : null; };

// 1) more searches -> more listings
cache.pool = cache.pool || {};
const known = Object.values(cache.search); // searches already paid for
for (const q of EXTRA_SEARCHES) {
  const key = `${q}|${CHECK_IN}|${CHECK_OUT}`;
  if (cache.search[key]) continue;
  try {
    const d = await stay("/v1/airbnb/search", { location: q, check_in: CHECK_IN, check_out: CHECK_OUT, adults: 2, currency: "USD" });
    cache.search[key] = {
      location: q,
      listings: (d.listings || []).map((l) => {
        const total = l.price_applies_to_requested_dates ? num(l.displayed_price) : null;
        return { id: String(l.listing_id), url: l.url, title: l.title, name: l.name || l.title, image: l.image_url, rating: l.rating_display || null, total, perNight: total ? Math.round(total / NIGHTS) : null };
      }),
    };
    save();
    console.log("search", q, cache.search[key].listings.length, "used", cache.realUsage);
  } catch (e) { console.log("search failed", q, e.message); }
}

// 2) merge into one regional pool
const pool = new Map();
for (const s of Object.values(cache.search)) for (const l of s.listings) {
  const prev = pool.get(l.id);
  if (!prev || (!prev.perNight && l.perNight)) pool.set(l.id, { ...l, area: s.location });
}
const reviews = (l) => Number((l.rating || "").match(/\((\d+)\)/)?.[1] || 0);
console.log("pool size", pool.size, "priced", [...pool.values()].filter((l) => l.perNight).length);

// 3) deepen the most-reviewed priced listings (established listings => reliable occupancy)
cache.overview = cache.overview || {};
cache.calendar = cache.calendar || {};
const targets = [...pool.values()].filter((l) => l.perNight).sort((a, b) => reviews(b) - reviews(a)).slice(0, DEEP_LISTINGS);
for (const l of targets) {
  if (cache.realUsage >= HARD_LIMIT - 1) break;
  try {
    if (!cache.overview[l.id]) {
      const d = await stay(`/v1/airbnb/listing/${l.id}/overview`);
      const o = d.overview || {};
      cache.overview[l.id] = { bedrooms: o.bedrooms ?? null, beds: o.beds ?? null, baths: o.baths ?? null, guests: o.guests ?? null, kind: o.title || null };
      save();
    }
    if (!cache.calendar[l.id] && cache.realUsage < HARD_LIMIT) {
      const d = await stay(`/v1/airbnb/listing/${l.id}/calendar`, { months: 12 });
      const days = (d.months || []).flatMap((m) => m.days || []);
      if (!days.length) throw new Error("calendar had no days");
      const blocked = days.filter((x) => !x.available).length;
      cache.calendar[l.id] = { days: days.length, unavailable: blocked, occupancy: Number((blocked / days.length).toFixed(3)), from: days[0].date, to: days[days.length - 1].date };
      save();
    }
    console.log("ok", l.id, JSON.stringify(cache.overview[l.id]), cache.calendar[l.id]?.occupancy, "used", cache.realUsage);
  } catch (e) {
    console.log("fail", l.id, e.message);
    if (e.message === "budget guard") break;
  }
}

// 4) bake static dataset (3 properties; Lyman excluded)
const props = JSON.parse(fs.readFileSync(path.join(dir, "data", "properties.json"), "utf8")).filter((p) => p.id !== "lyman");
const listings = [...pool.values()].map((l) => ({ ...l, ...(cache.overview[l.id] || {}), occupancy: cache.calendar[l.id]?.occupancy ?? null }));
const out = {
  generatedAt: new Date().toISOString(),
  dates: { checkIn: CHECK_IN, checkOut: CHECK_OUT, nights: NIGHTS },
  rate: cache.rate,
  stayApiUsed: cache.realUsage,
  searchedAreas: Object.values(cache.search).map((s) => s.location),
  calendarWindow: Object.values(cache.calendar)[0] ? { from: Object.values(cache.calendar)[0].from, to: Object.values(cache.calendar)[0].to } : null,
  properties: props,
  plaza: Object.fromEntries(props.map((p) => [p.id, cache.plaza[p.id]])),
  listings,
};
fs.writeFileSync(path.join(dir, "data", "static.json"), JSON.stringify(out, null, 1));
console.log("static.json written:", listings.length, "listings,", listings.filter((l) => l.occupancy != null).length, "with occupancy. StayAPI used:", cache.realUsage);
