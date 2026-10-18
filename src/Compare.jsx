import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { properties, plazaFor, airbnbFor, cityOfProperty } from "./data.js";
import { calcMortgage, money } from "./mortgage.js";

const byId = (id) => properties.find((p) => p.id === id);

function metrics(p, rate) {
  const m = calcMortgage({ price: p.price, rate: rate.rate30, hoaMonthly: p.hoaMonthly });
  const plaza = plazaFor(p.id);
  const bnb = airbnbFor(p, [cityOfProperty(p)]).stats;
  const nightly = bnb.similarAvgPerNight ?? bnb.avgPerNight;
  const gross = bnb.estAnnualGross;
  return {
    price: p.price,
    ppsf: Math.round(p.price / p.sqft),
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    year: p.yearBuilt,
    hoa: p.hoaMonthly,
    monthly: Math.round(m.total),
    cash: Math.round(m.cashToClose),
    plazaName: plaza.plaza.name,
    driveMi: plaza.driveMiles ?? plaza.straightMiles,
    driveMin: plaza.driveMinutes,
    straight: plaza.straightMiles,
    nightly,
    occ: bnb.occupancyUsed,
    gross,
    yield: gross ? gross / p.price : null,
    net: gross != null ? Math.round(gross - m.total * 12) : null,
    airbnbCount: bnb.priced,
  };
}

// dir: "low" = lower wins, "high" = higher wins, null = no winner
const ROWS = [
  ["Price", "price", money, "low", "Price used"],
  ["Price / sqft", "ppsf", (v) => money(v), "low"],
  ["Bedrooms", "beds", (v) => v, "high"],
  ["Bathrooms", "baths", (v) => v, "high"],
  ["Living area (sqft)", "sqft", (v) => v.toLocaleString(), "high"],
  ["Year built", "year", (v) => v, "high"],
  ["HOA / month", "hoa", (v) => (v ? money(v) : "None"), "low"],
  ["Est. monthly payment", "monthly", money, "low", "P&I + tax + insurance + HOA"],
  ["Cash to close", "cash", money, "low", "20% down + $10K fees"],
  ["Drive to grocer / plaza", "driveMi", (v) => `${v} mi`, "low"],
  ["Drive time", "driveMin", (v) => (v ? `${v} min` : "—"), "low"],
  ["Airbnb avg / night (same city)", "nightly", money, "high", "similar-size where known"],
  ["Est. occupancy / year", "occ", (v) => (v != null ? `${Math.round(v * 100)}%` : "—"), "high"],
  ["Est. gross Airbnb income / yr", "gross", money, "high"],
  ["Gross yield on price", "yield", (v) => (v != null ? `${(v * 100).toFixed(1)}%` : "—"), "high"],
  ["Gross income − 12 mo. payments", "net", (v) => (v == null ? "—" : `${v < 0 ? "-" : ""}${money(Math.abs(v))}`), "high", "before cleaning, fees, taxes, vacancy"],
];

function Pick({ value, onChange, other, label }) {
  return (
    <div className="cmp-pick">
      <div className="muted tiny">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {properties.map((p) => (
          <option key={p.id} value={p.id} disabled={p.id === other}>{p.label}</option>
        ))}
      </select>
    </div>
  );
}

function Head({ p }) {
  return (
    <div className="cmp-head">
      <img src={p.photo} alt="" referrerPolicy="no-referrer" />
      <div>
        <b>{p.address}</b>
        <div className="muted tiny">{p.status} · {p.community}</div>
        <a href={p.zillowUrl} target="_blank" rel="noreferrer" className="tiny link">Zillow ↗</a>
      </div>
    </div>
  );
}

export default function Compare({ a, b, setA, setB, rate }) {
  const pa = byId(a), pb = byId(b);
  const ma = useMemo(() => metrics(pa, rate), [pa, rate]);
  const mb = useMemo(() => metrics(pb, rate), [pb, rate]);

  return (
    <div className="compare">
      <div className="cmp-picks">
        <Pick label="Property A" value={a} onChange={setA} other={b} />
        <button className="btn ghost swap" onClick={() => { setA(b); setB(a); }} title="Swap">⇄</button>
        <Pick label="Property B" value={b} onChange={setB} other={a} />
      </div>

      <motion.div className="card cmp-table" key={a + b} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="cmp-row cmp-top">
          <div />
          <Head p={pa} />
          <Head p={pb} />
        </div>
        {ROWS.map(([label, key, fmt, dir, hint], i) => {
          const va = ma[key], vb = mb[key];
          let wa = false, wb = false;
          if (dir && va != null && vb != null && va !== vb) {
            const aWins = dir === "high" ? va > vb : va < vb;
            wa = aWins; wb = !aWins;
          }
          const cell = (v, w, m) => (
            <div className={`cmp-val ${w ? "win" : ""}`}>
              {v == null ? "—" : fmt(v)}
              {w && <span className="crown">✓</span>}
            </div>
          );
          return (
            <motion.div className="cmp-row" key={key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <div className="cmp-label">{label}{hint && <small>{hint}</small>}</div>
              {cell(va, wa)}
              {cell(vb, wb)}
            </motion.div>
          );
        })}
        <div className="cmp-row">
          <div className="cmp-label">Nearest grocer / plaza</div>
          <div className="cmp-val">{ma.plazaName}</div>
          <div className="cmp-val">{mb.plazaName}</div>
        </div>
        <div className="cmp-row">
          <div className="cmp-label">STR status</div>
          <div className="cmp-val small">{pa.str}</div>
          <div className="cmp-val small">{pb.str}</div>
        </div>
        <div className="cmp-row">
          <div className="cmp-label">Amenities</div>
          <div className="cmp-val small tags">{pa.amenities.map((x) => <span key={x}>{x}</span>)}</div>
          <div className="cmp-val small tags">{pb.amenities.map((x) => <span key={x}>{x}</span>)}</div>
        </div>
      </motion.div>
      <p className="muted tiny">
        Uses the default assumptions (20% down + $10K fees, 30-yr at {rate.rate30}%, 2% property tax, $105/mo insurance) and the same-city Airbnb set. A green ✓ marks the better value in each row.
        Income figures are rough estimates from a static Airbnb snapshot; adjust the details on the Single property tab.
      </p>
    </div>
  );
}
