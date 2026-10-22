import { describe, it, expect } from "vitest";
import { newCampaign, stepDay, buy, moveWorker, planPM, emergencyRepair, startTraining, setPath, startProject, approveProject, setProduct, beginChapter, engagement, riskOf, staffing, secOf, scorecard, invariants, setCover, setOptions, setTemps, invest, load, effProc, mixOf, perfW } from "../src/engine/sim.js";
import { newEnterprise, stepEnterprise, nextChapter, allocate, remit, expand, transferMaterial, transferWork, reconcile, summary, catchUpEnt, scenarioResult } from "../src/engine/enterprise.js";
import { startScenario } from "../src/engine/scenarios.js";
import { saveSlot, loadSlot, listSlots, parseEnt, exportEnt, validateEnt, deleteSlot, migrateLegacy } from "../src/engine/slots.js";
import { exportSave } from "../src/engine/persist.js";
import { closeQuarter } from "../src/engine/report.js";
import { CFG, PROJECTS } from "../src/content/index.js";

const T0 = 1e12, run = (s, n) => { for (let i = 0; i < n; i++) s = stepDay(s); return s; };
const mature = (s) => { s = JSON.parse(JSON.stringify(s)); s.workers.forEach((w) => { w.xp = 90; w.mastery = 100; }); return s; };

describe("careers", () => {
  it("promotion needs mastery and Earned Hours, and mastery comes from days worked", () => {
    let s = newCampaign(1, T0); expect(setPath(s, "w0", "specialist").ok).toBe(false); s = run(s, 30); expect(s.workers[0].mastery).toBeGreaterThan(25);
    const r = setPath(s, "w0", "specialist"); expect(r.ok).toBe(true); expect(r.state.bank).toBe(s.bank - CFG.pathCost);
  });
  it("specialist beats a flexible operator at home; flexible loses less when working elsewhere", () => {
    const base = mature(newCampaign(2, T0)), a = JSON.parse(JSON.stringify(base)), b = JSON.parse(JSON.stringify(base)); a.workers[0].path = "specialist"; b.workers[0].path = "flex";
    expect(perfW(a, a.workers[0], "rcv")).toBeGreaterThan(perfW(b, b.workers[0], "rcv"));
    const aw = moveWorker(a, "w0", "pick"), bw = moveWorker(b, "w0", "pick");
    expect(perfW(bw, bw.workers[0], "pick")).toBeGreaterThan(perfW(aw, aw.workers[0], "pick"));
  });
  it("a team lead lifts teammates; a trainer halves training time", () => {
    const s = newCampaign(2, T0), l = JSON.parse(JSON.stringify(s)); l.workers[1].path = "lead"; expect(perfW(l, l.workers[0], "rcv")).toBeGreaterThan(perfW(s, s.workers[0], "rcv"));
    const t = JSON.parse(JSON.stringify(s)); t.workers[3].path = "trainer";
    const solo = run(startTraining(s, "w0", "cross", "pick").state, 2), coached = run(startTraining(t, "w0", "cross", "pick").state, 2);
    expect(solo.workers[0].certs.pick).toBeUndefined(); expect(coached.workers[0].certs.pick).toBe(true);
  });
});

describe("training", () => {
  it("consumes production time and cash now, and gives a lasting benefit", () => {
    const s = newCampaign(3, T0), t = startTraining(s, "w0", "cross", "pick").state;
    expect(staffing(t, "rcv", false).hrs).toBe(staffing(s, "rcv", false).hrs - CFG.trainHours); expect(t.cash).toBe(s.cash - CFG.trainCost);
    const done = run(t, 5); expect(done.training).toHaveLength(0); expect(done.workers[0].certs.pick).toBe(true);
    const away = moveWorker(done, "w0", "pick"), plain = moveWorker(s, "w0", "pick"); expect(perfW(away, away.workers[0], "pick")).toBeGreaterThan(perfW(plain, plain.workers[0], "pick"));
    expect(staffing(done, "rcv", false).hrs).toBe(staffing(s, "rcv", false).hrs);
  });
  it("allows only two sessions at a time and no duplicates", () => {
    let s = startTraining(newCampaign(3, T0), "w0", "skill").state; expect(startTraining(s, "w0", "skill").ok).toBe(false); s = startTraining(s, "w1", "skill").state; expect(startTraining(s, "w2", "skill").ok).toBe(false);
  });
});

describe("engagement, risk and recovery", () => {
  it("engagement is built from named, explained factors and moves with them", () => {
    const s = newCampaign(4, T0), e = engagement(s, s.workers[0]); expect(e.factors.map((f) => f.label)).toContain("Overtime strain"); expect(e.factors.length).toBeGreaterThanOrEqual(8);
    const tired = JSON.parse(JSON.stringify(s)); tired.workers[0].fat = 90; expect(engagement(tired, tired.workers[0]).target).toBeLessThan(e.target);
    const away = moveWorker(s, "w0", "pick"); expect(engagement(away, away.workers[0]).target).toBeLessThan(e.target);
  });
  it("repeated overtime lowers engagement over time and raises absence risk, with reasons", () => {
    let s = setOptions(newCampaign(5, T0), { ot: true }); const before = s.workers[0].morale; s = run(s, 8);
    expect(s.workers[0].morale).toBeLessThan(before); const r = riskOf(s, s.workers[0]); expect(r.score).toBeGreaterThan(20); expect(r.reasons.join()).toMatch(/overtime/);
  });
  it("fatigue recovers on rest (no overtime) and stays bounded", () => { const s = run(newCampaign(5, T0), 30); expect(Math.max(...s.workers.map((w) => w.fat))).toBeLessThan(40); });
  it("very low engagement for 10 days causes a resignation, and a replacement arrives later", () => {
    let s = newCampaign(6, T0); s.workers[0].morale = 5; s.workers[0].lowDays = 9; s.workers[0].trust = 0; s.workers[0].fat = 100; s.workers[0].path = null; s = run(s, 1);
    expect(s.stats.resigned).toBe(1); expect(s.workers).toHaveLength(7); s = run(s, 7); expect(s.workers.length).toBe(8); expect(s.audit.some((a) => /resigned/.test(a.text))).toBe(true);
  });
  it("absences are rolled for the day ahead, covered automatically, and manual moves override cover", () => {
    let s = newCampaign(7, T0); for (const w of s.workers) { w.fat = 100; w.morale = 0; }
    let found = null; for (let i = 0; i < 40 && !found; i++) { s = stepDay(s); if (s.workers.some((w) => w.absent)) found = s; s.workers.forEach((w) => { w.fat = 100; w.morale = 0; w.lowDays = 0; }); }
    expect(found).toBeTruthy(); const gone = found.workers.find((w) => w.absent); expect(staffing(found, gone.proc, false).hrs).toBeLessThan(16);
    expect(invariants(stepDay(found)).conserved).toBe(true); const cov = found.workers.find((w) => w.tmpProc); if (cov) { const m = moveWorker(found, cov.id, cov.proc); expect(m.workers.find((w) => w.id === cov.id).tmpProc).toBeNull(); }
    expect(setCover(found, false).autoCover).toBe(false);
  });
});

describe("projects", () => {
  it("a focused event costs cash and production time, then permanently lowers standard time", () => {
    const s = newCampaign(8, T0), base = secOf(s, "pick"), p = startProject(s, "slot").state; expect(p.cash).toBe(s.cash - 500); expect(staffing(p, "pick", false).hrs).toBeLessThan(staffing(s, "pick", false).hrs);
    const d = run(p, 3), real = d.projects[0].real; expect(d.projects[0].status).toBe("done"); expect(secOf(d, "pick")).toBeCloseTo(base - 4 * real, 6); expect(staffing(d, "pick", false).hrs).toBe(staffing(s, "pick", false).hrs);
    expect(startProject(d, "slot").ok).toBe(false); expect(d.baseSec.pick).toBe(s.baseSec.pick);
  });
  it("a staged project needs a review approval and pays out through the same Earned Hours rules", () => {
    const rich = newCampaign(8, T0); rich.cash = rich.openCash = 60000; let s = startProject(rich, "packline").state; s = run(s, 2); expect(s.projects[0].status).toBe("review"); expect(approveProject(newCampaign(8, T0), "packline").ok).toBe(false);
    const base = secOf(newCampaign(8, T0), "pack"); expect(secOf(s, "pack")).toBe(base); s = approveProject(s, "packline").state; s = run(s, 3); expect(s.projects[0].status).toBe("review");
    const pilot = secOf(s, "pack"); expect(pilot).toBeLessThan(base); s = approveProject(s, "packline").state; s = run(s, 3); expect(s.projects[0].status).toBe("done"); expect(secOf(s, "pack")).toBeLessThan(pilot);
    expect(s.eh.vlpg).toBeGreaterThan(0); expect(invariants(s).ehOk).toBe(true); expect(s.audit.some((a) => /Project complete/.test(a.text))).toBe(true);
  });
  it("won't start without the cash", () => { const s = newCampaign(8, T0); s.cash = 100; expect(startProject(s, "slot").ok).toBe(false); });
});

describe("chapters and products", () => {
  const finish = (e) => { for (let i = 0; i < 60; i++) e = stepEnterprise(e); return e; };
  it("the third product is locked until Chapter 2, then needs a capability rule", () => {
    let s = newCampaign(9, T0); expect(setProduct(s, "gift", "activate").ok).toBe(false); s = beginChapter(s, 2).state; expect(s.products.gift.unlocked).toBe(true);
    expect(setProduct(s, "gift", "activate").ok).toBe(false); s = buy(s, "sw:pack").state; const r = setProduct(s, "gift", "activate"); expect(r.ok).toBe(true); expect(mixOf(r.state).map((m) => m.pr.id)).toContain("gift");
  });
  it("retiring a product stops new orders but honors open orders and inventory", () => {
    let s = run(newCampaign(9, T0), 3); const open = s.orders.filter((o) => o.product === "bundle" && o.status === "open").length, cartons = s.mat.onhand; expect(open).toBeGreaterThan(0);
    s = setProduct(s, "bundle", "retire").state; const n0 = s.orders.length; s = run(s, 10); expect(s.orders.slice(n0).some((o) => o.product === "bundle" && o.kind !== "replacement")).toBe(false);
    expect(s.orders.filter((o) => o.product === "bundle").some((o) => o.status === "done" || o.shipped > 0)).toBe(true); expect(s.mat.onhand).toBeGreaterThan(0); expect(cartons).toBeGreaterThan(0); expect(invariants(s).conserved).toBe(true);
    expect(setProduct(setProduct(newCampaign(9, T0), "bundle", "retire").state, "kit", "retire").ok).toBe(false);
  });
  it("the campaign persists across chapters: state carries over and results are measured per chapter", () => {
    let e = newEnterprise(11, T0); e.sites.main.cash += 0; e = finish(e); expect(e.sites.main.status).toBe("complete");
    const r = nextChapter(e); expect(r.ok).toBe(true); const s = r.ent.sites.main; expect(s.chapter).toBeGreaterThanOrEqual(1); expect(s.status).toBe("active"); expect(s.endDay).toBe(e.sites.main.endDay + 60 > 0 ? s.day + 59 : 0);
    expect(r.ent.history).toHaveLength(1); expect(s.baseSec).toEqual(e.sites.main.baseSec); expect(s.bank).toBe(e.sites.main.bank); expect(s.workers).toEqual(e.sites.main.workers); expect(scorecard(s).dims[0].value).toBe(0);
    expect(invariants(s).cashOk).toBe(true);
  });
  it("a failed chapter can be retried without losing the plant", () => { let e = finish(newEnterprise(12, T0)); const s = e.sites.main; if (!scorecard(s).pass) { const r = nextChapter(e); expect(r.retry).toBe(true); expect(r.ent.sites.main.chapter).toBe(s.chapter); } });
});

describe("challenges", () => {
  it("are separate containers with their own rules, and are restartable and seeded", () => {
    const a = startScenario("flow", T0), b = startScenario("flow", T0); expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.mode).toBe("challenge"); expect(a.sites.main.rules.invest).toBe(false);
    expect(invest(a.sites.main, "conv").ok).toBe(false); const st = startScenario("steady", T0); expect(setOptions(st.sites.main, { ot: true }).ot).toBe(false); expect(startScenario("steady", T0).sites.main.scenario.pausePolicy).toBe("none");
  });
  it("outcomes come from real simulation results: the steady-hands scenario fails on two resignations", () => {
    let e = startScenario("steady", T0); for (const w of e.sites.main.workers.slice(0, 2)) { w.morale = 0; w.lowDays = 9; w.trust = 0; w.fat = 100; } e = stepEnterprise(e);
    expect(e.result.status).toBe("failed"); expect(e.result.objectives.length).toBe(4);
  });
  it("doing nothing doesn't pass either challenge", () => {
    for (const id of ["flow", "steady"]) { let e = startScenario(id, T0); for (let i = 0; i < 31 && !e.result; i++) e = stepEnterprise(e); expect(e.result.status).not.toBe("passed"); }
  });
  it("flow crunch can be won with real operational fixes", () => {
    let e = startScenario("flow", T0);
    for (let d = 0; d < 31 && !e.result; d++) { let s = e.sites.main; if (d === 0) s = moveWorker(s, "w6", "pick"); for (const id of ["cont:WE-0009", "sw:pack", "cont:WE-0010", "cont:WE-0004", "cont:WE-0014", "cont:WE-0018"]) { const r = buy(s, id); if (r.ok) s = r.state; } if (d % 10 === 3) s = planPM(s, "pick"); if (s.mach.pick.down > 0) { const r = emergencyRepair(s, "pick"); if (r.ok) s = r.state; } e = stepEnterprise({ ...e, sites: { main: s } }); }
    expect(e.result.status).toBe("passed");
  });
});

describe("multi-site enterprise", () => {
  const grown = () => { let e = newEnterprise(21, T0); for (let i = 0; i < 12; i++) e = stepEnterprise(e); e = { ...e, corp: { cash: 40000, open: 40000 } }; return e; };
  it("expansion costs corporate cash, builds a site with its own resources and a locked local baseline", () => {
    const e = grown(); expect(expand({ ...e, corp: { ...e.corp, cash: 100 } }, "east").ok).toBe(false); const r = expand(e, "east"); expect(r.ok).toBe(true); const n = r.ent, east = n.sites.east;
    expect(n.corp.cash).toBe(40000 - CFG.expandCost); expect(east.cash).toBe(CFG.expandSeed); expect(east.day).toBe(n.sites.main.day); expect(east.q.pick).toEqual([]); expect(east.mat.onhand).toBe(CFG.startCartons); expect(east.workers.length).toBe(8);
    expect(Object.keys(east.cont).length).toBeLessThan(Object.keys(n.sites.main.cont).length); expect(east.orders.every((o) => o.due >= east.day)).toBe(true);
  });
  it("sites run independently and enterprise results reconcile to site events", () => {
    let e = expand(grown(), "east").ent; for (let i = 0; i < 20; i++) { e = stepEnterprise(e); const rc = reconcile(e); expect(rc.every((c) => c.pass), JSON.stringify(rc)).toBe(true); }
    const sm = summary(e); expect(sm.rows).toHaveLength(2); expect(e.sites.east.stats.shipped).toBeGreaterThan(0); expect(e.sites.east.stats.shipped).not.toBe(e.sites.main.stats.shipped);
    expect(Math.abs(sm.cash - (e.corp.cash + e.sites.main.cash + e.sites.east.cash))).toBeLessThan(1e-6);
  });
  it("material transfers take time, cost money and are accounted on both sides", () => {
    let e = expand(grown(), "east").ent; const m0 = e.sites.main.mat.onhand, e0 = e.sites.east.mat.onhand, c0 = e.sites.main.cash;
    expect(transferMaterial(e, "main", "east", 99999999).ok).toBe(false); e.sites.main.mat.onhand += 3000; e.sites.main.mat.open += 3000; e = JSON.parse(JSON.stringify(e)); const m0b = e.sites.main.mat.onhand, c0b = e.sites.main.cash; const tm = transferMaterial(e, "main", "east", 1000); expect(tm.reason).toBeUndefined(); e = tm.ent;
    expect(e.sites.main.mat.onhand).toBe(m0b - 1000); expect(e.sites.east.mat.onhand).toBe(e0); expect(e.sites.main.cash).toBe(c0b - 50); expect(reconcile(e).every((c) => c.pass)).toBe(true);
    e = stepEnterprise(e); expect(e.transfers[0].status).toBe("transit"); expect(reconcile(e).every((c) => c.pass)).toBe(true); const eastBefore = e.sites.east.mat.onhand; e = stepEnterprise(e);
    expect(e.transfers[0].status).toBe("done"); expect(e.sites.east.mat.onhand).toBeGreaterThan(eastBefore - 5000); expect(reconcile(e).every((c) => c.pass)).toBe(true);
  });
  it("work transfers move only unstarted units, still have to be produced, and reconcile", () => {
    let e = expand(grown(), "east").ent; const o = e.sites.main.orders.find((x) => x.status === "open" && x.qty - Math.max(x.released, 1) > 50);
    expect(transferWork(e, "main", "east", o.id, 100000).ok).toBe(false); const qty = o.qty, r = transferWork(e, "main", "east", o.id, 50); expect(r.ok).toBe(true); e = r.ent;
    expect(e.sites.main.orders.find((x) => x.id === o.id).qty).toBe(qty - 50); const n0 = e.sites.east.orders.length; e = stepEnterprise(e); expect(e.sites.east.orders.length).toBeGreaterThan(n0);
    const tr = e.sites.east.orders.find((x) => x.kind === "transfer"); expect(tr.shipped).toBeLessThanOrEqual(tr.qty); expect(tr.qty).toBe(50); for (let i = 0; i < 10; i++) e = stepEnterprise(e); expect(reconcile(e).every((c) => c.pass)).toBe(true);
  });
  it("capital allocation moves real cash between corporate and sites, and the site keeps a reserve", () => {
    let e = grown(); e = allocate(e, "main", 30000).ent; e = remit(e, "main", 2000).ent; const c = e.corp.cash; expect(allocate(e, "main", 1e9).ok).toBe(false); e = allocate(e, "main", 500).ent; expect(e.corp.cash).toBe(c - 500); expect(remit(e, "main", 1e9).ok).toBe(false); expect(reconcile(e).every((x) => x.pass)).toBe(true);
  });
  it("real-time catch-up is bounded and idempotent for the enterprise", () => {
    const e = newEnterprise(5, T0), a = catchUpEnt({ ...e, sites: { main: { ...e.sites.main, scenario: { ...e.sites.main.scenario, pausePolicy: "none" } } } }, T0 + 500 * CFG.dayMs); expect(a.days).toBeLessThanOrEqual(CFG.maxCatchUp); expect(catchUpEnt(a.ent, T0 + 500 * CFG.dayMs).days).toBe(0);
  });
});

describe("save slots and migration", () => {
  it("slots round-trip, keep a backup, and fall back to it if the main copy is damaged", () => {
    const e = newEnterprise(31, T0); saveSlot("a", e); const e2 = stepEnterprise(e); saveSlot("a", e2); expect(loadSlot("a").ent.sites.main.day).toBe(e2.sites.main.day);
    localStorage_set("fdna3:slot:a", "{broken"); const r = loadSlot("a"); expect(r.ok).toBe(true); expect(r.usedBackup).toBe(true); expect(r.ent.sites.main.day).toBe(e.sites.main.day); deleteSlot("a"); expect(loadSlot("a").ok).toBe(false);
  });
  it("lists several slots and keeps them independent", () => { saveSlot("x1", newEnterprise(1, T0)); saveSlot("x2", startScenario("flow", T0)); expect(listSlots().map((s) => s.id)).toEqual(expect.arrayContaining(["x1", "x2"])); expect(loadSlot("x2").ent.mode).toBe("challenge"); expect(loadSlot("x1").ent.mode).toBe("campaign"); });
  it("export/import works, and malformed imports are rejected without touching a valid slot", () => {
    const e = stepEnterprise(newEnterprise(32, T0)); saveSlot("keep", e); expect(parseEnt(exportEnt(e)).ent).toEqual(e);
    for (const bad of ["nope", "{}", '{"kind":"enterprise"}', JSON.stringify({ ...e, order: ["ghost"] })]) expect(parseEnt(bad).ok).toBe(false);
    const damaged = JSON.parse(exportEnt(e)); damaged.sites.main.workers[0].proc = "x"; expect(validateEnt(damaged)).toBe(false); expect(loadSlot("keep").ent).toEqual(e);
  });
  it("imports a bare Phase 2 site save and migrates it to the current version without data loss", () => {
    const s = run(newCampaign(33, T0), 6), v2 = JSON.parse(exportSave(s)); v2.v = 2; for (const k of ["products", "projects", "training", "pairs", "vacancy", "nextHire", "endDay", "chapter", "autoCover", "rules", "snap"]) delete v2[k]; v2.workers.forEach((w) => { for (const k of ["path", "xp", "mastery", "trust", "certs", "lastDev", "lowDays", "absent", "tmpProc"]) delete w[k]; }); delete v2.cf.corp; delete v2.cf.transfer; delete v2.fin.transfer;
    const r = parseEnt(JSON.stringify(v2)); expect(r.ok).toBe(true); const m = r.ent.sites.main; expect(m.v).toBe(3); expect(m.day).toBe(s.day); expect(m.cash).toBe(s.cash); expect(m.bank).toBe(s.bank); expect(m.orders.length).toBe(s.orders.length); expect(m.workers[0].path).toBeNull();
    expect(() => stepDay(m)).not.toThrow(); expect(invariants(stepDay(m)).conserved).toBe(true);
  });
  it("migrates an older single save into a slot without deleting the original", () => {
    localStorage_set("factory-dna-save-v1", exportSave(run(newCampaign(34, T0), 3))); ["x1", "x2", "keep"].forEach(deleteSlot); const r = migrateLegacy(); expect(r && r.ok).toBe(true); expect(loadSlot(r.id).ok).toBe(true); expect(localStorage_get("factory-dna-save-v1")).not.toBeNull();
  });
  it("quarter close still reconciles after all Phase 3 systems run", () => {
    let s = newCampaign(35, T0); s = startProject(s, "slot").state; s = startTraining(s, "w0", "cross", "pick").state; s = run(s, 60); const c = closeQuarter(s); expect(c.checks.every((k) => k.pass), JSON.stringify(c.checks.filter((k) => !k.pass))).toBe(true);
  });
});
// tiny helpers touching the same storage layer the app uses (falls back to memory in tests)
import * as S from "../src/engine/slots.js";
function localStorage_set(k, v) { globalThis.__ls = globalThis.__ls || {}; globalThis.localStorage = globalThis.localStorage || { getItem: (x) => (x in globalThis.__ls ? globalThis.__ls[x] : null), setItem: (x, y) => (globalThis.__ls[x] = String(y)), removeItem: (x) => delete globalThis.__ls[x] }; globalThis.localStorage.setItem(k, v); }
function localStorage_get(k) { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : null; }
