// Pure simulation engine (Phase 2). No React/DOM. Mutators return NEW states.
// EARNED HOURS (one rule everywhere): per day, for units produced,
//   baselineH = Σ units × LOCKED baseline std time          (never rewritten)
//   stdH      = Σ units × CURRENT std time                  (falls when containment is removed / assets work)
//   usedH     = labor hours actually consumed doing that work (std time ÷ real pace, incl. machine slowdown, rework time)
//   Verified labor productivity gain (VLPG) = baselineH − stdH      (work content genuinely removed)
//   Released capacity (RCAP)               = stdH − usedH           (capacity freed by pace/performance; can be negative)
//   Total EH = VLPG + RCAP = baselineH − usedH. The two never overlap. Neither is cash:
//   cash savings are recognised ONLY when paid overtime+temp cost is below the locked baseline plan (CFG.baselineOTHours/day).
import { CFG, PROCESSES, ELEMENTS, PRODUCTS, CUSTOMERS, NAMES, EVENTS, START_CONTAINMENT, INVESTMENTS, SEASONS, PATHS, PROJECTS, CHAPTERS } from "../content/index.js";
import { draw } from "./rng.js";

export const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const clone = (s) => structuredClone(s);
export const product = (id) => PRODUCTS.find((p) => p.id === id);
export const proc = (id) => PROCESSES.find((p) => p.id === id);
export const activeProducts = () => PRODUCTS.filter((p) => p.active);
export const season = (day) => SEASONS[(Math.ceil(day / CFG.quarterDays) - 1) % SEASONS.length];
export const calendar = (day) => ({ week: Math.ceil(day / 5), month: Math.ceil(day / 20), quarter: Math.ceil(day / CFG.quarterDays), season: season(day).name });
export const mixOf = (s) => { const ps = PRODUCTS.filter((p) => s.products[p.id] && s.products[p.id].active && !s.products[p.id].retired), t = ps.reduce((a, p) => a + p.share, 0) || 1; return ps.map((p) => ({ pr: p, share: p.share / t })); };
export const avgUnits = (s) => CFG.ordersPerDay * mixOf(s).reduce((t, m) => t + m.share * (m.pr.qty[0] + m.pr.qty[1]) / 2, 0);
export const prodOn = (s, id) => !!(s.products[id] && s.products[id].active && !s.products[id].retired);
export const AVG_UNITS_DAY = CFG.ordersPerDay * activeProducts().reduce((t, p) => t + p.share * (p.qty[0] + p.qty[1]) / 2, 0);

// ---------- standards ----------
const assetSec = (s, p) => (s.assets || []).reduce((t, a) => { const i = INVESTMENTS.find((x) => x.id === a.id); if (!i || i.p !== p) return t; const st = a.day + i.install; return s.day < st ? t : t + i.sec * a.real * Math.min(1, (s.day - st + 1) / i.ramp); }, 0);
export const projSec = (s, p) => (s.projects || []).reduce((t, pr) => { const d = PROJECTS.find((x) => x.id === pr.id); return !d || d.p !== p || !pr.completed ? t : t + d.sec * pr.real * d.stages[pr.completed - 1].frac; }, 0);
export const secOf = (s, p) => Math.max(1, ELEMENTS.filter((e) => e.p === p && (!e.cont || s.cont[e.id])).reduce((t, e) => t + e.sec, 0) - assetSec(s, p) - projSec(s, p));
export const baseSecOf = (p) => ELEMENTS.filter((e) => e.p === p && (!e.cont || START_CONTAINMENT.includes(e.id))).reduce((t, e) => t + e.sec, 0);
export const unitSec = (s, p, prod) => secOf(s, p) * product(prod).mult[p];

// ---------- workers, machines, capacity ----------
export const effProc = (w) => w.tmpProc || w.proc;
export function perfW(s, w, p, noise = 0) {
  const sw = s.sw[p], home = w.home === p, path = w.path;
  const cross = home ? 1 : w.certs && w.certs[p] ? 0.9 + 0.1 * w.cross / 100 : path === "flex" ? 0.8 + 0.2 * w.cross / 100 : 0.6 + 0.4 * w.cross / 100;
  let pm = 1; if (path === "specialist") pm = home ? 1.08 : 0.95; else if (path === "flex") pm = home ? 0.97 : 1; else if (path === "trainer") pm = 0.97; else if (path === "lead") pm = 0.98;
  const leads = s.workers.filter((x) => x.path === "lead" && x.id !== w.id && !x.absent && effProc(x) === p).length;
  return 1.25 * (0.7 + w.skill * 0.006) * (0.8 + w.effort * 0.003) * (1 - w.fat / 250) * (0.85 + w.morale * 0.0015) * cross * pm * (1 + 0.02 * leads) * (home ? 1 + 0.002 * (w.mastery || 0) : 1) * (1 + 0.04 * sw) * (1 + noise * (0.12 - 0.03 * sw) * (leads ? 0.7 : 1));
}
// Hours a worker spends on training or an improvement project instead of production (they are still paid).
export const lostHours = (s, w) => {
  let h = (s.training || []).some((t) => t.wid === w.id) ? CFG.trainHours : 0;
  for (const pr of s.projects || []) { const d = PROJECTS.find((x) => x.id === pr.id); if (pr.status === "active" && d.p === effProc(w) && s.workers.filter((x) => !x.absent && effProc(x) === d.p).slice(0, 2).some((x) => x.id === w.id)) h += d.crewHours; }
  return h;
};
export function staffing(s, p, ot, noise = () => 0) {
  const h0 = CFG.shift + (ot ? CFG.otHours : 0);
  let hrs = 0, eff = 0;
  for (const w of s.workers) if (!w.absent && effProc(w) === p) { const h = Math.max(0, h0 - lostHours(s, w)); hrs += h; eff += h * perfW(s, w, p, noise()); }
  const t = (s.temps && s.temps[p]) || 0; hrs += t * CFG.shift; eff += t * CFG.shift * CFG.tempPerf * (1 + 0.04 * s.sw[p]);
  const m = s.mach[p]; let f = 0.93 + 0.07 * m.health / 100; if (m.down > 0) f *= 0.2; if (s.event && s.event.id === "jam" && s.event.tgt === p) f *= 0.7;
  const pmH = s.pm[p] ? Math.min(CFG.pmHours, hrs) : 0; // planned maintenance takes staffed hours out of production
  if (hrs) eff -= pmH * (eff / hrs);
  eff *= f;
  return { hrs, eff, perf: hrs ? eff / hrs : 1, pmH };
}
export function load(s, p) {
  const st = staffing(s, p, s.ot), cap = st.eff * 3600 || 1;
  const queued = s.q[p].reduce((t, e) => t + e.qty * unitSec(s, p, s.orders.find((o) => o.id === e.oid).product) * (e.rw ? 0.5 : 1), 0);
  const inflow = avgUnits(s) * mixOf(s).reduce((t, m) => t + m.share * secOf(s, p) * m.pr.mult[p], 0);
  return { ratio: (queued + inflow) / cap, cap, hrs: st.hrs };
}
export const limiting = (s) => [...PROCESSES].sort((a, b) => load(s, b.id).ratio - load(s, a.id).ratio)[0];
export const wipUnits = (s) => PROCESSES.reduce((t, p) => t + s.q[p.id].reduce((a, e) => a + e.qty, 0), 0);
export const matAvail = (s) => s.mat.onhand - s.mat.reserved;
export const matCoverDays = (s) => matAvail(s) / Math.max(1, AVG_UNITS_DAY);
export const risk = (h) => (h < 40 ? "HIGH" : h < 65 ? "MEDIUM" : "LOW");

// ---------- orders ----------
const cmp = (s) => (a, b) => s.priority === "urgent" ? b.urgency - a.urgency || a.due - b.due : a.due - b.due || b.urgency - a.urgency;
function makeOrder(s, o = {}) {
  let r = draw(s), prod = o.product; if (!prod) { const m = mixOf(s); prod = m[m.length - 1].pr.id; for (const x of m) { if (r < x.share) { prod = x.pr.id; break; } r -= x.share; } }
  const pr = product(prod), sm = season(s.day).m * (s.rules.demandMult || 1);
  const qty = o.qty || Math.round((pr.qty[0] + Math.floor(draw(s) * (pr.qty[1] - pr.qty[0]))) * sm);
  const due = o.due ?? s.day + 5 + Math.floor(draw(s) * 5), u = draw(s), cust = o.customer || CUSTOMERS[1 + Math.floor(draw(s) * (CUSTOMERS.length - 1))];
  const ord = { id: "SO-" + String(s.nextOrder++).padStart(3, "0"), kind: o.kind || "spot", customer: cust, product: prod, qty, due, urgency: o.urgency || (u < 0.2 ? 3 : u < 0.5 ? 2 : 1), price: +(pr.price * (o.priceMult ?? 1)).toFixed(2), released: 0, shipped: 0, returned: 0, resv: 0, status: o.status || "open", expires: o.expires, lateFlag: false, hist: [] };
  s.orders.push(ord); return ord;
}
const addQ = (q, oid, n, rw = false) => { const e = q.find((x) => x.oid === oid && !!x.rw === rw); e ? (e.qty += n) : q.push(rw ? { oid, qty: n, rw: true } : { oid, qty: n }); };
const audit = (s, kind, text) => { s.audit.push({ day: s.day, kind, text }); if (s.audit.length > 400) s.audit.shift(); };
const ledger = (s, type, eh, note, key) => { const k = key || `${type}:${s.day}`; if (s.ledger.some((e) => e.key === k)) return false; s.ledger.push({ day: s.day, type, eh: +eh.toFixed(2), note, key: k }); return true; };
const custOf = (s, n) => (s.cust[n] = s.cust[n] || { rel: 70, onTime: 0, late: 0, returns: 0 });
const addPO = (s) => s.po.push({ id: "PO-" + String(s.nextPO++).padStart(3, "0"), qty: CFG.poQty, due: s.day + CFG.leadTime });

// ---------- campaign ----------
export function rollEvent(s) {
  const pool = EVENTS.filter((e) => !e.safeFromDay || s.day >= e.safeFromDay);
  const ww = (e) => e.w * (e.id === "delay" ? s.rules.delayW : 1); let r = draw(s) * pool.reduce((t, e) => t + ww(e), 0), pick = pool[0];
  for (const e of pool) { r -= ww(e); if (r <= 0) { pick = e; break; } }
  const ev = { id: pick.id, tone: pick.tone, t: pick.t, d: pick.d, day: s.day };
  if (pick.id === "jam") { const p = PROCESSES[Math.floor(draw(s) * PROCESSES.length)]; ev.tgt = p.id; ev.d = p.name + " runs at 70% for the day."; }
  return ev;
}
export function newCampaign(seed = 20260101, now = Date.now()) {
  const s = { v: 3, seed, rng: seed >>> 0, day: 1, ot: false, otStreak: 0, priority: "due", status: "active", nextOrder: 1, nextPO: 1, workers: [], sw: {}, cont: {}, baseSec: {}, orders: [], q: {}, temps: {}, pm: {},
    mach: { rcv: { health: 80, down: 0 }, pick: { health: 60, down: 0 }, pack: { health: 75, down: 0 }, ship: { health: 80, down: 0 } },
    stats: { released: 0, shipped: 0, scrapped: 0, good: 0, checked: 0, passed1: 0, reworked: 0, returned: 0, escaped: 0 },
    mat: { onhand: CFG.startCartons, reserved: 0, open: CFG.startCartons, receipts: 0, consumed: 0, adjust: 0 }, po: [], returns: [], ar: [], assets: [], cust: {},
    cash: CFG.startCash, openCash: CFG.startCash, cf: { receipts: 0, supplier: 0, components: 0, payroll: 0, opex: 0, maint: 0, capital: 0, penalties: 0, expedite: 0, corp: 0, transfer: 0 },
    bank: CFG.startBank, startBank: CFG.startBank, spent: 0, credited: 0, ledger: [], eh: { baseH: 0, stdH: 0, usedH: 0, vlpg: 0, rcap: 0, paidReg: 0, paidOT: 0, tempH: 0, tempCost: 0, unusedH: 0, releasedH: 0, cashSaved: 0 },
    fin: { revenue: 0, credits: 0, cogs: 0, scrapRework: 0, labor: 0, overtime: 0, temp: 0, maint: 0, expedite: 0, opex: 0, penalties: 0, depr: 0, assetOps: 0, transfer: 0 },
    deliv: { onTime: 0, late: 0 }, history: [], audit: [], done: {}, event: null, nextEvent: null, last: null, close: null,
    clock: { lastTs: now, dayMs: CFG.dayMs }, scenario: { id: "opening", pausePolicy: "free", paused: false },
    products: { kit: { active: true }, bundle: { active: true }, gift: { active: false, unlocked: false } }, projects: [], training: [], pairs: {}, vacancy: [], nextHire: 1, endDay: CFG.quarterDays, chapter: 1, autoCover: true,
    rules: { ot: true, invest: true, temps: true, delayW: 1, safeDay: 4, thr: {} }, snap: null };
  START_CONTAINMENT.forEach((id) => (s.cont[id] = true));
  PROCESSES.forEach((p) => { s.sw[p.id] = 0; s.q[p.id] = []; s.temps[p.id] = 0; s.pm[p.id] = false; s.baseSec[p.id] = baseSecOf(p.id); }); // baseline locked here
  let i = 0;
  for (const p of PROCESSES) for (let k = 0; k < p.home; k++, i++) { const r = () => draw(s) - 0.5; s.workers.push({ id: "w" + i, name: NAMES[i] || "Worker " + (i + 1), home: p.id, proc: p.id, skill: clamp(45 + r() * 30), effort: clamp(55 + r() * 30), cross: clamp(25 + r() * 30), fat: 0, morale: clamp(70 + r() * 20), path: null, xp: 0, mastery: 0, trust: 60, certs: {}, lastDev: -99, lowDays: 0, absent: false, tmpProc: null }); }
  for (let k = 0; k < 6; k++) makeOrder(s, { due: 3 + k });
  s.snap = snapshot(s);
  s.event = { id: "audit", tone: "neutral", t: "Audit Scheduled", d: "A customer visit is coming. No impact today.", day: 1 };
  s.nextEvent = rollEvent(s);
  return s;
}

export function stepDay(prev) {
  if (prev.status !== "active") return prev;
  const s = clone(prev), ev = s.event, ot = s.ot, day = s.day, cmpO = cmp(s), order = (id) => s.orders.find((o) => o.id === id);
  const evKey = `${day}:${ev.id}`; if (s.done[evKey]) return s; s.done[evKey] = 1; // an event is applied at most once
  s.otStreak = ot ? s.otStreak + 1 : 0;
  for (const v of s.vacancy.filter((x) => x.due <= day)) { const i = s.nextHire++; s.workers.push({ id: "h" + i, name: "New hire " + i, home: v.proc, proc: v.proc, skill: 35, effort: 55, cross: 20, fat: 0, morale: 60, path: null, xp: 0, mastery: 0, trust: 55, certs: {}, lastDev: day, lowDays: 0, absent: false, tmpProc: null }); s.fin.opex += CFG.hireCost; s.cf.opex += CFG.hireCost; s.cash -= CFG.hireCost; audit(s, "action", `New hire ${i} joins ${proc(v.proc).name} (recruiting $${CFG.hireCost})`); }
  s.vacancy = s.vacancy.filter((x) => x.due > day);
  let cashIn = 0, cashOut = { supplier: 0, components: 0, payroll: 0, opex: 0, maint: 0, penalties: 0, expedite: 0 };
  // events
  if (ev.id === "rush") { const o = makeOrder(s, { product: "kit", qty: 250, due: day + 2, urgency: 3, priceMult: 1.3, kind: "rush" }); audit(s, "incident", `Rush order ${o.id} due day ${o.due}`); }
  if (ev.id === "idea" && ledger(s, "IDEA", CFG.ideaEH, "Operator suggestion", `IDEA:${day}`)) { s.bank += CFG.ideaEH; s.credited += CFG.ideaEH; }
  if (ev.id === "delay" && s.po.length) { s.po.sort((a, b) => a.due - b.due)[0].due += 2; audit(s, "incident", "Supplier delay: carton delivery slipped 2 days"); }
  if (ev.id === "jam") audit(s, "incident", ev.d);
  // demand: spot orders, weekly contract, optional offers
  for (let k = 0; k < CFG.ordersPerDay; k++) makeOrder(s);
  if (day % 5 === 1 && prodOn(s, "kit")) makeOrder(s, { kind: "contract", customer: "Maple Home", product: "kit", qty: 300, due: day + 6, urgency: 3, priceMult: 1.05 });
  if (day % 4 === 2 && prodOn(s, "bundle")) makeOrder(s, { kind: "optional", product: "bundle", qty: 380, due: day + 9, priceMult: 1.25, status: "offered", expires: day + 3 });
  for (const o of s.orders) if (o.status === "offered" && day > o.expires) o.status = "expired";
  // supply: receipts, reorder
  for (const po of s.po.filter((x) => x.due <= day)) { s.mat.onhand += po.qty; s.mat.receipts += po.qty; cashOut.supplier += po.qty * CFG.cartonCost; audit(s, "day", `Received ${po.id}: ${po.qty} cartons`); }
  s.po = s.po.filter((x) => x.due > day);
  if (matAvail(s) + s.po.reduce((t, p) => t + p.qty, 0) < CFG.reorderPoint) addPO(s);
  // returns arriving: credit note, replacement order, relationship hit
  for (const r of s.returns.filter((x) => x.due <= day)) {
    const o = order(r.oid), amt = r.qty * o.price; o.returned += r.qty; s.stats.returned += r.qty; s.fin.credits += amt; s.ar.push({ due: day, amt: -amt });
    const pen = o.kind === "contract" ? r.qty * CFG.returnPenaltyPerUnit : 0; s.fin.penalties += pen; cashOut.penalties += pen;
    custOf(s, o.customer).returns += r.qty; custOf(s, o.customer).rel = clamp(custOf(s, o.customer).rel - 6);
    makeOrder(s, { kind: "replacement", customer: o.customer, product: o.product, qty: r.qty, due: day + 3, urgency: 3, priceMult: 0 });
    audit(s, "incident", `Customer return: ${r.qty} units of ${o.id}; credit $${amt.toFixed(0)}; replacement ordered`);
  }
  s.returns = s.returns.filter((x) => x.due > day);
  // machine breakdown rolls (leading indicator: health bar and risk label)
  for (const p of PROCESSES) { const m = s.mach[p.id]; if (m.down === 0 && !s.pm[p.id] && draw(s) < 0.004 + 0.06 * ((100 - m.health) / 100) ** 2) { m.down = 1; audit(s, "incident", `${p.name} broke down (health ${Math.round(m.health)}). Emergency repair available.`); } }
  // dispatch: release by priority, reserving cartons so two jobs can never claim the same stock
  let wip = wipUnits(s), relCap = CFG.releaseCap, shortage = false;
  for (const o of s.orders.filter((x) => x.status === "open" && x.released < x.qty).sort(cmpO)) {
    const n = Math.min(o.qty - o.released, relCap, CFG.wipCap - wip, matAvail(s));
    if (matAvail(s) <= 0) shortage = true;
    if (n <= 0) continue;
    addQ(s.q.rcv, o.id, n); o.released += n; o.resv += n; s.mat.reserved += n; s.stats.released += n; wip += n; relCap -= n;
  }
  if (shortage) audit(s, "incident", "Material shortage: orders waiting for cartons");
  // flow
  let usedH = 0, bud = 0, cur = 0, paidH = 0, shippedToday = 0, lateToday = 0, revenue = 0, cogs = 0, scrapCost = 0, pmCostToday = 0;
  const swEsc = Math.max(0.002, CFG.baseEscape - 0.002 * s.sw.pack), otQ = 1 + 0.05 * Math.min(s.otStreak, 6);
  PROCESSES.forEach((p, idx) => {
    const st = staffing(s, p.id, ot, () => draw(s) * 2 - 1); paidH += st.hrs;
    let rem = st.eff * 3600;
    s.q[p.id].sort((a, b) => !!a.rw - !!b.rw || cmpO(order(a.oid), order(b.oid)));
    for (const e of s.q[p.id]) {
      const o = order(e.oid), us = unitSec(s, p.id, o.product) * (e.rw ? 0.5 : 1), n = Math.min(e.qty, Math.floor(rem / us));
      if (n <= 0) continue;
      rem -= n * us; e.qty -= n; usedH += (n * us) / (st.perf * 3600);
      if (!e.rw) { cur += (n * us) / 3600; bud += (n * s.baseSec[p.id] * product(o.product).mult[p.id]) / 3600; }
      let pass = n;
      if (p.id === "pack" && !e.rw) {
        // in-process check at Pack: defects are scrapped (lost) or reworked (re-run through Pack at half time)
        const dr = Math.max(0.005, CFG.baseDefect - CFG.defectPerSwLevel * s.sw.pack) * (1 + (100 - s.mach.pack.health) / 200) * otQ;
        const bad = Math.min(n, Math.floor(n * dr + draw(s))), rw = Math.floor(bad * CFG.rework), scrap = bad - rw, mat = product(o.product).mat;
        s.stats.checked += n; s.stats.passed1 += n - bad; pass = n - scrap - rw; s.stats.scrapped += scrap; s.stats.reworked += rw; o.released -= scrap;
        o.resv -= n; s.mat.reserved -= n; s.mat.onhand -= n; s.mat.consumed += n; // cartons are consumed when work starts, including scrap
        cashOut.components += n * (mat - CFG.cartonCost); cogs += (n - scrap) * mat; scrapCost += scrap * mat + rw * CFG.reworkCost;
        if (rw) addQ(s.q.pack, o.id, rw, true);
      }
      if (idx < PROCESSES.length - 1) addQ(s.q[PROCESSES[idx + 1].id], o.id, pass);
      else {
        o.shipped += pass; s.stats.shipped += pass; shippedToday += pass; o.hist.push({ day, n: pass }); const rev = pass * o.price; revenue += rev; if (rev) s.ar.push({ due: day + CFG.arDays, amt: rev });
        const esc = Math.min(pass, Math.floor(pass * swEsc * otQ + draw(s))); // final inspection misses these; they come back as returns
        if (esc) { s.stats.escaped += esc; s.returns.push({ due: day + 3, oid: o.id, qty: esc }); audit(s, "incident", `Quality escape: ${esc} units of ${o.id} shipped defective; return expected day ${day + 3}`); }
        if (o.shipped >= o.qty && o.status === "open") {
          o.status = "done"; o.doneDay = day; if (o.resv > 0) { s.mat.reserved -= o.resv; o.resv = 0; } // completed job releases leftover reservation
          if (o.kind !== "replacement") { const c = custOf(s, o.customer); if (day <= o.due && !o.lateFlag) { s.deliv.onTime++; c.onTime++; c.rel = clamp(c.rel + 2); } else if (!o.lateFlag) { o.lateFlag = true; s.deliv.late++; lateToday++; c.late++; c.rel = clamp(c.rel - 5); } } // finishing after the due date is late even if it was never flagged while open
          if (o.kind === "contract" && day > o.due) { const pen = CFG.contractPenalty * o.qty * o.price; s.fin.penalties += pen; cashOut.penalties += pen; }
        }
      }
    }
    s.q[p.id] = s.q[p.id].filter((e) => e.qty > 0);
    const m = s.mach[p.id];
    if (s.pm[p.id]) { m.health = Math.min(100, m.health + 35); s.pm[p.id] = false; pmCostToday += CFG.pmCost; audit(s, "action", `Planned maintenance at ${p.name}: ${st.pmH.toFixed(0)} staffed hours, $${CFG.pmCost}`); }
    m.health = clamp(m.health - 0.7 - (ot ? 0.4 : 0)); if (m.down > 0) m.down = 0;
  });
  for (const o of s.orders) if (o.status === "open" && day > o.due && !o.lateFlag) { o.lateFlag = true; if (o.kind !== "replacement") { s.deliv.late++; lateToday++; const c = custOf(s, o.customer); c.late++; c.rel = clamp(c.rel - 5); } }
  // Earned Hours
  const vlpg = bud - cur, rcap = cur - usedH, e = s.eh;
  e.baseH += bud; e.stdH += cur; e.usedH += usedH; e.vlpg += vlpg; e.rcap += rcap; e.releasedH += Math.max(0, vlpg) + Math.max(0, rcap);
  if (vlpg > 0.005 && ledger(s, "VLPG", vlpg, "Work content removed vs locked baseline")) { s.bank += vlpg; s.credited += vlpg; }
  if (rcap > 0.005 && ledger(s, "RCAP", rcap, "Capacity freed by pace/performance")) { s.bank += rcap; s.credited += rcap; }
  else if (rcap < -0.005) ledger(s, "SHORT", rcap, "Pace/rework/machine losses — recorded, not debited");
  // labor, cash and P&L (accrual) — payroll is paid same day; released capacity is never cash
  const nW = s.workers.length, regH = nW * CFG.shift, otH = ot ? nW * CFG.otHours : 0, tempH = Object.values(s.temps).reduce((t, x) => t + x, 0) * CFG.shift;
  const otRate = CFG.otPremium + 0.1 * Math.max(0, Math.min(s.otStreak - 1, 5)); // repeated overtime escalates
  const labor = regH * CFG.wage, otPay = otH * CFG.wage * otRate, tempPay = tempH * CFG.tempWage;
  e.paidReg += regH; e.paidOT += otH; e.tempH += tempH; e.tempCost += tempPay; e.unusedH += Math.max(0, regH + otH + tempH - usedH);
  e.cashSaved += Math.max(0, nW * CFG.baselineOTHours * CFG.wage * CFG.otPremium - otPay - tempPay);
  s.fin.labor += labor; s.fin.overtime += otPay; s.fin.temp += tempPay; cashOut.payroll += labor + otPay + tempPay;
  s.fin.opex += CFG.overhead; cashOut.opex += CFG.overhead; s.fin.maint += pmCostToday; cashOut.maint += pmCostToday;
  for (const a of s.assets) { const i = INVESTMENTS.find((x) => x.id === a.id); s.fin.depr += i.cost / i.life; s.fin.assetOps += i.opex; cashOut.opex += i.opex; }
  s.fin.revenue += revenue; s.fin.cogs += cogs; s.fin.scrapRework += scrapCost;
  const due = s.ar.filter((x) => x.due <= day); cashIn = due.reduce((t, x) => t + x.amt, 0); s.ar = s.ar.filter((x) => x.due > day);
  const out = Object.values(cashOut).reduce((t, x) => t + x, 0); s.cash += cashIn - out; s.cf.receipts += cashIn; for (const k of Object.keys(cashOut)) s.cf[k] += cashOut[k];
  for (const w of s.workers) { let fat = w.absent ? w.fat - 15 : w.fat + 6 + (ot ? 4 * (1 + 0.25 * Math.min(s.otStreak, 6)) : 0); if (day % 5 === 0) fat -= 30; w.fat = clamp(fat); }
  s.history.push({ day, shipped: shippedToday, wip: wipUnits(s), cash: Math.round(s.cash) }); if (s.history.length > 200) s.history.shift();
  if (day % 20 === 0) { const old = s.orders.filter((o) => (o.status === "done" || o.status === "expired" || o.status === "declined") && (o.doneDay ?? o.due) < day - 90); s.archRev = (s.archRev || 0) + old.reduce((t, o) => t + o.shipped * o.price, 0); s.orders = s.orders.filter((o) => !old.includes(o)); } // keeps saves small; revenue of pruned orders is archived so reconciliation still holds
  s.last = { day, shippedToday, lateToday, revenue, labor: labor + otPay + tempPay, usedH, paidH, idleH: Math.max(0, regH + otH + tempH - usedH), vlpg, rcap, event: ev.t, cashIn, cashOut: out };
  audit(s, "day", `Day ${day}: shipped ${shippedToday}, late orders ${lateToday}, EH ${(vlpg + rcap).toFixed(1)}`);
  updatePeople(s, { late: lateToday, shipped: shippedToday, ot });
  s.day++; if (s.day > s.endDay) s.status = "complete";
  s.event = s.nextEvent; s.nextEvent = rollEvent(s); rollAbsences(s);
  return s;
}

// ---------- player actions ----------
const fail = (reason) => ({ ok: false, reason });
export function improvements(s) {
  const out = [];
  for (const e of ELEMENTS.filter((x) => x.cont && s.cont[x.id])) out.push({ id: "cont:" + e.id, kind: "cont", name: "Remove: " + e.name, desc: `Fix the cause (${e.cont}) so ${e.sec}s per unit of workaround at ${proc(e.p).name} disappears permanently.`, cost: e.cost });
  for (const p of PROCESSES) { const l = s.sw[p.id]; out.push({ id: "sw:" + p.id, kind: "sw", name: `Standard work: ${p.name} (level ${l}/3)`, desc: "+4% pace and steadier days." + (p.id === "pack" ? " Also cuts defects and escapes." : ""), cost: CFG.swCost * (l + 1), maxed: l >= 3 }); }
  return out.map((i) => ({ ...i, available: !i.maxed && s.bank >= i.cost, reason: i.maxed ? "Maxed" : s.bank < i.cost ? "Not enough Earned Hours" : "" }));
}
export function buy(s, id) {
  const it = improvements(s).find((i) => i.id === id); if (!it) return fail("Unknown improvement"); if (!it.available) return fail(it.reason);
  const n = clone(s); if (it.kind === "cont") delete n.cont[id.split(":")[1]]; else n.sw[id.split(":")[1]]++;
  n.bank -= it.cost; n.spent += it.cost; ledger(n, "SPEND", -it.cost, it.name, `SPEND:${n.day}:${n.ledger.length}`); audit(n, "action", `Improvement: ${it.name} (${it.cost} EH)`);
  return { ok: true, state: n };
}
export function trainWorker(s, wid) {
  const w = s.workers.find((x) => x.id === wid);
  if (!w || s.bank < CFG.trainCost || w.cross >= 100) return fail(s.bank < CFG.trainCost ? "Not enough Earned Hours" : "Already fully cross-trained");
  const n = clone(s); n.workers.find((x) => x.id === wid).cross = clamp(w.cross + 20); n.bank -= CFG.trainCost; n.spent += CFG.trainCost; ledger(n, "SPEND", -CFG.trainCost, "Cross-train " + w.name, `SPEND:${n.day}:${n.ledger.length}`);
  return { ok: true, state: n };
}
export function moveWorker(s, wid, p) { const n = clone(s); const w = n.workers.find((x) => x.id === wid); if (w && proc(p)) { w.proc = p; w.tmpProc = null; } return n; }
export function setOptions(s, o) { if (o.ot && !s.rules.ot) return s; const n = clone(s); Object.assign(n, o); return n; }
export function setTemps(s, p, d) { if (!s.rules.temps) return s; const n = clone(s), tot = Object.values(n.temps).reduce((t, x) => t + x, 0); if (d > 0 && tot >= CFG.maxTemps) return n; n.temps[p] = Math.max(0, (n.temps[p] || 0) + d); return n; }
export function planPM(s, p) { const n = clone(s); n.pm[p] = !n.pm[p]; return n; }
export function emergencyRepair(s, p) { if (s.mach[p].down <= 0) return fail("Nothing is broken there"); const n = clone(s); n.mach[p].down = 0; n.mach[p].health = Math.min(100, n.mach[p].health + 20); n.cash -= CFG.repairCost; n.fin.maint += CFG.repairCost; n.cf.maint += CFG.repairCost; audit(n, "action", `Emergency repair at ${proc(p).name}: $${CFG.repairCost}`); return { ok: true, state: n }; }
export function expediteSupply(s) { const po = s.po.slice().sort((a, b) => a.due - b.due)[0]; if (!po) return fail("No open purchase order"); if (po.due <= s.day + 1) return fail("Already arriving tomorrow"); const n = clone(s); n.po.find((x) => x.id === po.id).due = s.day + 1; n.cash -= CFG.expediteCost; n.fin.expedite += CFG.expediteCost; n.cf.expedite += CFG.expediteCost; audit(n, "action", `Expedited ${po.id} for $${CFG.expediteCost}`); return { ok: true, state: n }; }
export function acceptOffer(s, oid) { const o = s.orders.find((x) => x.id === oid); if (!o || o.status !== "offered") return fail("Offer no longer available"); const n = clone(s); n.orders.find((x) => x.id === oid).status = "open"; audit(n, "action", `Accepted optional order ${oid}`); return { ok: true, state: n }; }
export function declineOffer(s, oid) { const o = s.orders.find((x) => x.id === oid); if (!o || o.status !== "offered") return fail("Offer no longer available"); const n = clone(s); n.orders.find((x) => x.id === oid).status = "declined"; return { ok: true, state: n }; }
export function invest(s, id) {
  const i = INVESTMENTS.find((x) => x.id === id); if (!i) return fail("Unknown investment"); if (!s.rules.invest) return fail("Capital investment is locked in this scenario."); if (s.assets.some((a) => a.id === id)) return fail("Already purchased"); if (s.cash < i.cost + CFG.reserve) return fail(`Keep a $${CFG.reserve} cash reserve: need $${i.cost + CFG.reserve}`);
  const n = clone(s); n.assets.push({ id, day: s.day, real: +(0.7 + draw(n) * 0.3).toFixed(3) }); n.cash -= i.cost; n.cf.capital += i.cost; audit(n, "action", `Invested in ${i.name} ($${i.cost}); online day ${s.day + i.install}`); return { ok: true, state: n };
}
export function setPaused(s, paused, now = Date.now()) { if (paused && s.scenario.pausePolicy !== "free") return fail("This challenge doesn't allow pausing."); const n = clone(s); n.scenario.paused = paused; if (!paused) n.clock.lastTs = now; return { ok: true, state: n }; }

// ---------- reporting ----------
export const diff = (o, b) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? v - ((b && b[k]) || 0) : v]));
export const snapshot = (s) => ({ fin: { ...s.fin }, deliv: { ...s.deliv }, stats: { ...s.stats }, startDay: s.day });
// Everything the scorecard and P&L report is measured since the start of the current chapter/scenario (cumulative totals stay for reconciliation).
export const view = (s) => { const b = s.snap || {}; return { fin: diff(s.fin, b.fin), deliv: diff(s.deliv, b.deliv), stats: diff(s.stats, b.stats), startDay: b.startDay || 1 }; };
export function pnl(s) {
  const f = view(s).fin, costs = f.cogs + f.scrapRework + f.labor + f.overtime + f.temp + f.maint + f.expedite + f.opex + f.penalties + f.depr + f.assetOps + (f.transfer || 0);
  return { revenue: f.revenue, credits: f.credits, netRevenue: f.revenue - f.credits, costs, profit: f.revenue - f.credits - costs };
}
export const thresholds = (s) => ({ ...CFG.thresholds, ...((s.rules && s.rules.thr) || {}) });
export function scorecard(s) {
  const T = thresholds(s), V = view(s), profit = pnl(s).profit, dn = V.deliv.onTime + V.deliv.late, otd = dn ? V.deliv.onTime / dn : 1, fpy = V.stats.checked ? V.stats.passed1 / V.stats.checked : 1;
  const rr = V.stats.shipped ? V.stats.returned / V.stats.shipped : 0, eng = s.workers.reduce((t, w) => t + w.morale, 0) / s.workers.length;
  const dims = [
    { id: "fin", name: "Financial health", value: profit, show: "$" + Math.round(profit).toLocaleString(), need: `Operating profit ≥ $${T.profit}`, pass: profit >= T.profit, tip: "Ship on time, avoid overtime you can't justify, and keep machines healthy." },
    { id: "del", name: "Customer delivery", value: otd, show: Math.round(otd * 100) + "% on time", need: "≥ " + Math.round(T.otd * 100) + "% on time", pass: otd >= T.otd, tip: "Find the limiting area and give it capacity." },
    { id: "qual", name: "Quality", value: fpy, show: (fpy * 100).toFixed(1) + "% first pass", need: `≥ ${(T.fpy * 100).toFixed(1)}% first pass and returns ≤ ${(T.returnRate * 100).toFixed(1)}% (now ${(rr * 100).toFixed(2)}%)`, pass: fpy >= T.fpy && rr <= T.returnRate, tip: "Standard work at Pack and healthy machines lower defects and escapes." },
    { id: "eng", name: "Workforce engagement", value: eng, show: Math.round(eng) + " / 100", need: "≥ " + T.engagement, pass: eng >= T.engagement, tip: "Look at the engagement factors in the Team view: fatigue, trust, fairness, overtime." },
  ];
  return { dims, pass: dims.every((d) => d.pass), profit };
}
export function invariants(s) {
  const wip = wipUnits(s), m = s.mat;
  return { conserved: s.stats.released === wip + s.stats.shipped + s.stats.scrapped, shippedOk: s.orders.every((o) => o.shipped <= o.qty), bankOk: Math.abs(s.bank - (s.startBank + s.credited - s.spent)) < 1e-6,
    materialsOk: Math.abs(m.onhand - (m.open + m.receipts - m.consumed + m.adjust)) < 1e-6, reservedOk: m.reserved === s.orders.reduce((t, o) => t + o.resv, 0) && m.reserved <= m.onhand && m.reserved >= 0,
    cashOk: Math.abs(s.cash - (s.openCash + s.cf.receipts - Object.entries(s.cf).filter(([k]) => k !== "receipts").reduce((t, [, v]) => t + v, 0))) < 1e-6, ehOk: Math.abs(s.eh.vlpg + s.eh.rcap - (s.eh.baseH - s.eh.usedH)) < 1e-6 };
}

// ======================= Phase 3: people, training, projects, products, chapters =======================
const wk = (s, id) => s.workers.find((w) => w.id === id);
const pk = (a, b) => [a, b].sort().join("|");
const pairT = (s, a, b) => (s.pairs[pk(a, b)] ?? 50);
const bump = (s, a, b, d) => { s.pairs[pk(a, b)] = clamp(pairT(s, a, b) + d); };
// Absence/turnover risk is explainable: it is built only from fatigue, engagement and overtime strain, and shown to the player before it bites.
export function riskOf(s, w) {
  const reasons = []; let r = 0;
  if (w.fat > 40) { r += (w.fat - 40) * 1.2; reasons.push(`fatigue ${Math.round(w.fat)}`); }
  if (w.morale < 60) { r += (60 - w.morale) * 0.8; reasons.push(`low engagement ${Math.round(w.morale)}`); }
  if (s.otStreak > 0) { r += s.otStreak * 4; reasons.push(`${s.otStreak} straight days of overtime`); }
  r = clamp(r); return { score: r, level: r >= 50 ? "HIGH" : r >= 25 ? "MEDIUM" : "LOW", reasons, leaving: w.lowDays >= 5, lowDays: w.lowDays };
}
// Engagement moves 20%/day toward a target built from these named factors (all shown in the Team view).
export function engagement(s, w) {
  const f = [], add = (label, v) => f.push({ label, v: +v.toFixed(1) }), here = effProc(w);
  add("Workload / fatigue", w.fat > 30 ? -(w.fat - 30) * 0.25 : 3);
  add("Overtime strain", -3 * Math.min(s.otStreak, 5));
  add("Trust in leadership", (w.trust - 50) * 0.2);
  add("Fairness of assignment", here !== w.home && !(w.certs && w.certs[here]) && w.path !== "flex" ? -5 : 2);
  add("Coaching & development", s.day - w.lastDev <= 10 ? 5 : 0);
  add("Working conditions (machine health)", (PROCESSES.reduce((t, p) => t + s.mach[p.id].health, 0) / PROCESSES.length - 60) * 0.1);
  const l = s.last; add("Recent outcomes", l ? (l.lateToday > 0 ? -4 : l.shippedToday > 0 ? 3 : 0) : 0);
  const mates = s.workers.filter((x) => x.id !== w.id && !x.absent && effProc(x) === here), avg = mates.length ? mates.reduce((t, x) => t + pairT(s, w.id, x.id), 0) / mates.length : 50;
  add("Relationships with teammates", (avg - 50) * 0.1);
  return { target: clamp(55 + f.reduce((t, x) => t + x.v, 0)), factors: f };
}
function updatePeople(s, c) {
  const day = s.day, done = [];
  for (const t of s.training) { const w = wk(s, t.wid); if (!w || w.absent) continue; const tr = s.workers.find((x) => x.path === "trainer" && x.id !== w.id && !x.absent && (effProc(x) === t.proc || effProc(x) === w.home)); t.done += tr ? 2 : 1; if (tr) { tr.xp += 1; bump(s, tr.id, w.id, 2); } if (t.done >= CFG.trainNeed) done.push(t); }
  for (const t of done) { const w = wk(s, t.wid); if (t.kind === "cross") { w.certs[t.proc] = true; w.cross = clamp(w.cross + 10); } else w.skill = clamp(w.skill + 6); w.lastDev = day; w.trust = clamp(w.trust + 3); w.xp += 5; audit(s, "action", `${w.name} finished ${t.kind === "cross" ? "cross-training for " + proc(t.proc).name : "skill training"}`); }
  s.training = s.training.filter((t) => !done.includes(t));
  for (const pr of s.projects) { if (pr.status !== "active") continue; const d = PROJECTS.find((x) => x.id === pr.id); if (--pr.left > 0) continue; pr.completed++; if (pr.completed >= d.stages.length) { pr.status = "done"; audit(s, "action", `Project complete: ${d.name} — ${(d.sec * pr.real).toFixed(1)}s/unit removed at ${proc(d.p).name} (realized ${Math.round(pr.real * 100)}% of ${d.sec}s)`); } else { pr.status = "review"; audit(s, "action", `Project review: ${d.name} finished "${d.stages[pr.completed - 1].name}"`); } }
  const quits = [];
  for (const w of s.workers) {
    const here = effProc(w), away = here !== w.home && !(w.certs && w.certs[here]) && w.path !== "flex";
    if (!w.absent) { if (here === w.home) { w.xp += 1 + (s.workers.some((x) => x.path === "trainer" && x.id !== w.id && !x.absent && effProc(x) === here) ? 0.5 : 0); w.skill = clamp(w.skill + 0.04); } w.mastery = Math.min(100, (w.xp * 100) / 90); }
    w.trust = clamp(w.trust + (c.ot ? -1.5 : 0.3) - (c.late ? 0.8 : 0) - (away ? 1 : 0) + (s.training.some((t) => t.wid === w.id) ? 2 : 0));
    for (const x of s.workers) if (x.id > w.id && !w.absent && !x.absent && effProc(x) === here) bump(s, w.id, x.id, c.late ? -0.4 : 0.6);
    w.morale = clamp(w.morale + 0.2 * (engagement(s, w).target - w.morale));
    w.lowDays = w.morale < 35 ? w.lowDays + 1 : Math.max(0, w.lowDays - 1);
    if (w.lowDays >= CFG.quitDays) quits.push(w);
  }
  for (const w of quits) { s.workers = s.workers.filter((x) => x.id !== w.id); s.training = s.training.filter((t) => t.wid !== w.id); s.stats.resigned = (s.stats.resigned || 0) + 1; s.vacancy.push({ proc: w.home, due: day + CFG.hireDays }); audit(s, "incident", `${w.name} resigned after ${CFG.quitDays} days of very low engagement; a replacement starts in ${CFG.hireDays} days.`); }
}
// Absences are rolled for the day ahead so the player sees them (and the auto-cover) before running the shift.
function rollAbsences(s) {
  for (const w of s.workers) { w.absent = false; w.tmpProc = null; }
  for (const w of s.workers) { const r = riskOf(s, w); if (draw(s) < (r.score / 100) * 0.06) { w.absent = true; audit(s, "incident", `${w.name} is out today (${r.reasons.join(", ") || "illness"})`); } }
  if (!s.autoCover) return;
  const score = (x, p) => (x.certs && x.certs[p] ? 2 : 0) + (x.path === "flex" ? 1 : 0) + x.cross / 100;
  for (const w of s.workers.filter((x) => x.absent)) {
    const c = s.workers.filter((x) => !x.absent && !x.tmpProc && effProc(x) !== w.proc && s.workers.filter((y) => !y.absent && effProc(y) === effProc(x)).length > 1 && !s.training.some((t) => t.wid === x.id)).sort((a, b) => score(b, w.proc) - score(a, w.proc))[0];
    if (c) { c.tmpProc = w.proc; audit(s, "action", `${c.name} covers ${proc(w.proc).name} for ${w.name}`); }
  }
}
const pay = (n, c) => { n.cash -= c; n.fin.opex += c; n.cf.opex += c; };
export function setPath(s, wid, path) {
  const w = wk(s, wid); if (!w || !PATHS[path]) return fail("Unknown path"); if (w.path === path) return fail("Already on that path");
  if (w.mastery < CFG.pathMastery) return fail(`${w.name} needs ${CFG.pathMastery} mastery first (now ${Math.round(w.mastery)}). Mastery grows with days worked at the home area.`); if (s.bank < CFG.pathCost) return fail("Not enough Earned Hours");
  const n = clone(s); wk(n, wid).path = path; wk(n, wid).lastDev = n.day; n.bank -= CFG.pathCost; n.spent += CFG.pathCost; ledger(n, "SPEND", -CFG.pathCost, `${w.name}: ${PATHS[path].name} path`, `SPEND:${n.day}:${n.ledger.length}`); audit(n, "action", `${w.name} chose the ${PATHS[path].name} path`); return { ok: true, state: n };
}
export function startTraining(s, wid, kind, p) {
  const w = wk(s, wid); if (!w) return fail("Unknown worker"); if (s.training.some((t) => t.wid === wid)) return fail("Already in training"); if (s.training.length >= 2) return fail("Only two training sessions at a time");
  if (kind === "cross" && (p === w.home || (w.certs && w.certs[p]))) return fail("Already capable there"); if (s.cash < CFG.trainCost) return fail("Not enough cash for training materials");
  const n = clone(s); n.training.push({ wid, kind, proc: kind === "cross" ? p : w.home, done: 0 }); pay(n, CFG.trainCost); audit(n, "action", `${w.name} started ${kind === "cross" ? "cross-training for " + proc(p).name : "skill training"} (${CFG.trainHours}h/day off production)`); return { ok: true, state: n };
}
export function startProject(s, id) {
  const d = PROJECTS.find((x) => x.id === id); if (!d) return fail("Unknown project"); if (s.projects.some((x) => x.id === id)) return fail("Already started or finished"); const c = d.stages[0].cost; if (s.cash < c) return fail(`Need $${c} cash`);
  const n = clone(s); n.projects.push({ id, status: "active", completed: 0, left: d.stages[0].days, real: +(0.6 + draw(n) * 0.4).toFixed(3), started: n.day }); pay(n, c); audit(n, "action", `Started project: ${d.name} ($${c})`); return { ok: true, state: n };
}
export function approveProject(s, id) {
  const pr = s.projects.find((x) => x.id === id), d = PROJECTS.find((x) => x.id === id); if (!pr || pr.status !== "review") return fail("Nothing to approve"); const st = d.stages[pr.completed]; if (s.cash < st.cost) return fail(`Need $${st.cost} cash`);
  const n = clone(s), q = n.projects.find((x) => x.id === id); q.status = "active"; q.left = st.days; pay(n, st.cost); audit(n, "action", `Approved ${d.name} stage "${st.name}" ($${st.cost})`); return { ok: true, state: n };
}
export function setProduct(s, id, mode) {
  if (!s.products[id]) return fail("Unknown product"); const n = clone(s), x = n.products[id];
  if (mode === "activate") {
    if (!x.unlocked && id === "gift") return fail("Not unlocked yet: it's introduced in Chapter 2.");
    if (id === "gift" && !(n.sw.pack >= 1 && n.workers.filter((w) => w.home === "pack" || (w.certs && w.certs.pack)).length >= 2)) return fail("Needs standard work at Pack (level 1+) and two Pack-capable people.");
    x.active = true; x.retired = false; audit(n, "action", `Product activated: ${product(id).name}`);
  } else if (mode === "retire") {
    if (!x.active || x.retired) return fail("Not active"); if (mixOf(s).length <= 1) return fail("Keep at least one active product."); x.retired = true;
    audit(n, "action", `Product retired: ${product(id).name}. No new orders; open orders and inventory are still honored.`);
  } else if (mode === "resume") { x.retired = false; } else return fail("Unknown action");
  return { ok: true, state: n };
}
export function beginChapter(s, id) {
  const ch = CHAPTERS.find((c) => c.id === id); if (!ch) return fail("Unknown chapter");
  const n = clone(s); n.chapter = id; n.status = "active"; n.endDay = n.day + CFG.quarterDays - 1; n.snap = snapshot(n); n.rules = { ...n.rules, ...ch.rules, thr: ch.thr }; n.close = null; if (id >= 2) n.products.gift.unlocked = true;
  audit(n, "action", `Chapter ${id} begins: ${ch.name}`); return { ok: true, state: n };
}
export function setCover(s, on) { const n = clone(s); n.autoCover = !!on; return n; }
export function injectOrder(s, spec) { const n = clone(s), pr = product(spec.product); const o = makeOrder(n, { product: spec.product, qty: spec.qty, due: spec.due, urgency: spec.urgency, customer: spec.customer, kind: "transfer", priceMult: spec.price / pr.price }); return { state: n, order: o }; }
