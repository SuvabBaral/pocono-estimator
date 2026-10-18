import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PropertyMap from "./PropertyMap.jsx";
import { calcMortgage, money } from "./mortgage.js";
import { properties, rate as RATE, usage as USAGE, plazaFor, airbnbFor, cityOfProperty } from "./data.js";
import Compare from "./Compare.jsx";

const fade = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

function Card({ title, icon, children, delay = 0, className = "" }) {
  return (
    <motion.section className={`card ${className}`} {...fade} transition={{ duration: 0.45, delay }}>
      <h3>
        <span className="ico">{icon}</span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

function CountUp({ value, prefix = "$" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (value == null) return;
    let raf;
    const t0 = performance.now();
    const from = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      setV(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return value == null ? "—" : `${prefix}${v.toLocaleString()}`;
}

function Skeleton({ h = 90 }) {
  return <div className="skeleton" style={{ height: h }} />;
}

function Hero({ p }) {
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => setImgOk(true), [p.id]);
  return (
    <motion.div className="hero" {...fade} transition={{ duration: 0.5 }}>
      <div className="hero-img">
        {imgOk ? (
          <motion.img
            key={p.photo}
            src={p.photo}
            alt={p.address}
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
            initial={{ scale: 1.12, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        ) : (
          <div className="img-fallback">🏡</div>
        )}
        <span className={`badge ${p.status === "For sale" ? "sale" : "off"}`}>{p.status}</span>
      </div>
      <div className="hero-body">
        <h2>{p.address}</h2>
        <div className="price">
          <CountUp value={p.price} />
          {p.status !== "For sale" && <small> Zestimate</small>}
        </div>
        {p.priceNote && <p className="note">{p.priceNote}</p>}
        <div className="chips">
          <span>🛏 {p.beds} bd</span>
          <span>🛁 {p.baths} ba</span>
          <span>📐 {p.sqft.toLocaleString()} sqft</span>
          <span>🏗 {p.yearBuilt}</span>
          <span>🌳 {p.lot}</span>
        </div>
        <div className="kv">
          <div><b>HOA</b><span>{p.hoaMonthly ? `${money(p.hoaMonthly)}/mo` : "None listed"}</span></div>
          <div><b>Type</b><span>{p.type}</span></div>
          <div><b>Community</b><span>{p.community}</span></div>
          <div><b>Short-term rental</b><span>{p.str}</span></div>
          {p.mls && <div><b>MLS</b><span>#{p.mls}</span></div>}
        </div>
        <a className="btn" href={p.zillowUrl} target="_blank" rel="noreferrer">View on Zillow ↗</a>
      </div>
    </motion.div>
  );
}

function Mortgage({ p, rate }) {
  const [price, setPrice] = useState(p.price);
  const [down, setDown] = useState(20);
  const [fees, setFees] = useState(10000);
  const [years, setYears] = useState(30);
  const [rateIn, setRateIn] = useState(rate?.rate30 ?? 7);
  const [taxPct, setTaxPct] = useState(2);
  const [ins, setIns] = useState(105);
  useEffect(() => setPrice(p.price), [p.id]);
  useEffect(() => { if (rate) setRateIn(years === 15 ? Math.max(0, +(rate.rate30 - 0.7).toFixed(2)) : rate.rate30); }, [rate, years]);
  const m = useMemo(
    () => calcMortgage({ price, downPct: down, extraFees: fees, rate: rateIn, years, taxRatePct: taxPct, insuranceMonthly: ins, hoaMonthly: p.hoaMonthly }),
    [price, down, fees, rateIn, years, taxPct, ins, p.hoaMonthly]
  );
  const parts = [
    ["Principal & interest", m.pi, "#6366f1"],
    ["Property tax", m.tax, "#06b6d4"],
    ["Insurance", m.insurance, "#f59e0b"],
    ["HOA", m.hoa, "#ec4899"],
  ];
  return (
    <Card title="Mortgage estimate" icon="🏦" delay={0.1}>
      <div className="big-row">
        <div>
          <div className="muted">Estimated monthly payment</div>
          <div className="big"><CountUp value={Math.round(m.total)} /></div>
        </div>
        <div>
          <div className="muted">Cash needed at closing</div>
          <div className="big alt"><CountUp value={Math.round(m.cashToClose)} /></div>
          <div className="muted tiny">{down}% down + {money(fees)} fees</div>
        </div>
      </div>
      <div className="stack">
        {parts.map(([l, v, c]) => (
          <motion.div key={l} layout style={{ background: c }} animate={{ flexGrow: Math.max(v, 1) }} transition={{ type: "spring", stiffness: 120, damping: 20 }} title={`${l}: ${money(v)}`} />
        ))}
      </div>
      <ul className="legend">
        {parts.map(([l, v, c]) => (
          <li key={l}><i style={{ background: c }} />{l}<b>{money(v)}</b></li>
        ))}
      </ul>
      <div className="muted tiny">
        Loan {money(m.loan)} · Rate {rateIn}% ({rate ? `${rate.source}${rate.asOf ? `, ${rate.asOf}` : ""}` : "…"}) · Total interest over {years} yrs {money(m.totalInterest)}
      </div>
      <details>
        <summary>Adjust assumptions</summary>
        <div className="form">
          <label>Price<input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} /></label>
          <label>Down %<input type="number" value={down} onChange={(e) => setDown(+e.target.value)} /></label>
          <label>Extra fees $<input type="number" value={fees} onChange={(e) => setFees(+e.target.value)} /></label>
          <label>Rate %<input type="number" step="0.01" value={rateIn} onChange={(e) => setRateIn(+e.target.value)} /></label>
          <label>Term
            <select value={years} onChange={(e) => setYears(+e.target.value)}><option value={30}>30 yr</option><option value={15}>15 yr</option></select>
          </label>
          <label>Tax %/yr<input type="number" step="0.1" value={taxPct} onChange={(e) => setTaxPct(+e.target.value)} /></label>
          <label>Insurance $/mo<input type="number" value={ins} onChange={(e) => setIns(+e.target.value)} /></label>
        </div>
        <p className="muted tiny">Property tax (~2%/yr is typical for Monroe/Lackawanna Co., PA) and insurance are placeholders: Zillow's figures looked like defaults, so verify them.</p>
      </details>
    </Card>
  );
}

function Plaza({ state, p }) {
  return (
    <Card title="Nearest grocer / plaza" icon="🛒" delay={0.15}>
      {state.loading && <Skeleton h={300} />}
      {state.error && <p className="err">Could not load map data: {state.error}</p>}
      {state.data && (
        <>
          <div className="big-row">
            <div>
              <div className="muted">{state.data.plaza.name}</div>
              <div className="big"><CountUp value={state.data.driveMiles ?? state.data.straightMiles} prefix="" /> <small>mi{state.data.driveMiles ? " by road" : ""}</small></div>
            </div>
            <div>
              <div className="muted">Drive time</div>
              <div className="big alt">{state.data.driveMinutes ? `${state.data.driveMinutes} min` : "—"}</div>
              <div className="muted tiny">{state.data.straightMiles} mi straight line</div>
            </div>
          </div>
          <p className="muted tiny">
            {state.data.plaza.eateriesNearby > 0
              ? `${state.data.plaza.eateriesNearby} restaurant(s)/cafés within ~0.25 mi${state.data.plaza.eateryNames.length ? `: ${state.data.plaza.eateryNames.join(", ")}` : ""}`
              : "No restaurants mapped right next to it; nearest grocer shown."}
          </p>
          {state.data.home.approx && <p className="note">Exact address isn't in OpenStreetMap: pin placed on the street, so distances are approximate (±0.5 mi).</p>}
          <PropertyMap property={p} plaza={state.data} />
        </>
      )}
    </Card>
  );
}

function Airbnb({ p }) {
  const [onlySimilar, setOnlySimilar] = useState(false);
  const home = cityOfProperty(p);
  const [cities, setCities] = useState([home]); // default: same city as the property
  const d = useMemo(() => airbnbFor(p, cities), [p, cities]);
  const state = {};
  const allNames = d.cityList.map((c) => c.name);
  const allOn = cities.length === allNames.length;
  const toggle = (name) => setCities((cs) => (cs.includes(name) ? cs.filter((c) => c !== name) : [...cs, name]));
  const rows = useMemo(() => {
    if (!d) return [];
    let r = onlySimilar ? d.listings.filter((l) => l.similar) : d.listings;
    return [...r].sort((a, b) => (a.perNight ?? 1e9) - (b.perNight ?? 1e9));
  }, [d, onlySimilar]);
  const maxP = d?.stats.maxPerNight || 1;
  const s = d?.stats;
  return (
    <Card title="Nearby Airbnb listings" icon="🏠" className="wide" delay={0.2}>
      {state.loading && <Skeleton h={220} />}
      {state.error && <p className="err">{state.error}</p>}
      {d && (
        <>
          <div className="stats">
            <div><div className="muted">Avg / night (all priced)</div><div className="big"><CountUp value={s.avgPerNight} /></div><div className="muted tiny">{s.priced} priced of {s.total} listings · median {money(s.medianPerNight)} · range {money(s.minPerNight)}–{money(s.maxPerNight)}</div></div>
            <div>
              <div className="muted">Avg / night (similar beds & baths)</div>
              <div className="big good">{s.similarAvgPerNight ? <CountUp value={s.similarAvgPerNight} /> : "—"}</div>
              <div className="muted tiny">{s.similarPricedCount} priced listings match ±2 bd, ±1 ba of {p.beds}bd/{p.baths}ba{s.similarAvgPerNight ? "" : " (need 3+ with known size; select more cities)"}</div>
            </div>
            <div>
              <div className="muted">Est. occupancy / year</div>
              <div className="big alt">{s.occupancyUsed != null ? `${Math.round(s.occupancyUsed * 100)}%` : "—"}</div>
              <div className="muted tiny">{s.occupancySamples} listings analysed: {s.occupancyBasis}</div>
            </div>
            <div>
              <div className="muted">Rough gross rent / year</div>
              <div className="big">{s.estAnnualGross != null ? <CountUp value={s.estAnnualGross} /> : "—"}</div>
              <div className="muted tiny">avg nightly × 365 × occupancy (before fees, cleaning, taxes)</div>
            </div>
          </div>
          <div className="cities">
            <button className={`chip ${allOn ? "on" : ""}`} onClick={() => setCities(allOn ? [home] : allNames)}>All ({d.cityList.reduce((a, c) => a + c.count, 0)})</button>
            {d.cityList.map((c) => (
              <button key={c.name} className={`chip ${cities.includes(c.name) ? "on" : ""}`} onClick={() => toggle(c.name)}>
                {c.name === home ? "📍 " : ""}{c.name} ({c.count})
              </button>
            ))}
          </div>
          <div className="toolbar">
            <label className="switch"><input type="checkbox" checked={onlySimilar} onChange={(e) => setOnlySimilar(e.target.checked)} /> Only similar size</label>
            <span className="muted tiny">
              Static snapshot ({new Date(d.generatedAt).toLocaleDateString()}), no live calls. Nightly = Airbnb total for {d.dates.nights} nights ({d.dates.checkIn} → {d.dates.checkOut}, 2 guests, a peak weekend) ÷ {d.dates.nights}, fees included.
              Occupancy = share of the next 12 months ({d.calendarWindow?.from} → {d.calendarWindow?.to}) that is booked or host-blocked, measured on the {s.enriched} most-reviewed listings. Future calendars are under-booked this far out, so treat it as a rough floor.
              Searched areas: {d.searchedAreas.join(" · ")}. Highlighted rows are similar in size.
            </span>
          </div>
          <div className="table">
            <AnimatePresence initial={false}>
              {rows.map((l, i) => (
                <motion.a layout key={l.id} href={l.url} target="_blank" rel="noreferrer" className={`row ${l.similar ? "similar" : ""}`} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
                  <img src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  <div className="info">
                    <b>{l.name}</b>
                    <span className="muted tiny">{l.kind || l.title}{l.rating ? ` · ★ ${l.rating}` : ""}{l.bedrooms != null ? ` · ${l.bedrooms} bd / ${l.baths} ba · ${l.guests} guests` : ""}</span>
                    {l.perNight && <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(l.perNight / maxP) * 100}%` }} transition={{ duration: 0.7 }} /></div>}
                  </div>
                  <div className="nightly">
                    {l.perNight ? <>{money(l.perNight)}<small>/night</small></> : <small>no price</small>}
                    {l.occupancy != null && <div className="occ">{Math.round(l.occupancy * 100)}% occupied/yr</div>}
                  </div>
                </motion.a>
              ))}
            </AnimatePresence>
            {!rows.length && <p className="muted">No listings match.</p>}
          </div>
        </>
      )}
    </Card>
  );
}

function Amenities({ p }) {
  return (
    <Card title="Amenities & highlights" icon="✨" delay={0.05}>
      <div className="tags">
        {p.amenities.map((a, i) => (
          <motion.span key={a} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.04 * i }}>{a}</motion.span>
        ))}
      </div>
    </Card>
  );
}

function History({ p }) {
  return (
    <Card title="History & market data" icon="📈" delay={0.08}>
      <ul className="hist">
        {p.history.map((h) => (
          <li key={h.label}><span>{h.label}</span><b>{h.value}</b></li>
        ))}
      </ul>
      <p className="muted tiny">Zillow's full price/tax history table isn't exposed without logging in, so open the Zillow link for it.</p>
    </Card>
  );
}

export default function App() {
  const props = properties;
  const rate = RATE;
  const usage = USAGE;
  const [sel, setSel] = useState("");
  const p = props.find((x) => x.id === sel);
  const plaza = useMemo(() => (p ? { data: plazaFor(p.id) } : {}), [p]);
  const [mode, setMode] = useState("single");
  const [cmpA, setCmpA] = useState(properties[0].id);
  const [cmpB, setCmpB] = useState(properties[1].id);

  return (
    <div className="app">
      <div className="bg-orb o1" /><div className="bg-orb o2" />
      <header>
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
          <h1>🏔 Pocono Property Compare</h1>
          <p className="muted">Pick a property to see pricing, mortgage, local amenities and Airbnb comps.</p>
        </motion.div>
        <div className="head-right">
          <div className="tabs">
            {[["single", "Single property"], ["compare", "Compare side by side"]].map(([k, l]) => (
              <button key={k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>
                {mode === k && <motion.i layoutId="tab" className="tab-bg" />}<span>{l}</span>
              </button>
            ))}
          </div>
          {mode === "single" && (
            <div className="select-wrap">
              <select value={sel} onChange={(e) => setSel(e.target.value)}>
                <option value="" disabled>Select a property…</option>
                {props.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
          )}
          {usage && <div className="usage" title="StayAPI requests used (free tier = 50)"><i style={{ width: `${(usage.used / 50) * 100}%` }} /><span>StayAPI {usage.used}/50 · static data</span></div>}
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {mode === "compare" ? (
            <motion.div key="compare" {...fade}>
              <Compare a={cmpA} b={cmpB} setA={setCmpA} setB={setCmpB} rate={rate} />
            </motion.div>
          ) : !p ? (
            <motion.div key="empty" className="empty" {...fade}>
              <div className="emoji">🏡</div>
              <h2>Choose a property above</h2>
              <p className="muted">{props.length} properties loaded.</p>
            </motion.div>
          ) : (
            <motion.div key={p.id} {...fade} className="content">
              <Hero p={p} />
              <div className="grid">
                <Mortgage p={p} rate={rate} />
                <Plaza state={plaza} p={p} />
                <Amenities p={p} />
                <History p={p} />
                <Airbnb key={p.id} p={p} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <footer className="muted tiny">Listing data from Zillow pages · Airbnb data via StayAPI · Maps © OpenStreetMap contributors · Routing by OSRM</footer>
    </div>
  );
}
