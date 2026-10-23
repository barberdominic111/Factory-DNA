// Quarter close: deterministic reconciliation, variance bridge and root-cause narrative.
import { CFG, PRODUCTS } from "../content/index.js";
import { AVG_UNITS_DAY, pnl, invariants, activeProducts, view } from "./sim.js";
const sh = (s, x) => (typeof x === "number" ? x : 0);
export function plan(days = CFG.quarterDays) { // locked plan = what the inherited plant was expected to earn at average demand with no overtime and no temps
  const d = days, units = AVG_UNITS_DAY * d, ap = activeProducts();
  const rev = units * ap.reduce((t, p) => t + p.share * p.price, 0), mat = units * ap.reduce((t, p) => t + p.share * p.mat, 0), labor = 8 * CFG.shift * CFG.wage * d, opex = CFG.overhead * d;
  return { units, rev, mat, labor, opex, profit: rev - mat - labor - opex, revPU: rev / units, matPU: mat / units };
}
export function bridge(s) {
  const V = view(s), P = plan(s.endDay - V.startDay + 1), f = V.fin, units = V.stats.shipped, actual = pnl(s).profit, items = [];
  const grossRev = f.revenue, material = f.cogs;
  items.push({ k: "Volume", v: (units - P.units) * (P.revPU - P.matPU), note: "Units shipped vs plan × plan margin per unit" });
  items.push({ k: "Price / product mix", v: grossRev - units * P.revPU, note: "Revenue per unit vs plan (mix of kits, bundles, contract prices, replacements at $0)" });
  items.push({ k: "Materials", v: -(material - units * P.matPU), note: "Material cost of good units vs plan per unit" });
  items.push({ k: "Quality losses", v: -(f.scrapRework + f.credits + f.penalties), note: "Scrap, rework, customer credits and contract penalties" });
  items.push({ k: "Overtime & temps", v: -(f.overtime + f.temp), note: "Plan assumes none" });
  items.push({ k: "Downtime & maintenance", v: -(f.maint), note: "Planned and emergency maintenance spend (lost output shows up in Volume)" });
  items.push({ k: "Investments", v: -(f.depr + f.assetOps), note: "Depreciation and operating cost of purchased assets" });
  items.push({ k: "Expedite & other opex", v: -(f.expedite + (f.transfer || 0) + (f.opex - P.opex)), note: "Expedite fees plus opex vs plan" });
  items.push({ k: "Productivity", v: 0, note: "Earned Hours are capacity, not cash: they show up here only via the lines above (e.g. less overtime)" });
  const labor = -(f.labor - P.labor), explained = items.reduce((t, i) => t + i.v, 0) + labor;
  items.push({ k: "Regular labor vs plan", v: labor, note: "Headcount cost vs plan" });
  items.push({ k: "Unattributed (rounding / timing)", v: actual - P.profit - explained - 0, note: "Residual so the bridge always sums to actual − plan" });
  return { plan: P.profit, actual, items };
}
export function closeQuarter(s) {
  const inv = invariants(s), p = pnl(s), f = s.fin, V = view(s), cfOut = Object.entries(s.cf).filter(([k]) => k !== "receipts").reduce((t, [, v]) => t + v, 0);
  const revCheck = s.orders.reduce((t, o) => t + o.shipped * o.price, 0) + (s.archRev || 0);
  const checks = [
    { name: "Units: released = WIP + shipped + scrapped", pass: inv.conserved },
    { name: "Orders never ship more than ordered", pass: inv.shippedOk },
    { name: "Cartons: opening + receipts − consumed = on hand", pass: inv.materialsOk },
    { name: "Reservations match order reservations and never exceed stock", pass: inv.reservedOk },
    { name: "Earned Hours: VLPG + released capacity = baseline − used hours", pass: inv.ehOk },
    { name: "EH bank = opening + credits − spend", pass: inv.bankOk },
    { name: "Cash: opening + receipts − payments = closing", pass: inv.cashOk },
    { name: "Revenue = Σ shipped × price", pass: Math.abs(f.revenue - revCheck) < 0.01 },
    { name: "P&L: profit = net revenue − costs", pass: Math.abs(p.profit - (V.fin.revenue - V.fin.credits - p.costs)) < 1e-6 },
  ];
  const b = bridge(s), bad = b.items.filter((i) => i.v < -50 && i.k !== "Unattributed (rounding / timing)").sort((a, c) => a.v - c.v).slice(0, 3), good = b.items.filter((i) => i.v > 50).sort((a, c) => c.v - a.v).slice(0, 2);
  const narrative = [...good.map((i) => `Favorable — ${i.k}: +$${Math.round(i.v)} (${i.note}).`), ...bad.map((i) => `Unfavorable — ${i.k}: −$${Math.round(-i.v)} (${i.note}).`)];
  return { checks, pass: checks.every((c) => c.pass), bridge: b, narrative, cash: { open: s.openCash, receipts: s.cf.receipts, payments: cfOut, close: s.cash }, pnl: p, eh: s.eh };
}
