// Real-time catch-up. One sim day = scenario dayMs of real time. Bounded, monotonic and idempotent:
// lastTs only moves forward by whole days actually simulated (or forfeited past the cap), so reloading or re-calling with the same
// timestamp never duplicates production, rewards or events. Limitation: an offline game cannot detect a device clock moved forward.
import { CFG } from "../content/index.js";
import { stepDay } from "./sim.js";
export function catchUp(s, now) {
  const none = { state: s, days: 0, forfeited: 0, stopped: null, summary: null };
  if (s.status !== "active" || s.scenario.paused) return none;
  const dayMs = s.clock.dayMs, whole = Math.floor((now - s.clock.lastTs) / dayMs);
  if (!(whole >= 1)) return none; // not enough time, or the clock moved backwards: nothing happens
  const n = Math.min(whole, CFG.maxCatchUp); let x = s, days = 0, stopped = null, shipped = 0, late = 0, eh = 0;
  while (days < n && x.status === "active") {
    x = stepDay(x); days++; shipped += x.last.shippedToday; late += x.last.lateToday; eh += x.last.vlpg + x.last.rcap;
    if (x.event.tone === "bad" && x.scenario.pausePolicy === "free") { stopped = x.event; break; } // significant decision: stop and ask the player
  }
  const forfeited = stopped ? 0 : whole - days;
  const consumed = stopped ? days : whole; // time beyond the cap is forfeited, not banked
  x = structuredClone(x); x.clock.lastTs = s.clock.lastTs + consumed * dayMs;
  return { state: x, days, forfeited, stopped, summary: { days, shipped, late, eh } };
}
export const manualAdvance = (s, now) => { const x = stepDay(s); if (x === s) return s; const y = structuredClone(x); y.clock.lastTs = Math.max(y.clock.lastTs, now); return y; };
