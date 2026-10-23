import React, { useState } from "react";
import { PROCESSES, CFG, INVESTMENTS } from "../content/index.js";
import { risk, matAvail, matCoverDays, staffing, secOf, pnl } from "../engine/sim.js";
import { bridge, closeQuarter } from "../engine/report.js";
import { Card, H, Bar, Btn } from "./Screens.jsx";

const $ = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const Row = ({ a, b, bold }) => <div className={"flex justify-between text-xs py-1 border-b border-stone-100 " + (bold ? "font-black" : "")}><span>{a}</span><span className="font-mono">{b}</span></div>;
const Fold = ({ title, children, open }) => <details open={open} className="bg-white rounded-3xl shadow-sm p-4"><summary className="font-bold text-stone-600 cursor-pointer min-h-[32px]">{title}</summary><div className="mt-2">{children}</div></details>;

export function Ops({ s, act, msg }) {
  const cover = matCoverDays(s), warn = cover < 2.5;
  return (
    <div className="space-y-3">
      {msg && <div className="text-xs font-bold bg-amber-50 rounded-xl px-3 py-2" role="status">{msg}</div>}
      <Card><H>📦 Cartons (shared by both products)</H>
        <div className={"text-sm font-bold " + (warn ? "text-rose-700" : "text-emerald-700")}>{warn ? "⚠ LOW COVER: " : "✔ OK: "}{cover.toFixed(1)} days available</div>
        <div className="text-[11px] text-stone-600 font-mono">On hand {s.mat.onhand} · reserved for released jobs {s.mat.reserved} · available {matAvail(s)}</div>
        {s.po.map((p) => <div key={p.id} className="text-xs font-mono">{p.id}: {p.qty} due day {p.due}</div>)}{!s.po.length && <div className="text-xs text-stone-600">No open purchase orders</div>}
        <div className="mt-2 flex items-center gap-2"><Btn onClick={() => act("expedite")} disabled={!s.po.length}>Expedite (${CFG.expediteCost})</Btn><span className="text-[11px] text-stone-600">Arrives tomorrow; costs cash. Corporate assistance isn't available in this scenario.</span></div></Card>
      <Card><H>🛠️ Machines</H>{PROCESSES.map((p) => { const m = s.mach[p.id], r = risk(m.health); return (
        <div key={p.id} className="bg-stone-50 rounded-xl px-3 py-2 mb-2"><div className="flex justify-between text-sm font-bold"><span>{p.icon} {p.machine}</span><span>{m.down > 0 ? "BROKEN" : "Breakdown risk: " + r}</span></div>
          <Bar v={m.health} c={m.health < 40 ? "bg-rose-400" : m.health < 65 ? "bg-amber-400" : "bg-emerald-400"} /><div className="text-[10px] text-stone-600 mb-1">Health {Math.round(m.health)}/100 · low health slows output, raises defects and breakdown odds</div>
          <div className="flex gap-2 flex-wrap"><Btn onClick={() => act("pm", p.id)} c={s.pm[p.id] ? "bg-teal-800" : "bg-teal-700"}>{s.pm[p.id] ? "✓ PM planned tomorrow" : `Plan PM ($${CFG.pmCost}, −${CFG.pmHours}h)`}</Btn>
            <Btn onClick={() => act("repair", p.id)} disabled={m.down <= 0} c="bg-rose-700 hover:bg-rose-800">Emergency repair (${CFG.repairCost})</Btn></div></div>); })}</Card>
      <Card><H>👷 Temporary labor (${CFG.tempWage}/h, 70% pace, max {CFG.maxTemps})</H><div className="flex flex-wrap gap-2">{PROCESSES.map((p) => <div key={p.id} className="flex items-center gap-1 text-xs font-bold bg-stone-50 rounded-xl px-2 min-h-[44px]">{p.name}<button className="w-8 h-8 rounded-lg bg-white border" onClick={() => act("temp", p.id, -1)}>−</button>{s.temps[p.id]}<button className="w-8 h-8 rounded-lg bg-white border" onClick={() => act("temp", p.id, 1)}>+</button></div>)}</div></Card>
      <Card><H>🏗️ Capital investments (cash ${Math.round(s.cash).toLocaleString()})</H>{INVESTMENTS.map((i) => { const a = s.assets.find((x) => x.id === i.id), perDay = i.sec * 1053 * 1.35 / 3600 * CFG.wage * 0.85 - i.opex; return (
        <div key={i.id} className="bg-stone-50 rounded-xl px-3 py-2"><div className="font-bold text-sm">{i.name} — {$(i.cost)}</div><div className="text-[11px] text-stone-600">{i.desc}</div>
          <div className="text-[11px] text-stone-600 font-mono mt-1">Operating cost ${i.opex}/day · depreciation ${(i.cost / i.life).toFixed(0)}/day · est. net labor value ≈ ${Math.round(perDay)}/day · payback ≈ {perDay > 0 ? Math.round(i.cost / perDay) + " days (estimate)" : "n/a"}</div>
          <div className="text-[10px] text-stone-600 mb-2">{i.assumptions} Uncertainty is real: you may realize less than 9s.</div>
          {a ? <div className="text-xs font-bold text-teal-700">Purchased day {a.day} · online day {a.day + i.install}</div> : <Btn onClick={() => act("invest", i.id)} disabled={s.cash < i.cost + CFG.reserve}>Buy ({$(i.cost)})</Btn>}</div>); })}</Card>
    </div>
  );
}

export function Reports({ s }) {
  const p = pnl(s), f = s.fin, b = bridge(s), c = closeQuarter(s), e = s.eh, cf = s.cf, out = Object.entries(cf).filter(([k]) => k !== "receipts").reduce((t, [, v]) => t + v, 0);
  const [aud, setAud] = useState("incident");
  const custs = Object.entries(s.cust);
  return (
    <div className="space-y-3">
      <Fold title={`Profit & loss (accrual) — profit ${$(p.profit)}`} open><Row a="Revenue (recognised when shipped)" b={$(f.revenue)} /><Row a="Customer credits (returns)" b={$(-f.credits)} />
        {[["Materials (COGS)", f.cogs], ["Scrap & rework", f.scrapRework], ["Direct labor", f.labor], ["Overtime", f.overtime], ["Temporary labor", f.temp], ["Maintenance", f.maint], ["Expedite", f.expedite], ["Operating expenses", f.opex], ["Contract penalties", f.penalties], ["Depreciation", f.depr], ["Asset operating cost", f.assetOps]].map(([a, v]) => <Row key={a} a={a} b={$(-v)} />)}<Row a="Quarter profit" b={$(p.profit)} bold /></Fold>
      <Fold title={`Cash flow — closing ${$(s.cash)}`}><Row a="Opening cash" b={$(s.openCash)} /><Row a="Customer receipts (paid after 10 days)" b={$(cf.receipts)} />
        {[["Supplier (cartons)", cf.supplier], ["Components", cf.components], ["Payroll & temps", cf.payroll], ["Operating expenses", cf.opex], ["Maintenance", cf.maint], ["Capital investment", cf.capital], ["Penalties", cf.penalties], ["Expedite", cf.expedite]].map(([a, v]) => <Row key={a} a={a} b={$(-v)} />)}
        <Row a="Closing cash" b={$(s.openCash + cf.receipts - out)} bold /><div className="text-[11px] text-stone-600 mt-1">Profit ≠ cash: unpaid customer invoices ({$(s.ar.reduce((t, x) => t + x.amt, 0))}) are profit not yet cash.</div></Fold>
      <Fold title={`Earned Hours — total ${(e.vlpg + e.rcap).toFixed(0)} h`}>
        <div className="text-[11px] text-stone-600 mb-2">Verified labor productivity = baseline hours − current standard hours (work content removed). Released capacity = standard hours − hours actually used (pace/performance). Total = baseline − used. They never overlap, and neither is cash. Cash savings count only when overtime + temp cost is below the locked plan.</div>
        {[["Baseline hours (locked)", e.baseH], ["Current standard hours", e.stdH], ["Actual productive hours", e.usedH], ["① Verified labor productivity", e.vlpg], ["② Released capacity", e.rcap], ["Paid regular hours", e.paidReg], ["Paid overtime hours", e.paidOT], ["Temp hours", e.tempH], ["Unused paid hours (still paid)", e.unusedH]].map(([a, v]) => <Row key={a} a={a} b={v.toFixed(1) + " h"} />)}<Row a="Temp labor cost" b={$(e.tempCost)} /><Row a="Cash savings recognised vs plan" b={$(e.cashSaved)} bold /></Fold>
      <Fold title="Variance bridge: plan → actual"><Row a="Plan profit (locked)" b={$(b.plan)} bold />{b.items.map((i) => <div key={i.k} className="text-xs py-1 border-b border-stone-100"><div className="flex justify-between"><span>{i.k}</span><span className={"font-mono " + (i.v < 0 ? "text-rose-700" : "text-emerald-700")}>{$(i.v)}</span></div><div className="text-[10px] text-stone-600">{i.note}</div></div>)}<Row a="Actual profit" b={$(b.actual)} bold /></Fold>
      <Fold title={`Reconciliation — ${c.pass ? "all checks pass" : "CHECK FAILED"}`}>{c.checks.map((k) => <Row key={k.name} a={(k.pass ? "✔ " : "✖ ") + k.name} b={k.pass ? "OK" : "FAIL"} />)}<div className="mt-2 space-y-1">{c.narrative.map((n, i) => <div key={i} className="text-xs text-stone-600">• {n}</div>)}</div></Fold>
      <Fold title="Customer relationships">{custs.length ? custs.map(([n, c2]) => <div key={n} className="text-xs py-1"><div className="flex justify-between"><b>{n}</b><span>Relationship {Math.round(c2.rel)}/100</span></div><Bar v={c2.rel} /><div className="text-[10px] text-stone-600">On time {c2.onTime} · late {c2.late} · returned units {c2.returns}</div></div>) : <div className="text-xs text-stone-600">No completed orders yet</div>}</Fold>
      <Fold title="Audit history"><div className="flex gap-2 mb-2">{["incident", "action", "day"].map((k) => <button key={k} onClick={() => setAud(k)} className={"text-xs font-bold px-3 min-h-[40px] rounded-xl " + (aud === k ? "bg-orange-700 text-white" : "bg-stone-100")}>{k === "day" ? "Daily" : k === "incident" ? "Incidents" : "Actions"}</button>)}</div>
        <div className="max-h-64 overflow-y-auto">{s.audit.filter((a) => a.kind === aud).slice(-40).reverse().map((a, i) => <div key={i} className="text-xs py-1 border-b border-stone-100"><b className="font-mono">D{a.day}</b> {a.text}</div>)}</div></Fold>
    </div>
  );
}
