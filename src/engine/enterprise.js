// Enterprise layer: several factories (each a full simulation state) under one corporate wrapper.
// Every cross-site movement is explicit and accounted for: cash via cf.corp, material via mat.adjust, work via transfer orders.
import { CFG, SCENARIOS, CHAPTERS, PROCESSES, RATES } from "../content/index.js";
import { newCampaign, stepDay, scorecard, view, pnl, beginChapter, injectOrder, invariants, mixOf, matAvail, snapshot, secOf, wipUnits } from "./sim.js";
const clone = (x) => structuredClone(x), fail = (reason) => ({ ok: false, reason });
const log = (s, kind, text) => { s.audit.push({ day: s.day, kind, text }); };

export function wrap(site, now = Date.now(), name = "Main campaign") {
  return { v: 1, kind: "enterprise", name, mode: "campaign", scenarioId: null, sites: { main: site }, order: ["main"], corp: { cash: 0, open: 0 }, capex: 0, openTotal: site.cash, transfers: [], nextT: 1,
    clock: { lastTs: now, dayMs: CFG.dayMs, rate: "standard" }, paused: false, result: null, campaignComplete: false, history: [] };
}
export const newEnterprise = (seed = 20260101, now = Date.now()) => wrap(newCampaign(seed, now), now);
export const mainSite = (e) => e.sites.main;

// ---------- time ----------
export function scenarioResult(e) {
  const sc = SCENARIOS.find((x) => x.id === e.scenarioId); if (!sc) return null; const s = e.sites.main, card = scorecard(s), dim = (id) => card.dims.find((d) => d.id === id), V = view(s), res = V.stats.resigned || 0;
  const failed = sc.id === "flow" ? s.cash < -3000 : res >= 2, over = s.status === "complete";
  if (!failed && !over) return null;
  const objectives = sc.id === "flow" ? [{ text: sc.objectives[0], pass: dim("del").pass }, { text: sc.objectives[1], pass: dim("fin").pass }, { text: sc.objectives[2], pass: dim("qual").pass }]
    : [{ text: sc.objectives[0], pass: dim("qual").pass }, { text: sc.objectives[1], pass: dim("eng").pass }, { text: sc.objectives[2], pass: res < 2 }, { text: sc.objectives[3], pass: dim("fin").pass }];
  return { status: failed ? "failed" : objectives.every((o) => o.pass) ? "passed" : "not met", failReason: failed ? sc.fail : null, objectives, day: s.day };
}
export function stepEnterprise(e) {
  const n = clone(e); if (n.result) return e;
  for (const id of n.order) if (n.sites[id].status === "active") n.sites[id] = stepDay(n.sites[id]);
  for (const t of n.transfers.filter((x) => x.status === "transit")) if (n.sites[t.to].day >= t.due) arrive(n, t);
  if (n.mode === "challenge") { n.result = scenarioResult(n); if (n.result) n.sites.main.status = "complete"; }
  return n;
}
export function catchUpEnt(e, now) {
  const none = { ent: e, days: 0, forfeited: 0, stopped: null, summary: null }, m = e.sites.main;
  if (e.result || e.paused || m.status !== "active" || e.clock.rate === "manual") return none;
  const whole = Math.floor((now - e.clock.lastTs) / e.clock.dayMs); if (!(whole >= 1)) return none;
  const n = Math.min(whole, CFG.maxCatchUp); let x = e, days = 0, stopped = null, shipped = 0, late = 0;
  while (days < n && !x.result && x.sites.main.status === "active") { x = stepEnterprise(x); days++; for (const id of x.order) { shipped += x.sites[id].last ? x.sites[id].last.shippedToday : 0; late += x.sites[id].last ? x.sites[id].last.lateToday : 0; } if (x.sites.main.event.tone === "bad" && x.sites.main.scenario.pausePolicy === "free") { stopped = x.sites.main.event; break; } }
  x = clone(x); x.clock.lastTs = e.clock.lastTs + (stopped ? days : whole) * e.clock.dayMs;
  return { ent: x, days, forfeited: stopped ? 0 : whole - days, stopped, summary: { days, shipped, late } };
}
export const manualAdvanceEnt = (e, now) => { const x = stepEnterprise(e); if (x === e) return e; const y = clone(x); y.clock.lastTs = Math.max(y.clock.lastTs, now); return y; };
export function setPausedEnt(e, paused, now = Date.now()) { if (paused && e.sites.main.scenario.pausePolicy !== "free") return fail("This challenge doesn't allow pausing."); const n = clone(e); n.paused = paused; if (!paused) n.clock.lastTs = now; return { ok: true, ent: n }; }

// ---------- chapters ----------
export function chapterStatus(e) { const s = e.sites.main, ch = CHAPTERS.find((c) => c.id === s.chapter) || CHAPTERS[3]; return { ch, complete: s.status === "complete", pass: scorecard(s).pass }; }
export function nextChapter(e) {
  const s = e.sites.main; if (e.mode !== "campaign" || s.status !== "complete") return fail("The chapter isn't over yet.");
  const card = scorecard(s), cur = s.chapter, retry = !card.pass && cur < 4, id = retry ? cur : Math.min(4, cur + 1), n = clone(e);
  n.history.push({ chapter: cur, pass: card.pass, profit: Math.round(card.profit), day: s.day });
  for (const sid of n.order) { const r = beginChapter(n.sites[sid], id); n.sites[sid] = r.state; }
  if (card.pass && cur === 3) n.campaignComplete = true;
  return { ok: true, ent: n, retry };
}

// ---------- corporate capital ----------
export function allocate(e, id, amt) { if (!e.sites[id] || !(amt > 0)) return fail("Choose a site and an amount."); if (e.corp.cash < amt) return fail("Corporate cash is too low."); const n = clone(e); n.corp.cash -= amt; n.sites[id].cash += amt; n.sites[id].cf.corp -= amt; log(n.sites[id], "action", `Corporate allocated $${amt}`); return { ok: true, ent: n }; }
export function remit(e, id, amt) { const s = e.sites[id]; if (!s || !(amt > 0)) return fail("Choose a site and an amount."); if (s.cash - amt < CFG.reserve) return fail(`The site must keep a $${CFG.reserve} reserve.`); const n = clone(e); n.sites[id].cash -= amt; n.sites[id].cf.corp += amt; n.corp.cash += amt; log(n.sites[id], "action", `Remitted $${amt} to corporate`); return { ok: true, ent: n }; }
export function expand(e, id) {
  if (e.mode !== "campaign") return fail("Expansion is a campaign decision."); if (e.sites[id]) return fail("That site exists."); if (e.order.length >= 3) return fail("Three sites is the maximum."); if (e.corp.cash < CFG.expandCost) return fail(`Corporate needs $${CFG.expandCost.toLocaleString()} (have $${Math.round(e.corp.cash).toLocaleString()}). Remit cash from a profitable site first.`);
  const n = clone(e), m = n.sites.main, s = newCampaign(m.seed + 7 * n.order.length, n.clock.lastTs);
  s.day = m.day; s.endDay = m.endDay; s.chapter = m.chapter; s.rules = clone(m.rules); s.products = clone(m.products); s.status = m.status;
  s.workers.forEach((w, i) => (w.name = `${id[0].toUpperCase() + id.slice(1)} ${i + 1}`));
  delete s.cont["WE-0010"]; delete s.cont["WE-0018"]; s.mach.pick.health = 70; s.mach.rcv.health = 70; // a different local starting position
  PROCESSES.forEach((p) => (s.baseSec[p.id] = secOf(s, p.id))); // this site's baseline is locked from ITS starting standards
  s.orders.forEach((o) => (o.due += s.day - 1)); s.cash = CFG.expandSeed; s.openCash = 0; s.cf.corp = -CFG.expandSeed; s.snap = snapshot(s);
  n.corp.cash -= CFG.expandCost; n.capex += CFG.expandCost - CFG.expandSeed; n.sites[id] = s; n.order.push(id); return { ok: true, ent: n };
}

// ---------- transfers (always take time and money; nothing teleports) ----------
export function transferMaterial(e, from, to, qty) {
  if (!e.sites[from] || !e.sites[to] || from === to || !(qty > 0)) return fail("Choose two different sites and a quantity."); const f = e.sites[from]; if (matAvail(f) < qty) return fail(`Only ${matAvail(f)} cartons are unreserved at the sending site.`);
  const n = clone(e), s = n.sites[from], fee = qty * CFG.matTransferFee; s.mat.onhand -= qty; s.mat.adjust -= qty; s.cash -= fee; s.fin.transfer += fee; s.cf.transfer += fee;
  n.transfers.push({ id: "T-" + n.nextT++, kind: "material", from, to, qty, fee, sent: s.day, due: s.day + CFG.transferDays, status: "transit" }); log(s, "action", `Shipped ${qty} cartons to ${to} (arrive day ${s.day + CFG.transferDays}, fee $${fee.toFixed(0)})`); return { ok: true, ent: n };
}
export function transferWork(e, from, to, oid, qty) {
  const f = e.sites[from], d = e.sites[to], o = f && f.orders.find((x) => x.id === oid); if (!o || !d || from === to || !(qty > 0)) return fail("Choose an order, a destination and a quantity.");
  if (o.status !== "open") return fail("Only open orders can move."); if (qty > o.qty - Math.max(o.released, 1)) return fail(`Only ${Math.max(0, o.qty - Math.max(o.released, 1))} unstarted units can move.`);
  if (!mixOf(d).some((m) => m.pr.id === o.product)) return fail("The destination site doesn't make this product.");
  const n = clone(e), s = n.sites[from], fee = qty * CFG.workTransferFee; s.orders.find((x) => x.id === oid).qty -= qty; s.cash -= fee; s.fin.transfer += fee; s.cf.transfer += fee;
  n.transfers.push({ id: "T-" + n.nextT++, kind: "work", from, to, qty, fee, sent: s.day, due: s.day + 1, status: "transit", spec: { customer: o.customer, product: o.product, qty, due: Math.max(o.due, s.day + 2), urgency: o.urgency, price: o.price }, orderRef: oid });
  log(s, "action", `Moved ${qty} unstarted units of ${oid} to ${to} (fee $${fee.toFixed(0)}); ${to} must still produce them`); return { ok: true, ent: n };
}
function arrive(n, t) {
  const d = n.sites[t.to];
  if (t.kind === "material") { d.mat.onhand += t.qty; d.mat.adjust += t.qty; log(d, "day", `Received ${t.qty} cartons from ${t.from}`); }
  else { const r = injectOrder(d, t.spec); n.sites[t.to] = r.state; log(n.sites[t.to], "action", `Received transferred work: ${r.order.id} (${t.qty} units) from ${t.from}`); }
  t.status = "done"; t.arrived = n.sites[t.to].day;
}

// ---------- reporting & reconciliation ----------
export function summary(e) {
  const rows = e.order.map((id) => { const s = e.sites[id], c = scorecard(s), V = view(s), dn = V.deliv.onTime + V.deliv.late; return { id, day: s.day, status: s.status, profit: c.profit, cash: s.cash, otd: dn ? V.deliv.onTime / dn : 1, fpy: V.stats.checked ? V.stats.passed1 / V.stats.checked : 1, eng: s.workers.reduce((t, w) => t + w.morale, 0) / s.workers.length, eh: s.eh.vlpg + s.eh.rcap, vlpg: s.eh.vlpg, rcap: s.eh.rcap, wip: wipUnits(s), pass: c.pass }; });
  return { rows, profit: rows.reduce((t, r) => t + r.profit, 0) - e.capex, cash: e.corp.cash + rows.reduce((t, r) => t + r.cash, 0), eh: rows.reduce((t, r) => t + r.eh, 0) };
}
export function reconcile(e) {
  const sites = e.order.map((id) => e.sites[id]), inv = sites.map(invariants), ext = sites.reduce((t, s) => t + s.openCash + s.cf.receipts - Object.entries(s.cf).filter(([k]) => k !== "receipts" && k !== "corp").reduce((a, [, v]) => a + v, 0), 0);
  const total = e.corp.cash + sites.reduce((t, s) => t + s.cash, 0), transit = e.transfers.filter((t) => t.kind === "material" && t.status === "transit").reduce((a, t) => a + t.qty, 0), adj = sites.reduce((t, s) => t + s.mat.adjust, 0);
  return [
    { name: "Every site reconciles (units, cartons, reservations, cash, Earned Hours)", pass: inv.every((i) => Object.values(i).every(Boolean)) },
    { name: "Enterprise cash = corporate opening + site operating flows − expansion capex (corporate transfers net to zero)", pass: Math.abs(total - (e.corp.open + ext - e.capex)) < 1e-6 },
    { name: "Cartons moved between sites net to zero (including those in transit)", pass: adj + transit === 0 },
    { name: "Every arrived transfer has a record; none arrive early", pass: e.transfers.every((t) => t.status === "transit" || (t.arrived >= t.due)) },
  ];
}

// Change the away-time rate mid-game. Time already elapsed is settled at the OLD rate first (bounded, same rules as catch-up), then the clock
// restarts at the new rate; any partial day is dropped rather than counted twice, so switching can never create or duplicate progress.
export function setRate(e, key, now = Date.now()) {
  const r = RATES[key]; if (!r) return fail("Unknown rate."); if (e.mode === "challenge") return fail("Challenges use a fixed rate so scores stay comparable.");
  const s = catchUpEnt(e, now), n = clone(s.ent); n.clock.rate = key; n.clock.dayMs = r.dayMs; n.clock.lastTs = Math.max(n.clock.lastTs, now);
  return { ok: true, ent: n, settled: s.days > 0 ? { ...s.summary, stopped: s.stopped } : null };
}
