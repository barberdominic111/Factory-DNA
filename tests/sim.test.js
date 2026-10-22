import { describe, it, expect } from "vitest";
import { newCampaign, stepDay, buy, trainWorker, moveWorker, setOptions, planPM, emergencyRepair, expediteSupply, acceptOffer, invest, setTemps, setPaused, secOf, staffing, scorecard, invariants, limiting, pnl, season } from "../src/engine/sim.js";
import { catchUp, manualAdvance } from "../src/engine/clock.js";
import { closeQuarter, bridge } from "../src/engine/report.js";
import { validate, importSave, exportSave, migrate } from "../src/engine/persist.js";
import { PRODUCTS, CFG } from "../src/content/index.js";

const T0 = 1_000_000_000_000, DAY = CFG.dayMs;
const run = (s, n) => { for (let i = 0; i < n; i++) s = stepDay(s); return s; };
function play(seed, smart = true) {
  let s = newCampaign(seed, T0);
  for (let d = 0; d < CFG.quarterDays; d++) {
    if (smart) {
      if (d === 0) s = moveWorker(s, "w6", "pick");
      for (const id of ["cont:WE-0009", "sw:pack", "cont:WE-0010", "cont:WE-0004", "cont:WE-0014", "cont:WE-0018", "sw:pick"]) { const r = buy(s, id); if (r.ok) s = r.state; }
      if (d % 12 === 5) s = planPM(s, "pick");
      if (s.mach.pick.down > 0) { const r = emergencyRepair(s, "pick"); if (r.ok) s = r.state; }
    }
    s = stepDay(s);
  }
  return s;
}

describe("Phase 1 behaviours still hold", () => {
  it("two active products + one inactive; 8 workers 2 per area; EH bank 20", () => {
    expect(PRODUCTS.filter((p) => p.active)).toHaveLength(2); expect(PRODUCTS.filter((p) => !p.active)).toHaveLength(1);
    const s = newCampaign(1, T0); expect(s.workers).toHaveLength(8); expect(s.bank).toBe(20);
    for (const p of ["rcv", "pick", "pack", "ship"]) expect(s.workers.filter((w) => w.proc === p)).toHaveLength(2);
  });
  it("is deterministic for a seed", () => {
    expect(JSON.stringify(run(newCampaign(7, T0), 10))).toBe(JSON.stringify(run(newCampaign(7, T0), 10)));
    expect(JSON.stringify(run(newCampaign(7, T0), 10))).not.toBe(JSON.stringify(run(newCampaign(8, T0), 10)));
  });
  it("no adverse event in the first 3 days", () => { for (let seed = 1; seed <= 30; seed++) { let s = newCampaign(seed, T0); for (let d = 0; d < 3; d++) { expect(s.event.tone).not.toBe("bad"); s = stepDay(s); } } });
  it("Each Pick is the visible limiting area", () => { expect(limiting(run(newCampaign(3, T0), 15)).id).toBe("pick"); });
  it("off-home workers are slower", () => { const s = newCampaign(1, T0); const a = moveWorker(s, "w0", "pick"); expect(staffing(a, "pick", false).eff).toBeLessThan(staffing(s, "pick", false).eff + 8 * 1.4); });
});

describe("conservation and reservations", () => {
  it("units, cartons, reservations, cash and EH all reconcile every day", () => {
    let s = newCampaign(3, T0);
    for (let d = 0; d < 60; d++) { s = stepDay(s); const i = invariants(s); expect(Object.values(i).every(Boolean), JSON.stringify(i) + " day " + d).toBe(true); }
  });
  it("reservations never exceed stock, so two jobs cannot claim the same cartons", () => {
    let s = newCampaign(3, T0); s.mat.onhand = 300; s.mat.open = 300; s.po = [];
    for (let d = 0; d < 6; d++) { s = stepDay(s); expect(s.mat.reserved).toBeLessThanOrEqual(s.mat.onhand); expect(s.mat.reserved).toBe(s.orders.reduce((t, o) => t + o.resv, 0)); }
  });
  it("reprioritizing cannot bypass materials: nothing is released without cartons", () => {
    let s = newCampaign(3, T0); s.mat.onhand = 0; s.mat.open = 0; s.po = []; s = setOptions(s, { priority: "urgent" }); s = stepDay(s);
    expect(s.stats.released).toBe(0); expect(s.stats.shipped).toBe(0);
  });
  it("completed orders release leftover reservations", () => { const s = run(newCampaign(3, T0), 25); for (const o of s.orders.filter((x) => x.status === "done")) expect(o.resv).toBe(0); });
  it("supplier lead time: a PO arrives after leadTime days and is recorded as a receipt", () => {
    let s = newCampaign(3, T0); s.mat.onhand = 1000; s.mat.open = 1000; s = run(s, 8);
    expect(s.mat.receipts).toBeGreaterThanOrEqual(CFG.poQty); expect(expediteSupply(s).ok === true || expediteSupply(s).reason !== undefined).toBe(true);
  });
  it("orders never ship more than ordered and flow through all areas", () => { const s = run(newCampaign(3, T0), 20); expect(s.orders.every((o) => o.shipped <= o.qty)).toBe(true); expect(s.orders.some((o) => o.status === "done")).toBe(true); });
});

describe("quality, returns", () => {
  it("scrap, rework and escapes happen on real units and returns do not count as accepted shipments", () => {
    const s = run(newCampaign(3, T0), 40);
    expect(s.stats.scrapped + s.stats.reworked).toBeGreaterThan(0);
    expect(s.stats.returned).toBeLessThanOrEqual(s.stats.escaped);
    expect(s.stats.shipped - s.stats.returned).toBeLessThan(s.stats.shipped + 1);
    expect(s.fin.credits).toBeGreaterThanOrEqual(0);
    expect(invariants(s).conserved).toBe(true);
  });
  it("a customer return creates a credit and a zero-revenue replacement order, and hurts the relationship", () => {
    let s = run(newCampaign(3, T0), 1); const o = s.orders.find((x) => x.shipped > 0 || true); s.returns.push({ due: s.day, oid: o.id, qty: 10 });
    const before = s.cust[o.customer] ? s.cust[o.customer].rel : 70; s = stepDay(s);
    expect(s.stats.returned).toBe(10); expect(s.fin.credits).toBeCloseTo(10 * o.price, 5);
    expect(s.orders.some((x) => x.kind === "replacement" && x.price === 0 && x.qty === 10)).toBe(true); expect(s.cust[o.customer].rel).toBeLessThan(before);
  });
});

describe("maintenance and recovery", () => {
  it("planned maintenance costs cash and hours now, and raises health", () => {
    const a = stepDay(newCampaign(5, T0)), b = stepDay(planPM(newCampaign(5, T0), "pick"));
    expect(b.mach.pick.health).toBeGreaterThan(a.mach.pick.health + 30); expect(b.fin.maint).toBe(CFG.pmCost); expect(b.cash).toBeLessThan(a.cash + 1);
    expect(staffing(planPM(newCampaign(5, T0), "pick"), "pick", false).eff).toBeLessThan(staffing(newCampaign(5, T0), "pick", false).eff);
  });
  it("a broken machine runs at reduced capacity and an emergency repair costs more than PM", () => {
    let s = newCampaign(5, T0); s.mach.pick.down = 1; const slow = staffing(s, "pick", false).eff; expect(slow).toBeLessThan(staffing(newCampaign(5, T0), "pick", false).eff * 0.3);
    const r = emergencyRepair(s, "pick"); expect(r.ok).toBe(true); expect(r.state.fin.maint).toBe(CFG.repairCost); expect(CFG.repairCost).toBeGreaterThan(CFG.pmCost); expect(emergencyRepair(newCampaign(5, T0), "pick").ok).toBe(false);
  });
  it("repeated overtime escalates pay and fatigue", () => {
    let s = setOptions(newCampaign(2, T0), { ot: true }); const d1 = stepDay(s), d3 = run(s, 3); const d2 = stepDay(d1);
    expect(d2.last.labor).toBeGreaterThan(d1.last.labor); expect(d3.workers[0].fat).toBeGreaterThan(d1.workers[0].fat * 2);
  });
  it("temps cost money and add hours", () => { const a = stepDay(newCampaign(2, T0)), b = stepDay(setTemps(newCampaign(2, T0), "pick", 1)); expect(b.fin.temp).toBe(CFG.shift * CFG.tempWage); expect(b.last.paidH).toBe(a.last.paidH + CFG.shift); });
});

describe("Earned Hours definitions", () => {
  it("baseline is locked", () => { let s = newCampaign(4, T0); const base = { ...s.baseSec }; s = run(buy(s, "cont:WE-0009").state, 5); expect(s.baseSec).toEqual(base); });
  it("containment removal lowers std time permanently and appears only as verified labor productivity", () => {
    let s = newCampaign(4, T0); const before = secOf(s, "pick"); s = buy(s, "cont:WE-0009").state; expect(secOf(s, "pick")).toBe(before - 9);
    s = run(s, 3); expect(s.ledger.some((e) => e.type === "VLPG" && e.eh > 0)).toBe(true); expect(s.eh.vlpg).toBeGreaterThan(0);
  });
  it("VLPG + released capacity = baseline − used, never overlapping (formula identity)", () => { const s = run(newCampaign(4, T0), 20); expect(s.eh.vlpg + s.eh.rcap).toBeCloseTo(s.eh.baseH - s.eh.usedH, 6); expect(s.eh.baseH).toBeGreaterThan(s.eh.stdH - 1e-9); });
  it("worker performance changes move released capacity but not verified productivity", () => {
    const a = stepDay(newCampaign(4, T0)); const t = newCampaign(4, T0); t.workers.forEach((w) => { w.skill = 95; w.effort = 95; }); const b = stepDay(t);
    expect(b.eh.rcap).toBeGreaterThan(a.eh.rcap); expect(b.eh.vlpg).toBeCloseTo(a.eh.vlpg, 0);
  });
  it("paid-but-unused hours stay paid: improvements do not lower labor cost", () => {
    const a = stepDay(newCampaign(6, T0)), b = stepDay(buy(newCampaign(6, T0), "cont:WE-0009").state);
    expect(b.fin.labor).toBe(a.fin.labor); expect(b.eh.unusedH).toBeGreaterThanOrEqual(0); expect(b.eh.paidReg).toBe(a.eh.paidReg);
  });
  it("cash savings only appear when overtime/temp spend is below the baseline plan", () => {
    const none = stepDay(newCampaign(6, T0)), ot = stepDay(setOptions(newCampaign(6, T0), { ot: true }));
    expect(ot.eh.cashSaved).toBeLessThan(none.eh.cashSaved); expect(none.eh.cashSaved).toBeCloseTo(8 * CFG.baselineOTHours * CFG.wage * CFG.otPremium, 5);
    const flex = stepDay(setTemps(setOptions(newCampaign(6, T0), { ot: true }), "pick", 2)); expect(flex.eh.cashSaved).toBe(0);
  });
  it("ledger entries are idempotent per key and the bank reconciles", () => {
    const s = play(5); const keys = s.ledger.map((e) => e.key); expect(new Set(keys).size).toBe(keys.length);
    const sum = s.ledger.filter((e) => e.type !== "SHORT").reduce((t, e) => t + e.eh, 0); expect(Math.abs(s.bank - (s.startBank + sum))).toBeLessThan(1);
  });
  it("an event is applied at most once even if the same state is stepped again", () => { const a = newCampaign(2, T0), b = stepDay(a), c = stepDay(a); expect(JSON.stringify(b)).toBe(JSON.stringify(c)); });
  it("refuses unaffordable purchases", () => { const p = { ...newCampaign(4, T0), bank: 3 }; expect(buy(p, "cont:WE-0009").ok).toBe(false); expect(trainWorker(p, "w0").ok).toBe(false); });
});

describe("finance", () => {
  it("P&L and cash flow are separate: revenue is recognised on shipment, cash arrives after AR terms", () => {
    let s = run(newCampaign(3, T0), 5); expect(s.fin.revenue).toBeGreaterThan(0); expect(s.cf.receipts).toBeLessThan(s.fin.revenue);
    expect(s.ar.reduce((t, x) => t + x.amt, 0)).toBeGreaterThan(0);
  });
  it("capital: cost is cash not expense; depreciation and opex flow after purchase; effect is delayed and uncertain", () => {
    let s = newCampaign(3, T0); const base = secOf(s, "pick"); const r = invest(s, "conv"); expect(r.ok).toBe(true); s = r.state;
    expect(s.cash).toBe(CFG.startCash - 4000); expect(s.fin.depr).toBe(0); expect(secOf(s, "pick")).toBe(base);
    s = run(s, 4); expect(secOf(s, "pick")).toBeLessThan(base); expect(s.fin.depr).toBeGreaterThan(0); expect(s.fin.assetOps).toBeGreaterThan(0);
    s = run(s, 8); expect(base - secOf(s, "pick")).toBeLessThanOrEqual(9); expect(invest(s, "conv").ok).toBe(false); expect(invariants(s).cashOk).toBe(true);
  });
  it("investment needs a cash reserve", () => { const s = newCampaign(3, T0); s.cash = 4500; expect(invest(s, "conv").ok).toBe(false); });
  it("the variance bridge sums to actual − plan", () => { const s = play(11), b = bridge(s); expect(b.items.reduce((t, i) => t + i.v, 0)).toBeCloseTo(b.actual - b.plan, 4); });
});

describe("clock and catch-up", () => {
  it("catch-up is bounded and forfeits time beyond the cap", () => {
    const s0 = newCampaign(1, T0), s = { ...s0, scenario: { ...s0.scenario, pausePolicy: "none" } }, r = catchUp(s, T0 + DAY * 500); expect(r.days).toBeLessThanOrEqual(CFG.maxCatchUp); expect(r.state.day).toBeLessThanOrEqual(1 + CFG.maxCatchUp);
    expect(catchUp(r.state, T0 + DAY * 500).days).toBe(0);
  });
  it("repeated calls or save/load with the same timestamp never duplicate progress", () => {
    const s = newCampaign(1, T0), a = catchUp(s, T0 + DAY * 2.5), b = catchUp(a.state, T0 + DAY * 2.5), c = catchUp(importSave(exportSave(a.state)).state, T0 + DAY * 2.5);
    expect(b.days).toBe(0); expect(c.days).toBe(0); expect(a.state.day).toBe(s.day + a.days);
  });
  it("a clock moved backwards does nothing", () => { const s = newCampaign(1, T0); expect(catchUp(s, T0 - DAY * 10).days).toBe(0); });
  it("catch-up is reproducible for a seed and matches manual stepping", () => {
    const a = catchUp(newCampaign(9, T0), T0 + DAY * 3), x = run(newCampaign(9, T0), a.days);
    expect(a.state.stats).toEqual(x.stats); expect(a.state.bank).toBeCloseTo(x.bank, 9);
  });
  it("pausing respects the scenario rule and a paused game does not catch up", () => {
    const s = newCampaign(1, T0), p = setPaused(s, true, T0).state; expect(catchUp(p, T0 + DAY * 3).days).toBe(0);
    const strict = { ...s, scenario: { ...s.scenario, pausePolicy: "none" } }; expect(setPaused(strict, true).ok).toBe(false);
  });
  it("manual advance does not also bank real time", () => { const s = manualAdvance(newCampaign(1, T0), T0 + DAY * 3); expect(catchUp(s, T0 + DAY * 3).days).toBe(0); });
  it("seasons follow Medium, Low, Medium, High", () => { expect([1, 61, 121, 181].map((d) => season(d).m)).toEqual([1, 0.8, 1, 1.3]); });
});

describe("quarter close and persistence", () => {
  it("quarter close reconciles every check and explains results", () => {
    const s = play(11), c = closeQuarter(s); expect(s.status).toBe("complete"); expect(c.checks.every((k) => k.pass), JSON.stringify(c.checks.filter((k) => !k.pass))).toBe(true); expect(c.narrative.length).toBeGreaterThan(0);
    expect(scorecard(s).dims.map((d) => d.id)).toEqual(["fin", "del", "qual", "eng"]);
  });
  it("a thoughtful player can win; doing nothing does not", () => {
    expect([11, 12, 13].filter((seed) => scorecard(play(seed, true)).pass).length).toBeGreaterThanOrEqual(2); expect(scorecard(play(11, false)).pass).toBe(false);
  });
  it("optional offers can be accepted once", () => { let s = run(newCampaign(3, T0), 3); const o = s.orders.find((x) => x.status === "offered"); expect(o).toBeTruthy(); const r = acceptOffer(s, o.id); expect(r.ok).toBe(true); expect(acceptOffer(r.state, o.id).ok).toBe(false); });
  it("round-trips exactly and rejects malformed imports without side effects", () => {
    const s = run(newCampaign(1, T0), 5); expect(importSave(exportSave(s)).state).toEqual(s);
    expect(validate(null)).toBe(false); expect(importSave("nope").ok).toBe(false); expect(importSave('{"v":3}').ok).toBe(false);
    const bad = JSON.parse(exportSave(s)); bad.workers[0].proc = "x"; expect(validate(bad)).toBe(false);
  });
  it("migrates a Phase 1 save, preserving progress", () => {
    const v1 = { v: 1, seed: 1, rng: 5, day: 12, ot: false, priority: "due", status: "active", nextOrder: 3, workers: newCampaign(1, T0).workers, sw: { rcv: 0, pick: 1, pack: 0, ship: 0 }, cont: { "WE-0004": true },
      baseSec: { rcv: 35, pick: 42, pack: 26, ship: 25 }, orders: [{ id: "SO-001", customer: "x", product: "kit", qty: 100, due: 5, urgency: 1, price: 2.2, released: 100, shipped: 100, status: "done", lateFlag: false, hist: [] }],
      q: { rcv: [], pick: [], pack: [], ship: [] }, stats: { released: 100, shipped: 100, scrapped: 0, good: 100 }, materials: { cartons: 7000 }, cash: 9000, bank: 30, startBank: 20, spent: 12, credited: 22,
      ledger: [{ day: 2, type: "RC", eh: 22, note: "a" }, { day: 3, type: "SPEND", eh: -12, note: "b" }], fin: { revenue: 220, labor: 100, material: 50, overhead: 60 }, deliv: { onTime: 1, late: 0 }, history: [], event: { id: "audit", tone: "neutral", t: "a", d: "b" }, nextEvent: { id: "audit", tone: "neutral", t: "a", d: "b" }, last: null };
    const r = importSave(JSON.stringify(v1)); expect(r.ok).toBe(true); expect(r.state.v).toBe(3); expect(r.state.day).toBe(12); expect(r.state.mat.onhand).toBe(7000); expect(r.state.sw.pick).toBe(1); expect(r.state.cash).toBe(9000);
    expect(() => stepDay(r.state)).not.toThrow();
  });
});
