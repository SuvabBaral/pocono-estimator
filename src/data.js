import S from "./data/static.json";

const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null);
const avgF = (a, d = 3) => (a.length ? Number((a.reduce((s, x) => s + x, 0) / a.length).toFixed(d)) : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

export const properties = S.properties;
export const rate = S.rate;
export const usage = { used: S.stayApiUsed, max: 50 };
export const plazaFor = (id) => S.plaza[id];

export function airbnbFor(p) {
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
  const r = rateSim ?? rateAll;
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
      similarAvgPerNight: rateSim,
      occupancyAll: occAll,
      occupancySimilar: occSim,
      occupancyUsed: occ,
      estAnnualGross: occ != null && r ? Math.round(r * 365 * occ) : null,
    },
  };
}
