// Standalone challenge scenarios. Each is a separate enterprise container, so it never touches the main campaign and can be restarted freely.
import { SCENARIOS, PROCESSES } from "../content/index.js";
import { newCampaign, snapshot, rollEvent } from "./sim.js";
import { wrap } from "./enterprise.js";
export function startScenario(id, now = Date.now()) {
  const sc = SCENARIOS.find((x) => x.id === id); if (!sc) return null; const s = newCampaign(sc.seed, now);
  s.day = sc.startDay; s.endDay = sc.startDay + sc.days - 1; s.orders.forEach((o) => (o.due += s.day - 1)); s.cash = s.openCash = sc.setup.cash; s.bank = s.startBank = sc.setup.bank;
  s.rules = { ...s.rules, ...sc.rules }; s.scenario = { id: sc.id, pausePolicy: sc.pausePolicy, paused: false }; s.chapter = 0; s.nextEvent = rollEvent(s);
  if (sc.setup.health) for (const p of PROCESSES) s.mach[p.id].health = sc.setup.health[p.id];
  for (const w of s.workers) { if (sc.setup.fat != null) w.fat = sc.setup.fat; if (sc.setup.trust != null) w.trust = sc.setup.trust; if (sc.setup.morale != null) w.morale = sc.setup.morale; }
  s.snap = snapshot(s); const e = wrap(s, now, sc.name); e.mode = "challenge"; e.scenarioId = id; return e;
}
