import React, { useState, useRef, useEffect } from "react";
import { PROCESSES } from "../content/index.js";
import { load, limiting, effProc } from "../engine/sim.js";

// Isometric-style floor: each area is a diamond tile placed by grid coords; content stays upright and tappable.
// The whole map scales to fit the screen width; pan/zoom are plain buttons plus drag (never gesture-only).
const W = 190, H = 95, PAD = 20, BASE_H = H * 2 + PAD * 2;
const at = (p) => ({ x: (p.gx - p.gy) * (W / 2) + W, y: (p.gx + p.gy) * (H / 2) + PAD });

export default function IsoMap({ s, sel, setSel }) {
  const [labels, setLabels] = useState(true), [z, setZ] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 }), [w, setW] = useState(360), drag = useRef(null), box = useRef(null);
  useEffect(() => { const el = box.current; if (!el) return; const f = () => setW(el.clientWidth || 360); f(); if (typeof ResizeObserver === "undefined") return; const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, []);
  const fit = Math.min(1.5, (w - 16) / (W * 2)), scale = fit * z, lim = limiting(s).id;
  const down = (e) => { if (e.target.closest("button")) return; drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  const mv = (e) => { if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  return (
    <div ref={box} className="relative rounded-3xl bg-gradient-to-b from-sky-50 to-amber-50 overflow-hidden select-none" style={{ height: Math.max(230, BASE_H * fit * 1.05 + 40), touchAction: "none" }} onPointerDown={down} onPointerMove={mv} onPointerUp={() => (drag.current = null)}>
      <div className="absolute left-1/2 top-1/2" style={{ width: W * 2, height: BASE_H, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`, transformOrigin: "center" }}>
        {PROCESSES.map((p, i) => {
          const { x, y } = at(p), l = load(s, p.id), isLim = p.id === lim, units = s.q[p.id].reduce((t, e) => t + e.qty, 0), ws = s.workers.filter((wk) => effProc(wk) === p.id && !wk.absent), over = l.ratio > 1;
          const selected = sel && sel.t === "p" && sel.id === p.id;
          return (
            <React.Fragment key={p.id}>
              <div className="absolute" style={{ left: x - W / 2, top: y, width: W, height: H, clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)", background: isLim ? "#fdba74" : "#fde68a", outline: selected ? "3px solid #0369a1" : "none" }} />
              {labels && <button onClick={() => setSel({ t: "p", id: p.id })} className={"absolute -translate-x-1/2 text-center rounded-lg px-2 py-0.5 bg-white/95 shadow " + (selected ? "ring-4 ring-sky-600" : "")} style={{ left: x, top: y + 3, minWidth: 82, minHeight: 40 }}>
                <div className="text-[10px] font-black text-stone-800 leading-tight">{i + 1}. {p.name}</div>
                <div className={"text-[10px] font-mono font-bold leading-tight " + (over ? "text-rose-700" : "text-emerald-800")}>{over ? "▲ " : "● "}Load {Math.round(l.ratio * 100)}%</div>
                {isLim && <div className="text-[9px] font-black text-orange-800 leading-tight">LIMITING</div>}</button>}
              <button onClick={() => setSel({ t: "p", id: p.id })} aria-label={`${p.name}${isLim ? ", limiting area" : ""}, ${Math.round(l.ratio * 100)} percent loaded`} className={"absolute -translate-x-1/2 text-3xl rounded-xl leading-none " + (!labels && selected ? "ring-4 ring-sky-600" : "")} style={{ left: x, top: y + (labels ? 40 : 28), minWidth: 44, minHeight: 44 }} title={p.machine}>{p.icon}{!labels && isLim && <span className="absolute -top-1 -right-2 text-xs" aria-hidden="true">⚠</span>}</button>
              <div className="absolute -translate-x-1/2 text-[10px] font-mono font-bold text-stone-700 pointer-events-none whitespace-nowrap" style={{ left: x, top: y + H - 22 }}><span aria-hidden="true">{"📦".repeat(Math.min(4, Math.ceil(units / 250)))}</span> <span aria-label={`${units} units waiting`}>{units}</span></div>
              {ws.slice(0, 3).map((wk, k) => (
                <button key={wk.id} onClick={() => setSel({ t: "w", id: wk.id })} aria-label={`${wk.name}, fatigue ${Math.round(wk.fat)} percent`} className={"absolute -translate-x-1/2 text-xl bob " + (sel && sel.t === "w" && sel.id === wk.id ? "scale-125 drop-shadow" : "")} style={{ left: x + (k === 0 ? -46 : k === 1 ? 46 : 0), top: y + (k === 2 ? H - 36 : 44), minWidth: 44, minHeight: 44 }}>🧑‍🏭</button>
              ))}
            </React.Fragment>
          );
        })}
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[[labels ? "Aa" : "A̶a̶", () => setLabels(!labels), labels ? "Hide area names" : "Show area names"], ["+", () => setZ(Math.min(1.8, z + 0.2)), "Zoom in"], ["−", () => setZ(Math.max(0.6, z - 0.2)), "Zoom out"], ["⟲", () => { setZ(1); setPan({ x: 0, y: 0 }); }, "Reset view"]].map(([t, f, a]) => <button key={a} onClick={f} aria-label={a} aria-pressed={a.includes("names") ? labels : undefined} className="w-11 h-11 rounded-xl bg-white shadow font-black text-stone-700 text-sm">{t}</button>)}
      </div>
      <div className="absolute left-2 bottom-2 text-[10px] font-bold text-stone-700 bg-white/85 rounded-lg px-2 py-1 max-w-[70%]">Flow 1→2→3→4 · 📦 units waiting · drag to pan · tap an area or person</div>
    </div>
  );
}
