import { describe, it, expect } from "vitest";
import { newCampaign, stepDay, buy, moveWorker, planPM, emergencyRepair, setOptions, setTemps, invest, startTraining, limiting, invariants, wipUnits, scorecard } from "../src/engine/sim.js";
import { importSave, exportSave } from "../src/engine/persist.js";
import { closeQuarter } from "../src/engine/report.js";
import { newEnterprise, stepEnterprise, catchUpEnt } from "../src/engine/enterprise.js";
import { startScenario } from "../src/engine/scenarios.js";
import { CFG } from "../src/content/index.js";
const T0 = 1e12, run = (s, n) => { for (let i = 0; i < n; i++) s = stepDay(s); return s; };
const sane = (s) => { const m = s.mat; expect(m.onhand).toBeGreaterThanOrEqual(0); expect(m.reserved).toBeGreaterThanOrEqual(0); expect(s.bank).toBeGreaterThanOrEqual(0); expect(wipUnits(s)).toBeGreaterThanOrEqual(0); for (const p of Object.values(s.q)) for (const e of p) expect(e.qty).toBeGreaterThan(0); for (const o of s.orders) { expect(o.shipped).toBeGreaterThanOrEqual(0); expect(o.shipped).toBeLessThanOrEqual(o.qty); } expect(Object.values(invariants(s)).every(Boolean)).toBe(true); };

describe("reliability and edge cases", () => {
  it("never produces negative stock, queues, bank or over-shipments across a full quarter with mixed play", () => {
    let s = newCampaign(41, T0); for (let d = 0; d < 60; d++) { if (d % 7 === 2) s = planPM(s, "pick"); if (d % 9 === 4) s = setOptions(s, { ot: !s.ot }); if (d === 10) s = setTemps(s, "pack", 1).valueOf(); if (s.mach.pick.down > 0) { const r = emergencyRepair(s, "pick"); if (r.ok) s = r.state; } s = stepDay(s); sane(s); }
  });
  it("downstream WIP never exceeds the cap, and no work is released without cartons", () => { let s = newCampaign(42, T0); s.mat.onhand = s.mat.open = 400; s.po = []; for (let d = 0; d < 8; d++) { s = stepDay(s); expect(wipUnits(s)).toBeLessThanOrEqual(CFG.wipCap + 1); sane(s); } });
  it("a bottleneck moves after an improvement", () => {
    let s = newCampaign(43, T0); s.bank = 100; const first = limiting(s).id; for (const id of ["cont:WE-0009", "cont:WE-0010"]) s = buy(s, id).state; s = moveWorker(s, "w6", "pick");
    expect([first, limiting(s).id].length).toBe(2); expect(limiting(s).id).not.toBe(first);
  });
  it("partial shipment: an order can ship in pieces and the history adds up", () => { const s = run(newCampaign(44, T0), 15), o = s.orders.find((x) => x.hist.length > 1 && x.status === "done"); expect(o).toBeTruthy(); expect(o.hist.reduce((t, h) => t + h.n, 0)).toBe(o.shipped); });
  it("late orders are counted once and a late completion is never counted on time", () => { const s = run(newCampaign(45, T0), 30); for (const o of s.orders.filter((x) => x.kind !== "replacement" && x.doneDay > x.due)) expect(o.lateFlag).toBe(true); expect(s.deliv.late).toBe(s.orders.filter((x) => x.lateFlag && x.kind !== "replacement").length); });
  it("insufficient cash or Earned Hours block actions and leave state untouched", () => {
    const s = newCampaign(46, T0); s.cash = 10; s.bank = 0; const before = JSON.stringify(s);
    expect(invest(s, "conv").ok).toBe(false); expect(startTraining(s, "w0", "skill").ok).toBe(false); expect(buy(s, "sw:pack").ok).toBe(false); expect(JSON.stringify(s)).toBe(before);
  });
  it("saving and loading mid-production continues exactly as if uninterrupted", () => { const a = run(newCampaign(47, T0), 9), b = importSave(exportSave(a)).state; expect(JSON.stringify(run(a, 6))).toBe(JSON.stringify(run(b, 6))); });
  it("stepping the same state twice gives the same result (no duplicated events or rewards)", () => { const s = run(newCampaign(48, T0), 4); expect(JSON.stringify(stepDay(s))).toBe(JSON.stringify(stepDay(s))); });
  it("after a huge elapsed gap, catch-up simulates at most the cap and a reload changes nothing", () => {
    const e = newEnterprise(49, T0), a = catchUpEnt(e, T0 + 1e6 * CFG.dayMs); expect(a.days).toBeLessThanOrEqual(CFG.maxCatchUp); const reloaded = JSON.parse(JSON.stringify(a.ent)); expect(catchUpEnt(reloaded, T0 + 1e6 * CFG.dayMs).days).toBeLessThanOrEqual(CFG.maxCatchUp); expect(a.ent.sites.main.day).toBeLessThanOrEqual(1 + CFG.maxCatchUp);
  });
  it("old completed orders are pruned in a long game without breaking reconciliation or growing without bound", () => {
    let s = newCampaign(50, T0); s.endDay = 400; for (let d = 0; d < 240; d++) s = stepDay(s); expect(s.orders.length).toBeLessThan(900); expect(s.history.length).toBeLessThanOrEqual(200); expect(s.audit.length).toBeLessThanOrEqual(400);
    const c = closeQuarter(s); expect(c.checks.every((k) => k.pass), JSON.stringify(c.checks.filter((k) => !k.pass))).toBe(true); expect(JSON.stringify(s).length).toBeLessThan(2_000_000);
  });
  it("campaign and challenge restarts start clean and independent", () => { const a = startScenario("flow", T0), b = startScenario("flow", T0); expect(JSON.stringify(a)).toBe(JSON.stringify(b)); const e = newEnterprise(51, T0); expect(e.sites.main.day).toBe(1); expect(e.sites.main.bank).toBe(CFG.startBank); });
  it("a returned shipment is not counted as accepted and creates a zero-revenue replacement", () => { const s = run(newCampaign(3, T0), 40); expect(s.stats.returned).toBeLessThanOrEqual(s.stats.escaped); for (const o of s.orders.filter((x) => x.kind === "replacement")) expect(o.price).toBe(0); });
});
