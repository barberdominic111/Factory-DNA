import React, { useState, useEffect, useRef } from "react";
import { PROCESSES, CFG } from "../content/index.js";
import { buy, trainWorker, moveWorker, setOptions, limiting, load, scorecard, proc, wipUnits, calendar, setTemps, planPM, emergencyRepair, expediteSupply, acceptOffer, declineOffer, invest, startTraining, setPath, setCover, startProject, approveProject, setProduct, effProc } from "../engine/sim.js";
import { newEnterprise, setRate, catchUpEnt, manualAdvanceEnt, setPausedEnt, nextChapter, allocate, remit, expand, transferMaterial, transferWork } from "../engine/enterprise.js";
import { startScenario } from "../engine/scenarios.js";
import { saveSlot, loadSlot, listSlots, newSlotId, deleteSlot, exportEnt, parseEnt, migrateLegacy } from "../engine/slots.js";
import IsoMap from "./IsoMap.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { Ops, Reports } from "./Screens2.jsx";
import { TeamPlus, Projects, Campaign, ChallengeResult } from "./Screens3.jsx";
import { Card, Btn, Orders, Standards, Improve, Results } from "./Screens.jsx";

const CSS = `@keyframes bob{50%{transform:translateY(-3px)}}.bob{animation:bob 1.4s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.bob{animation:none}}`;
const chip = (ok) => (ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800");
function boot() {
  migrateLegacy(); const l = listSlots().sort((a, b) => b.updated - a.updated);
  for (const x of l) { const r = loadSlot(x.id); if (r.ok) return { id: x.id, ent: r.ent }; }
  const id = newSlotId(), ent = newEnterprise(); saveSlot(id, ent); return { id, ent };
}

export default function App() {
  const init = useRef(null); if (!init.current) init.current = boot();
  const [slotId, setSlotId] = useState(init.current.id), [ent, setEnt] = useState(init.current.ent), [siteId, setSiteId] = useState("main");
  const [help, setHelp] = useState(() => { try { return localStorage.getItem("fdna3:seen") ? false : true; } catch { return true; } }), [tab, setTab] = useState("map"), [sel, setSel] = useState(null), [msg, setMsg] = useState(""), [showRes, setShowRes] = useState(false), [showCh, setShowCh] = useState(true), [away, setAway] = useState(null), [slots, setSlots] = useState(listSlots());
  const site = ent.sites[siteId] || ent.sites.main, s = site;
  const setS = (ns) => setEnt((e) => ({ ...e, sites: { ...e.sites, [site === ent.sites.main ? "main" : siteId]: typeof ns === "function" ? ns(e.sites[siteId] || e.sites.main) : ns } }));
  useEffect(() => { saveSlot(slotId, ent); setSlots(listSlots()); if (ent.sites.main.status === "complete" && ent.mode === "campaign") setShowRes(true); }, [ent]);
  useEffect(() => { const r = catchUpEnt(ent, Date.now()); if (r.days > 0) { setEnt(r.ent); setAway({ ...r.summary, stopped: r.stopped, forfeited: r.forfeited }); }
    const id = setInterval(() => setEnt((cur) => { const x = catchUpEnt(cur, Date.now()); return x.days > 0 ? x.ent : cur; }), 30000); return () => clearInterval(id); }, [slotId]);
  const say = (r, ok) => setMsg(r.ok ? ok || "" : r.reason);
  const adv = (n) => { let x = ent; for (let i = 0; i < n && !x.result && x.sites.main.status === "active"; i++) x = manualAdvanceEnt(x, Date.now()); setEnt(x); };
  const act = (k, a, b, c) => { const R = { expedite: () => expediteSupply(s), repair: () => emergencyRepair(s, a), invest: () => invest(s, a), pm: () => ({ ok: true, state: planPM(s, a) }), temp: () => ({ ok: true, state: setTemps(s, a, b) }),
    move: () => ({ ok: true, state: moveWorker(s, a, b) }), train: () => startTraining(s, a, b, c), path: () => setPath(s, a, b), cover: () => ({ ok: true, state: setCover(s, a) }), project: () => startProject(s, a), approve: () => approveProject(s, a), product: () => setProduct(s, a, b) }[k]();
    const quiet = ["pm", "temp", "move", "cover"]; setMsg(R.ok ? (quiet.includes(k) ? "" : "Done — it's recorded in the audit history.") : R.reason); if (R.ok) setS(R.state); };
  const doBuy = (id) => { const r = buy(s, id); setMsg(r.ok ? "Done — effect is permanent. Watch the load numbers on the Map." : r.reason); if (r.ok) setS(r.state); };
  const doTrain = (id) => { const r = trainWorker(s, id); setMsg(r.ok ? "Cross-training complete." : r.reason); if (r.ok) setS(r.state); };
  const offer = (k, id) => { const r = k === "accept" ? acceptOffer(s, id) : declineOffer(s, id); setMsg(r.ok ? "" : r.reason); if (r.ok) setS(r.state); };
  const pause = () => { const r = setPausedEnt(ent, !ent.paused, Date.now()); setMsg(r.ok ? "" : r.reason); if (r.ok) setEnt(r.ent); };
  const open = (id, e) => { setSlotId(id); setEnt(e); setSiteId("main"); setSel(null); setTab("map"); setShowRes(false); setShowCh(true); setMsg(""); };
  const H = { msg, act, rate: (k) => { const r = setRate(ent, k, Date.now()); setMsg(r.ok ? (r.settled ? `Settled ${r.settled.days} day(s) at the old rate first (${r.settled.shipped} units shipped). ` : "") + "Rate changed." : r.reason); if (r.ok) setEnt(r.ent); },
    ent: (k, a, b, c, d) => { const r = { allocate: () => allocate(ent, a, b), remit: () => remit(ent, a, b), expand: () => expand(ent, a), tMat: () => transferMaterial(ent, a, b, c), tWork: () => transferWork(ent, a, b, c, d) }[k](); setMsg(r.ok ? "Done — see the audit history and enterprise reconciliation." : r.reason); if (r.ok) setEnt(r.ent); },
    next: () => { const r = nextChapter(ent); setMsg(r.ok ? (r.retry ? "Retrying the chapter with everything you've built." : "Next chapter started.") : r.reason); if (r.ok) { setEnt(r.ent); setShowRes(false); } },
    startChallenge: (id) => { const e = startScenario(id); const nid = newSlotId(); saveSlot(nid, e); open(nid, e); }, newGame: () => { const e = newEnterprise(Math.floor(Math.random() * 1e9)), nid = newSlotId(); saveSlot(nid, e); open(nid, e); },
    load: (id) => { const r = loadSlot(id); if (r.ok) { open(id, r.ent); setMsg(r.usedBackup ? "That slot was damaged; loaded its backup." : ""); } else setMsg(r.reason); },
    del: (id) => { deleteSlot(id); setSlots(listSlots()); }, exp: () => exportEnt(ent), imp: (t) => { const r = parseEnt(t); if (!r.ok) return setMsg(r.reason); const nid = newSlotId(); r.ent.name = r.ent.name + " (imported)"; saveSlot(nid, r.ent); setSlots(listSlots()); setMsg("Imported into a new slot. Your other saves are untouched."); } };
  const c = calendar(Math.min(s.day, s.endDay)), lim = limiting(s), l = load(s, lim.id), sc = scorecard(s), ev = s.event, nx = s.nextEvent, la = s.last, mor = s.workers.reduce((t, w) => t + w.morale, 0) / s.workers.length;
  const tabs = [["map", "🗺️", "Map"], ["orders", "📋", "Orders"], ["standards", "📏", "Std"], ["team", "👥", "Team"], ["ops", "🛠️", "Ops"], ["improve", "🔧", "Improve"], ["reports", "📊", "Reports"], ["camp", "🏆", "Campaign"]];
  const selP = sel && sel.t === "p" ? PROCESSES.find((p) => p.id === sel.id) : null, selW = sel && sel.t === "w" ? s.workers.find((w) => w.id === sel.id) : null;
  const out = s.workers.filter((w) => w.absent), risky = s.workers.filter((w) => w.lowDays >= 5);
  const coach = s.chapter === 1 && s.day <= 3 && !s.ledger.some((e) => e.type === "SPEND") && ent.mode === "campaign" ? `${lim.name} is the limiting area (${Math.round(l.ratio * 100)}% loaded). Tap it, then free capacity: move a person, or fix a workaround in Improve.` : null;
  return (
    <div className="min-h-screen bg-amber-50 pb-24 text-stone-700"><style>{CSS}</style>
      <main className="max-w-4xl mx-auto px-3 pt-3 space-y-3">
        <div className="flex items-center justify-between"><h1 className="text-xl font-black">🏭 Factory DNA <span className="text-xs font-bold text-stone-600">{ent.mode === "challenge" ? ent.name : `Ch ${s.chapter}`}{ent.order.length > 1 ? ` · site ${siteId}` : ""}</span></h1><div className="flex"><button onClick={() => setHelp(true)} className="text-xs font-bold text-orange-700 min-h-[44px] px-2" aria-label="Help: how to play">Help</button><button onClick={() => setShowRes(true)} className="text-xs font-bold text-orange-700 min-h-[44px] px-2">Scorecard</button></div></div>
        {ent.order.length > 1 && <div className="flex gap-2" role="tablist" aria-label="Sites">{ent.order.map((id) => <button key={id} role="tab" aria-selected={id === siteId} onClick={() => { setSiteId(id); setSel(null); }} className={"text-xs font-bold px-3 min-h-[40px] rounded-xl " + (id === siteId ? "bg-orange-700 text-white" : "bg-white")}>{id}</button>)}</div>}
        <div className="bg-white rounded-2xl px-3 py-2 text-sm font-bold flex flex-wrap gap-x-4 gap-y-1 justify-between"><span>Day {Math.min(s.day, s.endDay)}/{s.endDay} · Wk {c.week} · Mo {c.month} · Q{c.quarter} · {c.season}</span><span>Cash ${Math.round(s.cash).toLocaleString()}</span><span>EH bank {s.bank.toFixed(1)}</span><span>Open orders {s.orders.filter((o) => o.status === "open").length} · WIP {wipUnits(s)}</span></div>
        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">{sc.dims.map((d) => <div key={d.id} className={"rounded-xl px-1 py-2 " + chip(d.pass)}>{d.name.split(" ")[0]}<div className="text-xs font-mono">{d.show.split(" ")[0]}</div>{d.pass ? "✔ on track" : "✖ below min"}</div>)}</div>
        <div className={"rounded-2xl px-3 py-2 text-sm " + (ev.tone === "bad" ? "bg-rose-50" : ev.tone === "good" ? "bg-emerald-50" : "bg-sky-50")} role="status"><b>Today: {ev.t}.</b> {ev.d} <span className="text-stone-600">Tomorrow: {nx.t} — {nx.d}</span></div>
        {(out.length > 0 || risky.length > 0) && <div className="rounded-2xl px-3 py-2 text-sm bg-amber-100 text-amber-900" role="alert">{out.map((w) => <div key={w.id}>🤒 {w.name} is out today{s.workers.find((x) => x.tmpProc && x.tmpProc === w.proc) ? ` — covered by ${s.workers.find((x) => x.tmpProc === w.proc).name}` : " — nobody is covering"}.</div>)}{risky.map((w) => <div key={w.id}>⚠ {w.name} may resign soon. Open Team to see why.</div>)}</div>}
        {coach && <div className="rounded-2xl px-3 py-2 text-sm bg-orange-50 text-orange-900" role="note">💡 {coach}</div>}
        {tab === "map" && <>
          <ErrorBoundary label="The factory map" onReset={() => setTab("orders")}><IsoMap s={s} sel={sel} setSel={setSel} /></ErrorBoundary>
          {selP && <Card><div className="flex justify-between items-start"><div className="font-bold">{selP.icon} {selP.name} <span className="font-normal text-xs text-stone-600">({selP.machine})</span></div><button onClick={() => setSel(null)} aria-label="Close panel" className="min-w-[44px] min-h-[44px] font-black text-stone-600">✕</button></div>
            <div className="text-xs text-stone-600 font-mono my-1">Load {Math.round(load(s, selP.id).ratio * 100)}% · staffed {load(s, selP.id).hrs.toFixed(0)}h · waiting {s.q[selP.id].reduce((t, e) => t + e.qty, 0)}{lim.id === selP.id ? " · LIMITING AREA" : ""}</div>
            <div className="text-xs font-bold">People here (tap to adjust):</div><div className="flex gap-2 flex-wrap">{s.workers.filter((w) => effProc(w) === selP.id).map((w) => <button key={w.id} onClick={() => setSel({ t: "w", id: w.id })} className="text-xs font-bold bg-stone-100 rounded-full px-3 min-h-[40px]">{w.name}{w.tmpProc ? " (cover)" : ""}</button>)}</div></Card>}
          {selW && <Card><div className="flex justify-between items-start"><div className="font-bold mb-1">{selW.name} <span className="text-xs font-normal text-stone-600">home {proc(selW.home).name} · {selW.absent ? "OUT today" : "present"}</span></div><button onClick={() => setSel(null)} aria-label="Close panel" className="min-w-[44px] min-h-[44px] font-black text-stone-600">✕</button></div><div className="flex gap-1 flex-wrap">{PROCESSES.map((p) => <button key={p.id} disabled={selW.proc === p.id} onClick={() => act("move", selW.id, p.id)} className="text-xs font-bold px-3 min-h-[40px] rounded-xl bg-white border border-stone-200 disabled:bg-teal-100">{selW.proc === p.id ? "✓ " : ""}{p.name}</button>)}<Btn onClick={() => setTab("team")} c="bg-stone-500">Full profile</Btn></div></Card>}
          <Card className="flex flex-wrap items-center gap-3 justify-between">
            <label className="text-sm font-semibold flex items-center gap-2 min-h-[44px]"><input type="checkbox" disabled={!s.rules.ot} className="w-5 h-5 accent-orange-500" checked={s.ot} onChange={(e) => setS(setOptions(s, { ot: e.target.checked }))} />Overtime (+{CFG.otHours}h, tires people){!s.rules.ot && <span className="text-[10px] text-rose-700"> locked in this challenge</span>}</label>
            <label className="text-sm font-semibold flex items-center gap-2">Priority <select value={s.priority} onChange={(e) => setS(setOptions(s, { priority: e.target.value }))} className="border border-stone-200 rounded-lg px-2 min-h-[40px] bg-white"><option value="due">Earliest due date</option><option value="urgent">Most urgent first</option></select></label>
            <div className="flex gap-2 flex-wrap"><button onClick={pause} className="text-xs font-bold bg-stone-100 rounded-xl px-3 min-h-[44px]" aria-pressed={ent.paused}>{ent.paused ? "▶ Resume real-time" : "⏸ Pause real-time"}</button><Btn onClick={() => adv(1)} disabled={!!ent.result || s.status !== "active"} c="bg-emerald-700 hover:bg-emerald-800">▶ Next day</Btn><Btn onClick={() => adv(5)} disabled={!!ent.result || s.status !== "active"} c="bg-teal-700 hover:bg-teal-800">⏩ Week</Btn></div></Card>
          <div className="text-[11px] text-stone-600 px-1">{s.scenario.pausePolicy === "free" ? "Pausing is allowed in this scenario." : "Pausing is not allowed in this challenge: time keeps running in real time."}</div>
          {la && <Card className="text-xs"><b>Day {la.day} report:</b> shipped {la.shippedToday} units · paid {la.paidH.toFixed(0)}h, used {la.usedH.toFixed(0)}h, unused {la.idleH.toFixed(0)}h (still paid) · new late orders {la.lateToday} · cash in ${Math.round(la.cashIn)} / out ${Math.round(la.cashOut)} · EH {(la.vlpg + la.rcap).toFixed(1)} (verified productivity {la.vlpg.toFixed(1)}, released capacity {la.rcap.toFixed(1)})</Card>}
        </>}
        <ErrorBoundary key={tab} label="This screen" onReset={() => setTab("map")}>
        {tab === "orders" && <Orders s={s} onOffer={offer} />}
        {tab === "standards" && <Standards s={s} />}
        {tab === "team" && <TeamPlus s={s} act={act} />}
        {tab === "ops" && <Ops s={s} act={act} msg={msg} />}
        {tab === "improve" && <><Projects s={s} act={act} msg={msg} /><Improve s={s} onBuy={doBuy} onImport={() => "Use Campaign → Save slots to import."} msg={msg} /></>}
        {tab === "reports" && <Reports s={s} />}
        {tab === "camp" && <Campaign ent={ent} siteId={siteId} setSiteId={setSiteId} slots={slots} slotId={slotId} h={H} />}
        </ErrorBoundary>
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-100 flex justify-around" aria-label="Main">{tabs.map(([k, i, n]) => <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={"flex flex-col items-center text-[10px] font-bold px-1 py-2 min-h-[52px] min-w-[40px] " + (tab === k ? "text-orange-700" : "text-stone-600")}><span className="text-lg">{i}</span>{n}</button>)}</nav>
      {help && <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4"><div role="dialog" aria-label="How to play" className="bg-white rounded-3xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto"><h2 className="font-black text-lg">Welcome to Factory DNA</h2>
        <p className="text-sm text-stone-600 my-2">You've inherited a troubled but viable distribution plant. Over one quarter, stabilize it: hit minimums in profit, on-time delivery, quality and engagement.</p>
        <ol className="text-sm text-stone-700 list-decimal pl-5 space-y-1"><li><b>Map:</b> find the area marked LIMITING and tap it. Work piles up there.</li><li><b>Free capacity:</b> move a person on the Map, or fix a workaround in <b>Improve</b> (Earned Hours pay for it).</li><li><b>Next day</b> (or Week) runs the shift. Production happens in the simulation, not the animation.</li><li>Watch <b>Ops</b> (cartons, machines) and <b>Team</b> (fatigue, engagement). Overtime helps today and costs tomorrow.</li><li><b>Reports</b> explain every dollar and hour. <b>Campaign</b> has chapters, challenges and save slots.</li></ol>
        <p className="text-[11px] text-stone-600 mt-2">The game also advances in real time (1 day = 10 minutes) when you're away, up to 5 days. Everything works offline and saves on this device.</p><div className="mt-3"><Btn onClick={() => { setHelp(false); try { localStorage.setItem("fdna3:seen", "1"); } catch {} }}>Start playing</Btn></div></div></div>}
      {away && <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4"><div role="dialog" aria-label="While you were away" className="bg-white rounded-3xl p-5 max-w-sm w-full"><h2 className="font-black text-lg">While you were away</h2><p className="text-sm text-stone-600 my-2">{away.days} day(s) of routine work ran across your sites: {away.shipped} units shipped, {away.late} new late orders.{away.forfeited ? ` Time beyond ${CFG.maxCatchUp} days was not simulated.` : ""}{away.stopped ? ` Paused for a significant event: ${away.stopped.t}. Check the Map, Ops and Team.` : ""}</p><p className="text-[11px] text-stone-600 mb-3">{ent.clock.rate === "manual" ? "Away-time progress is off (Manual only)." : `One game day = ${ent.clock.dayMs / 60000} real minutes.`} You can change this in Campaign → Time while you're away.</p><Btn onClick={() => setAway(null)}>Continue</Btn></div></div>}
      {ent.result && showCh && <ChallengeResult ent={ent} onRestart={() => H.startChallenge(ent.scenarioId)} onClose={() => setShowCh(false)} />}
      {showRes && ent.mode === "campaign" && <Results s={ent.sites.main} onRestart={H.next} label={ent.sites.main.status === "complete" ? (scorecard(ent.sites.main).pass ? "Start next chapter" : "Retry this chapter") : undefined} onClose={() => setShowRes(false)} />}
    </div>
  );
}
