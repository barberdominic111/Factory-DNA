import React, { useState } from "react";
import { PROCESSES, ELEMENTS, PRODUCTS, CFG } from "../content/index.js";
import { improvements, secOf, proc, product, scorecard, perfW } from "../engine/sim.js";
import { closeQuarter } from "../engine/report.js";
import { exportSave, importSave } from "../engine/persist.js";

export const Card = ({ children, className = "" }) => <div className={"bg-white rounded-3xl shadow-sm p-4 " + className}>{children}</div>;
export const H = ({ children }) => <div className="font-bold text-stone-600 mb-2">{children}</div>;
export const Bar = ({ v, c = "bg-teal-400" }) => <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden"><div className={"h-full " + c} style={{ width: Math.max(0, Math.min(100, v)) + "%" }} /></div>;
export const Btn = ({ onClick, disabled, children, c = "bg-orange-700 hover:bg-orange-800" }) => <button onClick={onClick} disabled={disabled} className={`${c} text-white font-bold rounded-2xl px-4 min-h-[44px] disabled:opacity-40 flex items-center justify-center gap-2`}>{children}</button>;
const status = (s, o) => o.status === "offered" ? "Offer (optional)" : o.status === "expired" || o.status === "declined" ? "Not taken" : o.status === "done" ? (o.doneDay <= o.due ? "Shipped on time" : "Shipped late") : s.day > o.due ? "LATE" : o.due - s.day <= 1 ? "Due soon" : "On track";

export function Orders({ s, onOffer }) {
  const [open, setOpen] = useState(null);
  const list = [...s.orders].filter((o) => o.status !== "expired" && o.status !== "declined").sort((a, b) => (a.status === "done") - (b.status === "done") || (a.status === "offered") - (b.status === "offered") || a.due - b.due);
  return (
    <Card><H>Orders ({s.orders.filter((o) => o.status === "open").length} open)</H>
      {list.slice(0, 40).map((o) => (
        <button key={o.id} onClick={() => setOpen(open === o.id ? null : o.id)} className="w-full text-left bg-stone-50 rounded-xl px-3 py-2 mb-2 min-h-[44px]">
          <div className="flex justify-between text-sm"><b>{o.id} · {product(o.product).icon} {o.qty} · {o.kind === "contract" ? "CONTRACT" : o.kind === "optional" ? "optional" : o.kind === "replacement" ? "replacement ($0)" : o.kind === "rush" ? "RUSH" : "spot"}</b><span className="font-bold text-stone-600">{status(s, o)}</span></div>
          <div className="text-[11px] text-stone-600">{o.customer} · due day {o.due} · urgency {o.urgency}/3 · ${(o.qty * o.price).toFixed(0)}</div>
          <Bar v={(o.shipped / o.qty) * 100} />
          {open === o.id && <div className="text-[11px] text-stone-600 mt-1 font-mono">Released {o.released} · reserved cartons {o.resv} · shipped {o.shipped}/{o.qty} · returned {o.returned}{o.status === "offered" ? ` · offer expires day ${o.expires}` : ""}<br />{o.status === "offered" && <span className="font-sans"><button onClick={(e) => { e.stopPropagation(); onOffer("accept", o.id); }} className="bg-teal-700 text-white font-bold rounded-xl px-3 min-h-[40px] mr-2">Accept</button><button onClick={(e) => { e.stopPropagation(); onOffer("decline", o.id); }} className="bg-stone-200 font-bold rounded-xl px-3 min-h-[40px]">Decline</button><br /></span>}{o.hist.length ? o.hist.map((h) => `D${h.day}: +${h.n}`).join("  ") : "No shipments yet"}</div>}
        </button>))}
    </Card>
  );
}
export function Standards({ s }) {
  return (
    <div className="space-y-3">
      <Card><H>Products</H>{PRODUCTS.map((p) => <div key={p.id} className="text-xs bg-stone-50 rounded-xl px-3 py-2 mb-1"><b>{p.icon} {p.name}</b> {p.active ? "" : <i className="text-stone-600">(not active this chapter)</i>}<div className="font-mono text-stone-600">time vs standard: {PROCESSES.map((q) => `${q.name.split(" ")[0]} ×${p.mult[q.id]}`).join(" · ")}</div></div>)}</Card>
      {PROCESSES.map((p) => {
        const els = ELEMENTS.filter((e) => e.p === p.id && (!e.cont || s.cont[e.id])), tot = secOf(s, p.id), cs = els.filter((e) => e.cont).reduce((t, e) => t + e.sec, 0);
        return <Card key={p.id}><H>{p.icon} {p.name}</H><div className="text-[11px] text-stone-600 font-mono mb-2">{tot}s per unit · baseline {s.baseSec[p.id]}s · containment {cs}s · standard work L{s.sw[p.id]}</div>
          {els.map((e, i) => <div key={e.id} className={"flex justify-between rounded-xl px-3 py-2 mb-1 text-sm " + (e.cont ? "bg-rose-50" : "bg-stone-50")}><div><div className="font-semibold">{i + 1}. {e.name}</div><div className="text-[10px] text-stone-600"><span className="font-mono">{e.id}</span> · {e.va}{e.cont ? ` · CONTAINMENT: ${e.cont}` : ""}</div></div><b className="font-mono">{e.sec}s</b></div>)}</Card>;
      })}
    </div>
  );
}
export function Team({ s, sel, setSel, onMove, onTrain }) {
  const w = sel && sel.t === "w" ? s.workers.find((x) => x.id === sel.id) : null;
  return (
    <Card><H>Team</H>{s.workers.map((x) => <div key={x.id} className={"rounded-xl px-3 py-2 mb-2 " + (w && w.id === x.id ? "bg-sky-50" : "bg-stone-50")}><button onClick={() => setSel({ t: "w", id: x.id })} className="font-bold text-sm min-h-[32px]">{x.name} <span className="text-[10px] font-normal text-stone-600">home {proc(x.home).name} · now {proc(x.proc).name}</span></button><WorkerStats s={s} w={x} onMove={onMove} onTrain={onTrain} /></div>)}</Card>
  );
}
export function WorkerStats({ s, w, onMove, onTrain }) {
  const pf = perfW(s, w, w.proc, 0);
  return (
    <div><div className="text-[11px] text-stone-600 mb-1">Pace {Math.round(pf * 100)}% of standard{w.proc !== w.home ? " (working away from home area)" : ""}</div>
      <div className="grid grid-cols-5 gap-2 text-[9px] uppercase font-bold text-stone-600">{[["Skill", w.skill], ["Effort", w.effort], ["Cross", w.cross], ["Morale", w.morale], ["Fatigue", w.fat]].map(([l, v]) => <div key={l}>{l} {Math.round(v)}<Bar v={v} c={l === "Fatigue" ? "bg-rose-400" : "bg-teal-400"} /></div>)}</div>
      <div className="flex gap-2 flex-wrap mt-2">{PROCESSES.map((p) => <button key={p.id} disabled={w.proc === p.id} onClick={() => onMove(w.id, p.id)} className="text-xs font-bold px-3 min-h-[40px] rounded-xl bg-white border border-stone-200 disabled:bg-teal-100 disabled:text-teal-800">{w.proc === p.id ? "✓ " : ""}{p.name}</button>)}
        <button disabled={s.bank < CFG.trainCost || w.cross >= 100} onClick={() => onTrain(w.id)} className="text-xs font-bold px-3 min-h-[40px] rounded-xl bg-teal-700 text-white disabled:opacity-40">Cross-train ({CFG.trainCost} EH)</button></div></div>
  );
}
export function Improve({ s, onBuy, onImport, msg }) {
  const [txt, setTxt] = useState("");
  const L = { VLPG: "Verified productivity", RCAP: "Released capacity", SHORT: "Below standard (not debited)", SPEND: "Spent", IDEA: "Suggestion bonus" };
  return (
    <div className="space-y-3">
      <Card><H>Improvements — spend Earned Hours (bank {s.bank.toFixed(1)} EH)</H>
        {msg && <div className="text-xs font-bold text-stone-600 bg-amber-50 rounded-xl px-3 py-2 mb-2" role="status">{msg}</div>}
        {improvements(s).map((i) => <div key={i.id} className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2 mb-2"><div className="flex-1"><div className="font-semibold text-sm">{i.name}</div><div className="text-[11px] text-stone-600">{i.desc}</div></div><Btn onClick={() => onBuy(i.id)} disabled={!i.available}>{i.maxed ? "Max" : i.cost + " EH"}</Btn></div>)}
      </Card>
      <Card><H>Earned Hours ledger</H><div className="text-[11px] text-stone-600 mb-2">Verified productivity = work content removed vs the locked baseline. Released capacity = hours freed by pace. Neither is cash: paid hours stay paid.</div>
        {s.ledger.slice(-12).reverse().map((e, k) => <div key={k} className="flex justify-between text-xs border-b border-stone-100 py-1"><span>D{e.day} · {L[e.type]}<span className="text-stone-600"> — {e.note}</span></span><b className={"font-mono " + (e.eh < 0 ? "text-rose-700" : "text-emerald-700")}>{e.eh > 0 ? "+" : ""}{e.eh}</b></div>)}
      </Card>
      <Card><H>Save / Load</H><div className="text-[11px] text-stone-600 mb-1">Autosaves each day. Export copies your save as text; Import replaces the current game only if the text is valid.</div>
        <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={3} className="w-full text-[10px] font-mono border border-stone-200 rounded-xl p-2" aria-label="Save text" />
        <div className="flex gap-2 mt-2"><Btn onClick={() => setTxt(exportSave(s))}>Export</Btn><Btn c="bg-teal-700 hover:bg-teal-800" onClick={() => setTxt(onImport(txt) || "")}>Import</Btn></div></Card>
    </div>
  );
}
export function Results({ s, onRestart, onClose, label }) {
  const c = scorecard(s), done = s.status === "complete";
  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4"><div role="dialog" aria-label="Quarter results" className="bg-white rounded-3xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl font-black text-stone-700">{done ? "Quarter complete" : "Scorecard so far"} — {done ? (c.pass ? "Turnaround achieved! 🎉" : "Not yet stabilized") : "day " + s.day}</h2>
      <p className="text-xs text-stone-600 mb-3">{done ? (c.pass ? "All four areas met their minimum." : "You need all four areas to meet the minimum. Restart and try a different plan — what slowed the limiting area?") : "Final results count at the end of day 60."}</p>
      {c.dims.map((d) => <div key={d.id} className="rounded-2xl bg-stone-50 px-3 py-2 mb-2"><div className="flex justify-between text-sm font-bold"><span>{d.name}</span><span className={d.pass ? "text-emerald-700" : "text-rose-700"}>{d.pass ? "✔ MET" : "✖ NOT MET"}</span></div><div className="text-xs text-stone-600">{d.show} · need {d.need}</div>{!d.pass && <div className="text-[11px] text-stone-600">Hint: {d.tip}</div>}</div>)}
      {(() => { const q = closeQuarter(s); return <div className="mb-3 text-[11px] text-stone-600"><b>Quarter close: {q.pass ? "all reconciliation checks pass" : "a reconciliation check FAILED"}.</b>{q.narrative.map((n, i) => <div key={i}>• {n}</div>)}<div className="text-stone-600">Full P&L, cash flow, variance bridge and audit history are in the Reports tab.</div></div>; })()}
      <div className="flex gap-2">{done ? <Btn onClick={onRestart}>{label || "Restart quarter"}</Btn> : <Btn onClick={onClose}>Close</Btn>}</div></div></div>
  );
}
