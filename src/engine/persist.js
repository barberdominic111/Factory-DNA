// Versioned local saves with migration and validation. A bad import never touches the existing save.
import { PROCESSES, CFG } from "../content/index.js";
const KEY = "factory-dna-save-v1"; // key kept so Phase 1 saves are found and migrated
let mem = null;
export function migrate(x) {
  if (!x || typeof x !== "object") return x;
  if (x.v === 1) { // Phase 1 -> Phase 2: add new systems without touching existing progress
    const y = structuredClone(x); y.v = 2; y.otStreak = 0; y.nextPO = 1; y.temps = {}; y.pm = {};
    PROCESSES.forEach((p) => { y.temps[p.id] = 0; y.pm[p.id] = false; });
    y.mach = { rcv: { health: 80, down: 0 }, pick: { health: 60, down: 0 }, pack: { health: 75, down: 0 }, ship: { health: 80, down: 0 } };
    y.stats = { checked: 0, passed1: 0, reworked: 0, returned: 0, escaped: 0, ...y.stats };
    const c = (y.materials && y.materials.cartons) || 0; y.mat = { onhand: c, reserved: 0, open: c, receipts: 0, consumed: 0, adjust: 0 }; delete y.materials;
    y.po = []; y.returns = []; y.ar = []; y.assets = []; y.cust = {}; y.audit = []; y.done = {}; y.close = null;
    y.openCash = y.cash; y.cf = { receipts: 0, supplier: 0, components: 0, payroll: 0, opex: 0, maint: 0, capital: 0, penalties: 0, expedite: 0 };
    y.eh = { baseH: 0, stdH: 0, usedH: 0, vlpg: 0, rcap: 0, paidReg: 0, paidOT: 0, tempH: 0, tempCost: 0, unusedH: 0, releasedH: 0, cashSaved: 0 };
    const f = y.fin || {}; y.fin = { revenue: f.revenue || 0, credits: 0, cogs: f.material || 0, scrapRework: 0, labor: f.labor || 0, overtime: 0, temp: 0, maint: 0, expedite: 0, opex: f.overhead || 0, penalties: 0, depr: 0, assetOps: 0 };
    y.orders = y.orders.map((o) => ({ kind: "spot", returned: 0, resv: 0, ...o })); y.clock = { lastTs: Date.now(), dayMs: CFG.dayMs }; y.scenario = { id: "opening", pausePolicy: "free", paused: false };
    y.ledger = y.ledger.map((e, i) => ({ ...e, type: e.type === "RC" ? "VLPG" : e.type === "LP" ? "RCAP" : e.type, key: e.key || `legacy:${i}` }));
    y.credited = y.ledger.filter((e) => e.type !== "SHORT" && e.type !== "SPEND").reduce((t, e) => t + e.eh, 0); y.spent = -y.ledger.filter((e) => e.type === "SPEND").reduce((t, e) => t + e.eh, 0);
    y.bank = y.startBank + y.credited - y.spent; // legacy saves reconcile to their own ledger
    x = y;
  }
  if (x.v === 2) { // Phase 2 -> Phase 3: people, projects, products, chapters; nothing existing is touched
    const y = structuredClone(x); y.v = 3; y.products = { kit: { active: true }, bundle: { active: true }, gift: { active: false, unlocked: false } };
    y.projects = []; y.training = []; y.pairs = {}; y.vacancy = []; y.nextHire = 1; y.endDay = CFG.quarterDays; y.chapter = 1; y.autoCover = true; y.snap = null;
    y.rules = { ot: true, invest: true, temps: true, delayW: 1, safeDay: 4, thr: {} };
    y.cf = { corp: 0, transfer: 0, ...y.cf }; y.fin = { transfer: 0, ...y.fin }; y.stats = { resigned: 0, ...y.stats };
    y.workers = y.workers.map((w) => ({ path: null, xp: 0, mastery: 0, trust: 60, certs: {}, lastDev: -99, lowDays: 0, absent: false, tmpProc: null, ...w }));
    return y;
  }
  return x;
}
export function validate(x) {
  try {
    if (!x || x.v !== 3 || typeof x.day !== "number" || x.day < 1) return false;
    if (!Array.isArray(x.workers) || !x.workers.length || !Array.isArray(x.orders) || !Array.isArray(x.ledger) || !Array.isArray(x.po) || !Array.isArray(x.ar) || !Array.isArray(x.returns) || !Array.isArray(x.projects) || !Array.isArray(x.training) || !Array.isArray(x.vacancy)) return false;
    for (const k of ["q", "sw", "cont", "baseSec", "stats", "fin", "deliv", "event", "mat", "mach", "cf", "eh", "clock", "scenario", "temps", "pm", "products", "rules", "pairs"]) if (!x[k] || typeof x[k] !== "object") return false;
    if (!PROCESSES.every((p) => Array.isArray(x.q[p.id]) && typeof x.sw[p.id] === "number" && typeof x.baseSec[p.id] === "number" && x.mach[p.id] && isFinite(x.mach[p.id].health))) return false;
    if (!x.workers.every((w) => PROCESSES.some((p) => p.id === w.proc) && isFinite(w.skill) && isFinite(w.fat))) return false;
    return [x.cash, x.bank, x.rng, x.clock.lastTs, x.clock.dayMs, x.mat.onhand].every(Number.isFinite);
  } catch { return false; }
}
export const exportSave = (s) => JSON.stringify(s);
export function importSave(text) { try { const x = migrate(JSON.parse(text)); return validate(x) ? { ok: true, state: x } : { ok: false, reason: "That doesn't look like a valid Factory DNA save." }; } catch { return { ok: false, reason: "Could not read that text as JSON." }; } }
export function save(s) { const t = exportSave(s); mem = t; try { localStorage.setItem(KEY, t); } catch {} }
export function load() { let t = null; try { t = localStorage.getItem(KEY); } catch {} t = t || mem; if (!t) return null; const r = importSave(t); return r.ok ? r.state : null; }
export function clear() { mem = null; try { localStorage.removeItem(KEY); } catch {} }
