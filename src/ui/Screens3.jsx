import React, { useState } from "react";
import { PROCESSES, PATHS, PROJECTS, PRODUCTS, CHAPTERS, SCENARIOS, CFG, RATES } from "../content/index.js";
import { engagement, riskOf, perfW, effProc, proc, product } from "../engine/sim.js";
import { summary, reconcile, chapterStatus } from "../engine/enterprise.js";
import { Card, H, Bar, Btn } from "./Screens.jsx";

const $ = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const lvl = { LOW: "text-emerald-700", MEDIUM: "text-amber-700", HIGH: "text-rose-700" };

export function TeamPlus({ s, act }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-3">
      <Card className="flex items-center justify-between gap-2 flex-wrap"><div className="text-xs text-stone-600 max-w-md"><b>Defaults:</b> when someone is out, the game covers the gap with the best-prepared person from a staffed area. You can override by moving anyone.</div>
        <label className="text-sm font-semibold flex items-center gap-2 min-h-[44px]"><input type="checkbox" className="w-5 h-5 accent-orange-500" checked={s.autoCover} onChange={(e) => act("cover", e.target.checked)} />Auto-cover absences</label></Card>
      {s.workers.map((w) => {
        const r = riskOf(s, w), e = engagement(s, w), here = effProc(w), training = s.training.find((t) => t.wid === w.id);
        return (
          <Card key={w.id}>
            <div className="flex justify-between items-start gap-2"><div><div className="font-bold">{w.name} {w.path && <span className="text-[10px] font-bold bg-teal-100 text-teal-800 rounded-full px-2 py-0.5">{PATHS[w.path].name}</span>}</div>
              <div className="text-[11px] text-stone-600">Home {proc(w.home).name} · now {proc(here).name}{w.tmpProc ? " (covering)" : ""} · pace {Math.round(perfW(s, w, here, 0) * 100)}%</div></div>
              <div className="text-right text-[11px]">{w.absent && <div className="font-black text-rose-700">OUT TODAY</div>}<div className={"font-bold " + lvl[r.level]}>Absence risk: {r.level}</div>{r.leaving && <div className="font-black text-rose-700">⚠ Resignation risk ({w.lowDays}/{CFG.quitDays} low days)</div>}</div></div>
            {r.reasons.length > 0 && <div className="text-[10px] text-stone-600">Because: {r.reasons.join(", ")}</div>}
            <div className="grid grid-cols-4 gap-2 mt-2 text-[9px] uppercase font-bold text-stone-600">{[["Skill", w.skill, "bg-teal-400"], ["Flex", w.cross, "bg-sky-400"], ["Mastery", w.mastery, "bg-indigo-400"], ["Trust", w.trust, "bg-emerald-400"], ["Engage", w.morale, "bg-emerald-700"], ["Fatigue", w.fat, "bg-rose-400"], ["Effort", w.effort, "bg-teal-400"]].map(([l, v, c]) => <div key={l}>{l} {Math.round(v)}<Bar v={v} c={c} /></div>)}</div>
            {Object.keys(w.certs).length > 0 && <div className="text-[11px] text-stone-600 mt-1">Cross-trained: {Object.keys(w.certs).map((p) => proc(p).name).join(", ")}</div>}
            {training && <div className="text-[11px] font-bold text-indigo-700 mt-1">In training ({training.done}/{CFG.trainNeed}) — {CFG.trainHours}h/day off production</div>}
            <button onClick={() => setOpen(open === w.id ? null : w.id)} className="text-xs font-bold text-orange-700 min-h-[40px]" aria-expanded={open === w.id}>Why is engagement {Math.round(w.morale)}? (target {Math.round(e.target)})</button>
            {open === w.id && <div className="bg-stone-50 rounded-xl p-2 text-xs">{e.factors.map((f) => <div key={f.label} className="flex justify-between"><span>{f.label}</span><b className={"font-mono " + (f.v < 0 ? "text-rose-700" : f.v > 0 ? "text-emerald-700" : "")}>{f.v > 0 ? "+" : ""}{f.v}</b></div>)}<div className="text-[10px] text-stone-600 mt-1">Engagement moves 20% per day toward 55 + the sum of these factors.</div></div>}
            <div className="text-[11px] font-bold mt-2">Assign</div><div className="flex gap-1 flex-wrap">{PROCESSES.map((p) => <button key={p.id} disabled={w.proc === p.id && !w.tmpProc} onClick={() => act("move", w.id, p.id)} className="text-xs font-bold px-3 min-h-[40px] rounded-xl bg-white border border-stone-200 disabled:bg-teal-100">{w.proc === p.id && !w.tmpProc ? "✓ " : ""}{p.name}</button>)}</div>
            <div className="text-[11px] font-bold mt-2">Develop</div><div className="flex gap-1 flex-wrap">
              {PROCESSES.filter((p) => p.id !== w.home && !w.certs[p.id]).map((p) => <Btn key={p.id} c="bg-indigo-700 hover:bg-indigo-800" disabled={!!training} onClick={() => act("train", w.id, "cross", p.id)}>Cross-train {p.name}</Btn>)}
              <Btn c="bg-indigo-700 hover:bg-indigo-800" disabled={!!training} onClick={() => act("train", w.id, "skill")}>Skill training</Btn></div>
            <div className="text-[10px] text-stone-600">Training costs ${CFG.trainCost} and {CFG.trainHours}h/day of this person's production time for up to {CFG.trainNeed} days (half with a Trainer).</div>
            <div className="text-[11px] font-bold mt-2">Career path {w.mastery < CFG.pathMastery ? `(unlocks at ${CFG.pathMastery} mastery; now ${Math.round(w.mastery)})` : `(${CFG.pathCost} EH)`}</div>
            <div className="flex gap-1 flex-wrap">{Object.entries(PATHS).map(([k, p]) => <button key={k} title={p.desc} disabled={w.path === k} onClick={() => act("path", w.id, k)} className="text-xs font-bold px-3 min-h-[40px] rounded-xl bg-white border border-stone-200 disabled:bg-teal-100">{w.path === k ? "✓ " : ""}{p.name}</button>)}</div>
            {w.path ? <div className="text-[10px] text-stone-600">{PATHS[w.path].desc}</div> : <div className="text-[10px] text-stone-600">Tap a path for what it does. Specialist = best at home; Flexible = best when demand shifts; Trainer builds others; Lead steadies the team.</div>}
          </Card>);
      })}
    </div>
  );
}

export function Projects({ s, act, msg }) {
  return (
    <Card><H>Improvement projects</H><div className="text-[11px] text-stone-600 mb-2">Projects take workforce time now and change standards later. Benefits are uncertain and flow through the same Earned Hours rules as everything else.</div>
      {PROJECTS.map((d) => { const pr = s.projects.find((x) => x.id === d.id), st = pr && d.stages[Math.min(pr.completed, d.stages.length - 1)], nextCost = pr && pr.status === "review" ? d.stages[pr.completed].cost : null; return (
        <div key={d.id} className="bg-stone-50 rounded-xl px-3 py-2 mb-2"><div className="font-semibold text-sm">{d.name}</div>
          <div className="text-[11px] text-stone-600">{proc(d.p).name} · up to −{d.sec}s/unit · {d.stages.map((x) => `${x.name} ${x.days}d $${x.cost}`).join(" → ")} · crew {d.crewHours}h/day</div><div className="text-[10px] text-stone-600">{d.risk}</div>
          {!pr && <Btn onClick={() => act("project", d.id)} disabled={s.cash < d.stages[0].cost}>Start (${d.stages[0].cost})</Btn>}
          {pr && pr.status === "active" && <div className="text-xs font-bold text-indigo-700">In progress: {d.stages[pr.completed].name}, {pr.left} day(s) left. Capacity is reduced at {proc(d.p).name}.</div>}
          {pr && pr.status === "review" && <div><div className="text-xs font-bold text-amber-700">Review point: "{d.stages[pr.completed - 1].name}" finished. Effect so far: −{(d.sec * pr.real * d.stages[pr.completed - 1].frac).toFixed(1)}s/unit.</div><Btn onClick={() => act("approve", d.id)} disabled={s.cash < nextCost}>Approve next stage (${nextCost})</Btn></div>}
          {pr && pr.status === "done" && <div className="text-xs font-bold text-emerald-700">Complete: −{(d.sec * pr.real).toFixed(1)}s/unit at {proc(d.p).name} (realized {Math.round(pr.real * 100)}% of {d.sec}s)</div>}
        </div>); })}
    </Card>
  );
}

export function Campaign({ ent, siteId, setSiteId, slots, slotId, h }) {
  const s = ent.sites[siteId], m = ent.sites.main, cs = chapterStatus(ent), sm = summary(ent), rc = reconcile(ent);
  const [amt, setAmt] = useState(2000), [qty, setQty] = useState(500), [to, setTo] = useState(""), [oid, setOid] = useState(""), [txt, setTxt] = useState("");
  const others = ent.order.filter((x) => x !== siteId), dest = to || others[0] || "";
  return (
    <div className="space-y-3">
      {h.msg && <div className="text-xs font-bold bg-amber-50 rounded-xl px-3 py-2" role="status">{h.msg}</div>}
      <Card><H>{ent.mode === "challenge" ? "Challenge: " + ent.name : `Chapter ${cs.ch.id}: ${cs.ch.name}`}</H>
        {ent.mode === "campaign" ? <><div className="text-xs text-stone-600">{cs.ch.goal} {cs.ch.intro}</div>
          <div className="text-[11px] text-stone-600 my-1">Progress: day {Math.min(m.day, m.endDay)} of chapter ending day {m.endDay}. Campaign history: {ent.history.length ? ent.history.map((x) => `Ch${x.chapter} ${x.pass ? "✔" : "✖"}`).join(", ") : "none yet"}.{ent.campaignComplete ? " 🎉 Campaign complete — sandbox continues." : ""}</div>
          {cs.complete && <Btn onClick={h.next}>{cs.pass ? "Start next chapter" : "Retry this chapter"}</Btn>}</>
          : <div className="text-xs text-stone-600">{SCENARIOS.find((x) => x.id === ent.scenarioId).lesson}<div className="mt-1"><b>Controls:</b> {SCENARIOS.find((x) => x.id === ent.scenarioId).controls}</div><div><b>Fails if:</b> {SCENARIOS.find((x) => x.id === ent.scenarioId).fail}</div><div className="mt-2"><Btn onClick={() => h.startChallenge(ent.scenarioId)} c="bg-stone-500">Restart this challenge</Btn></div></div>}
      </Card>
      {ent.mode === "campaign" && <Card><H>Products</H>{PRODUCTS.map((p) => { const st = s.products[p.id]; return (
        <div key={p.id} className="flex items-center justify-between gap-2 bg-stone-50 rounded-xl px-3 py-2 mb-2"><div><div className="font-semibold text-sm">{p.icon} {p.name}</div><div className="text-[11px] text-stone-600">{st.active ? (st.retired ? "Retired: no new orders, open orders still honored" : "Active") : st.unlocked ? "Unlocked — needs standard work at Pack and two Pack-capable people" : "Locked until Chapter 2"}</div></div>
          {st.active && !st.retired ? <Btn c="bg-stone-500" onClick={() => h.act("product", p.id, "retire")}>Retire</Btn> : st.retired ? <Btn onClick={() => h.act("product", p.id, "resume")}>Resume</Btn> : <Btn disabled={!st.unlocked} onClick={() => h.act("product", p.id, "activate")}>Activate</Btn>}</div>); })}</Card>}
      {ent.mode === "campaign" && <Card><H>🏭 Enterprise ({ent.order.length} site{ent.order.length > 1 ? "s" : ""}) — corporate cash {$(ent.corp.cash)}</H>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-stone-600"><th>Site</th><th>Profit</th><th>Cash</th><th>On time</th><th>Quality</th><th>Engage</th><th>EH</th></tr></thead><tbody>{sm.rows.map((r) => <tr key={r.id} className="border-t border-stone-100"><td><button onClick={() => setSiteId(r.id)} className={"font-bold min-h-[36px] " + (r.id === siteId ? "text-orange-700" : "")}>{r.id}{r.id === siteId ? " ◀" : ""}</button></td><td className="font-mono">{$(r.profit)}</td><td className="font-mono">{$(r.cash)}</td><td>{Math.round(r.otd * 100)}%</td><td>{(r.fpy * 100).toFixed(1)}%</td><td>{Math.round(r.eng)}</td><td className="font-mono">{r.eh.toFixed(0)}</td></tr>)}</tbody></table></div>
        <div className="text-[11px] text-stone-600 mt-1">Enterprise profit (after expansion capex {$(ent.capex)}): <b>{$(sm.profit)}</b> · total cash {$(sm.cash)} · Earned Hours {sm.eh.toFixed(0)}. Tap a site to run it from the other tabs.</div>
        <div className="flex gap-2 items-center flex-wrap mt-2"><input type="number" value={amt} onChange={(e) => setAmt(+e.target.value)} className="border border-stone-200 rounded-lg px-2 w-24 min-h-[40px]" aria-label="Amount" /><Btn onClick={() => h.ent("remit", siteId, amt)} c="bg-teal-700 hover:bg-teal-800">Remit {siteId} → corporate</Btn><Btn onClick={() => h.ent("allocate", siteId, amt)}>Corporate → {siteId}</Btn></div>
        <div className="text-[10px] text-stone-600">Sites keep a ${CFG.reserve} reserve. Corporate cash only comes from remittances; expansion costs ${CFG.expandCost.toLocaleString()} (${CFG.expandSeed.toLocaleString()} becomes the new site's cash, the rest is capital spent on its build-out). A new site starts with its own people, stock, orders and local conditions, and a different standards baseline.</div>
        {ent.order.length < 3 && <div className="mt-2"><Btn onClick={() => h.ent("expand", ent.order.length === 1 ? "east" : "west")} disabled={ent.corp.cash < CFG.expandCost}>Build a new site (${CFG.expandCost.toLocaleString()})</Btn></div>}
        {ent.order.length > 1 && <div className="mt-3 bg-stone-50 rounded-xl p-2"><div className="text-xs font-bold">Transfers from {siteId}</div><div className="flex gap-2 flex-wrap items-center my-1"><select value={dest} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-2 min-h-[40px] bg-white" aria-label="Destination">{others.map((o) => <option key={o}>{o}</option>)}</select><input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} className="border border-stone-200 rounded-lg px-2 w-24 min-h-[40px]" aria-label="Quantity" />
          <Btn onClick={() => h.ent("tMat", siteId, dest, qty)} c="bg-teal-700 hover:bg-teal-800">Ship cartons (${CFG.matTransferFee}/ea, {CFG.transferDays} days)</Btn></div>
          <div className="flex gap-2 flex-wrap items-center"><select value={oid} onChange={(e) => setOid(e.target.value)} className="border rounded-lg px-2 min-h-[40px] bg-white" aria-label="Order to move"><option value="">Pick an open order…</option>{s.orders.filter((o) => o.status === "open" && o.qty - Math.max(o.released, 1) > 0).slice(-12).map((o) => <option key={o.id} value={o.id}>{o.id} · {product(o.product).name} · {o.qty - Math.max(o.released, 1)} unstarted</option>)}</select><Btn onClick={() => h.ent("tWork", siteId, dest, oid, qty)} disabled={!oid}>Move work (${CFG.workTransferFee}/unit, 1 day)</Btn></div>
          <div className="text-[10px] text-stone-600 mt-1">Only unstarted units move, and the other site still has to produce and ship them. Nothing teleports.</div>
          {ent.transfers.slice(-5).reverse().map((t) => <div key={t.id} className="text-[11px] font-mono">{t.id} {t.kind} {t.qty} {t.from}→{t.to} {t.status === "transit" ? `in transit, due day ${t.due}` : `arrived day ${t.arrived}`}</div>)}</div>}
        <details className="mt-2"><summary className="text-xs font-bold cursor-pointer min-h-[36px]">Enterprise reconciliation: {rc.every((c) => c.pass) ? "all checks pass" : "CHECK FAILED"}</summary>{rc.map((c) => <div key={c.name} className="text-[11px]">{c.pass ? "✔" : "✖"} {c.name}</div>)}</details></Card>}
      {ent.mode === "campaign" && <Card><H>🎯 Challenges (separate games; your campaign is untouched)</H>{SCENARIOS.map((c) => <div key={c.id} className="bg-stone-50 rounded-xl px-3 py-2 mb-2"><div className="font-semibold text-sm">{c.name} <span className="text-[10px] font-normal text-stone-600">{c.days} days</span></div><div className="text-[11px] text-stone-600">{c.lesson}</div><div className="text-[10px] text-stone-600">Goals: {c.objectives.join(" · ")}. {c.controls}</div><Btn onClick={() => h.startChallenge(c.id)}>Start in a new slot</Btn></div>)}</Card>}
      <Card><H>⏱ Time while you're away</H><div className="text-xs text-stone-600 mb-2">Choose how fast the factory runs when the app is closed (up to {CFG.maxCatchUp} days are simulated when you return). {ent.mode === "challenge" ? "Challenges use a fixed rate." : "You can change this any time: elapsed time is settled at the old rate first."}</div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Away-time rate">{Object.entries(RATES).map(([k, r]) => { const cur = (ent.clock.rate || "standard") === k; return <button key={k} onClick={() => h.rate(k)} disabled={ent.mode === "challenge" || cur} aria-pressed={cur} className={"text-xs font-bold px-3 min-h-[44px] rounded-xl border " + (cur ? "bg-teal-800 text-white border-teal-800" : "bg-white border-stone-300 disabled:opacity-50")}>{cur ? "✓ " : ""}{r.label}<div className="font-normal text-[10px]">{r.desc}</div></button>; })}</div></Card>
      <Card><H>🔒 Not in this release</H><div className="text-xs text-stone-600">Competing corporate capital bids, more than three products, supplier negotiation and contract bidding, multiplayer and leaderboards are future content and are not available yet.</div></Card>
      <Card><H>💾 Save slots</H>{slots.map((x) => <div key={x.id} className={"flex items-center justify-between gap-2 rounded-xl px-3 py-2 mb-2 " + (x.id === slotId ? "bg-orange-50" : "bg-stone-50")}><div className="text-xs"><b>{x.name}</b>{x.id === slotId ? " (open)" : ""}<div className="text-stone-600">{x.mode} · day {x.day}</div></div><div className="flex gap-1"><Btn onClick={() => h.load(x.id)} disabled={x.id === slotId} c="bg-teal-700 hover:bg-teal-800">Load</Btn><Btn onClick={() => h.del(x.id)} disabled={x.id === slotId} c="bg-stone-600">Delete</Btn></div></div>)}
        <div className="flex gap-2 flex-wrap"><Btn onClick={h.newGame}>New campaign</Btn><Btn c="bg-teal-700 hover:bg-teal-800" onClick={() => setTxt(h.exp())}>Export this slot</Btn><Btn c="bg-stone-500" onClick={() => h.imp(txt)}>Import as new slot</Btn></div>
        <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={3} className="w-full text-[10px] font-mono border border-stone-200 rounded-xl p-2 mt-2" aria-label="Save text" /><div className="text-[10px] text-stone-600">Imports always go into a new slot and are checked first, so a bad import can't damage an existing save. Each slot keeps one backup.</div></Card>
    </div>
  );
}

export function ChallengeResult({ ent, onRestart, onClose }) {
  const r = ent.result; if (!r) return null;
  return (
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4"><div role="dialog" aria-label="Challenge result" className="bg-white rounded-3xl p-5 max-w-md w-full">
      <h2 className="text-xl font-black">{ent.name}: {r.status === "passed" ? "Passed! 🎉" : r.status === "failed" ? "Failed" : "Goals not met"}</h2>
      {r.failReason && <p className="text-sm text-rose-700 my-1">Ended early: {r.failReason}.</p>}
      {r.objectives.map((o) => <div key={o.text} className="flex justify-between text-sm bg-stone-50 rounded-xl px-3 py-2 my-1"><span>{o.text}</span><b className={o.pass ? "text-emerald-700" : "text-rose-700"}>{o.pass ? "✔ MET" : "✖ NOT MET"}</b></div>)}
      <p className="text-[11px] text-stone-600 my-2">Results come straight from the simulation: see Reports for the full P&L, audit history and what caused each outcome.</p>
      <div className="flex gap-2"><Btn onClick={onRestart}>Restart challenge</Btn><Btn onClick={onClose} c="bg-stone-500">Review</Btn></div></div></div>
  );
}
