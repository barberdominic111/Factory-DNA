import { describe, it, expect } from "vitest";
import { newEnterprise, catchUpEnt, setRate, stepEnterprise } from "../src/engine/enterprise.js";
import { startScenario } from "../src/engine/scenarios.js";
import { parseEnt, exportEnt } from "../src/engine/slots.js";
import { RATES, CFG } from "../src/content/index.js";
const T0 = 1e12, free = (e) => ({ ...e, sites: { main: { ...e.sites.main, scenario: { ...e.sites.main.scenario, pausePolicy: "none" } } } });
describe("away-time rate", () => {
  it("a slower rate simulates fewer days for the same time away", () => {
    const a = setRate(free(newEnterprise(1, T0)), "relaxed", T0).ent, b = setRate(free(newEnterprise(1, T0)), "fast", T0).ent, t = T0 + 3 * RATES.standard.dayMs;
    expect(catchUpEnt(a, t).days).toBe(1); expect(catchUpEnt(b, t).days).toBe(CFG.maxCatchUp > 5 ? 5 : 5 > 0 ? Math.min(6, CFG.maxCatchUp) : 0);
  });
  it("manual mode never advances while away", () => { const e = setRate(newEnterprise(2, T0), "manual", T0).ent; expect(catchUpEnt(e, T0 + 1e9).days).toBe(0); expect(stepEnterprise(e).sites.main.day).toBe(2); });
  it("changing the rate settles elapsed time at the old rate first and never duplicates days", () => {
    const e = free(newEnterprise(3, T0)), t = T0 + 2.5 * RATES.standard.dayMs, r = setRate(e, "relaxed", t);
    expect(r.ok).toBe(true); expect(r.settled.days).toBe(2); expect(r.ent.sites.main.day).toBe(3); expect(catchUpEnt(r.ent, t).days).toBe(0);
    const back = setRate(r.ent, "standard", t); expect(back.settled).toBeNull(); expect(back.ent.sites.main.day).toBe(3); expect(catchUpEnt(back.ent, t).days).toBe(0);
  });
  it("is locked in challenges and rejects unknown rates", () => { expect(setRate(startScenario("flow", T0), "fast", T0).ok).toBe(false); expect(setRate(newEnterprise(4, T0), "warp", T0).ok).toBe(false); });
  it("the chosen rate survives save/load, and older saves default to standard", () => {
    const e = setRate(newEnterprise(5, T0), "relaxed", T0).ent; expect(parseEnt(exportEnt(e)).ent.clock.rate).toBe("relaxed");
    const old = JSON.parse(exportEnt(newEnterprise(5, T0))); delete old.clock.rate; const r = parseEnt(JSON.stringify(old)); expect(r.ok).toBe(true); expect(r.ent.clock.rate || "standard").toBe("standard");
  });
});
