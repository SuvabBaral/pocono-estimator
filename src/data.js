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

export const cityOfListing = (l) => {
  const m = (l.kind || l.title || "").match(/ in (.+?)(, Pennsylvania)?$/);
  return m ? m[1].trim() : "Unknown";
};
export const cityOfProperty = (p) => p.address.split(",")[1].trim();

const ALL = S.listings.map((l) => ({ ...l, city: cityOfListing(l) }));
const regionDeep = ALL.filter((l) => l.occupancy != null);

// cities: array of city names to include (null/undefined = all)
export function airbnbFor(p, cities) {
  const cityCounts = {};
  for (const l of ALL) cityCounts[l.city] = (cityCounts[l.city] || 0) + 1;
  const cityList = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  const sel = cities ? new Set(cities) : null;
  const near = (l) => l.bedrooms != null && l.baths != null && Math.abs(l.bedrooms - p.beds) <= 2 && Math.abs(l.baths - p.baths) <= 1;
  const listings = ALL.filter((l) => !sel || sel.has(l.city)).map((l) => ({ ...l, similar: near(l) }));
  const priced = listings.filter((l) => l.perNight);
  const similarPriced = priced.filter((l) => l.similar);
  const deep = listings.filter((l) => l.occupancy != null);
  const similarDeep = deep.filter((l) => l.similar);
  const regionSimilar = regionDeep.filter(near);

  // occupancy: prefer selected cities (similar size, then any size) if >= 3 samples, else region-wide
  let occ, occBasis, occN;
  if (similarDeep.length >= 3) { occ = avgF(similarDeep.map((l) => l.occupancy)); occBasis = "similar-size listings in selected cities"; occN = similarDeep.length; }
  else if (deep.length >= 3) { occ = avgF(deep.map((l) => l.occupancy)); occBasis = "all analysed listings in selected cities"; occN = deep.length; }
  else { occ = avgF(regionSimilar.map((l) => l.occupancy)); occBasis = "regional fallback (too few analysed listings in the selected cities)"; occN = regionSimilar.length; }

  const rateAll = avg(priced.map((l) => l.perNight));
  // need >= 3 similar-size priced listings, otherwise one outlier (e.g. a $765 mansion) skews it
  const rateSim = similarPriced.length >= 3 ? avg(similarPriced.map((l) => l.perNight)) : null;
  const r = rateSim ?? rateAll;
  return {
    dates: S.dates,
    generatedAt: S.generatedAt,
    searchedAreas: S.searchedAreas,
    calendarWindow: S.calendarWindow,
    cityList,
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
      occupancyUsed: occ,
      occupancyBasis: occBasis,
      occupancySamples: occN,
      estAnnualGross: occ != null && r ? Math.round(r * 365 * occ) : null,
    },
  };
}
