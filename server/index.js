// Static-data API: everything was fetched once (server/prefetch.mjs) and baked into data/static.json.
// No live StayAPI calls are made here, so the 50-request free quota can't be consumed by using the app.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 3001);
const S = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "static.json"), "utf8"));
const byId = Object.fromEntries(S.properties.map((p) => [p.id, p]));

const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null);
const avgF = (a, d = 3) => (a.length ? Number((a.reduce((s, x) => s + x, 0) / a.length).toFixed(d)) : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

function airbnbFor(p) {
  const listings = S.listings.map((l) => ({
    ...l,
    similar: l.bedrooms != null && l.baths != null && Math.abs(l.bedrooms - p.beds) <= 2 && Math.abs(l.baths - p.baths) <= 1,
  }));
  const priced = listings.filter((l) => l.perNight);
  const deep = listings.filter((l) => l.occupancy != null);
  const similarDeep = deep.filter((l) => l.similar);
  const similarPriced = priced.filter((l) => l.similar);
  const occAll = avgF(deep.map((l) => l.occupancy));
  const occSim = avgF(similarDeep.map((l) => l.occupancy));
  const rateSim = avg(similarPriced.map((l) => l.perNight));
  const rateAll = avg(priced.map((l) => l.perNight));
  const occ = occSim ?? occAll;
  const rate = rateSim ?? rateAll;
  return {
    dates: S.dates,
    generatedAt: S.generatedAt,
    searchedAreas: S.searchedAreas,
    calendarWindow: S.calendarWindow,
    listings,
    stats: {
      total: listings.length,
      priced: priced.length,
      avgPerNight: rateAll,
      medianPerNight: median(priced.map((l) => l.perNight)),
      minPerNight: priced.length ? Math.min(...priced.map((l) => l.perNight)) : null,
      maxPerNight: priced.length ? Math.max(...priced.map((l) => l.perNight)) : null,
      enriched: deep.length,
      similarCount: similarDeep.length,
      similarPricedCount: similarPriced.length,
      similarAvgPerNight: rateSim,
      similarMedianPerNight: median(similarPriced.map((l) => l.perNight)),
      occupancyAll: occAll,
      occupancySimilar: occSim,
      occupancyUsed: occ,
      estAnnualGross: occ != null && rate ? Math.round(rate * 365 * occ) : null,
    },
  };
}

const app = express();
app.get("/api/properties", (_req, res) => res.json(S.properties));
app.get("/api/mortgage-rate", (_req, res) => res.json(S.rate));
app.get("/api/usage", (_req, res) => res.json({ used: S.stayApiUsed, max: 50, dates: S.dates }));
app.get("/api/properties/:id/plaza", (req, res) => (S.plaza[req.params.id] ? res.json(S.plaza[req.params.id]) : res.status(404).json({ error: "unknown property" })));
app.get("/api/properties/:id/airbnb", (req, res) => (byId[req.params.id] ? res.json(airbnbFor(byId[req.params.id])) : res.status(404).json({ error: "unknown property" })));

const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.listen(PORT, () => console.log(`API on http://localhost:${PORT} (static data from ${S.generatedAt}, StayAPI used ${S.stayApiUsed}/50)`));
