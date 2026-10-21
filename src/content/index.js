// All game content/balance lives here. The engine reads it; components never hardcode rules.
export const CFG = {
  quarterDays: 60, shift: 8, otHours: 2, wage: 22, otPremium: 1.5, overhead: 750, startCash: 5000, startBank: 20,
  ordersPerDay: 3, releaseCap: 1500, wipCap: 1800, baseDefect: 0.045, defectPerSwLevel: 0.01, startCartons: 12000, cartonRefill: 5000,
  swCost: 12, trainCost: 10, ideaEH: 4,
  thresholds: { otd: 0.85, fpy: 0.96, engagement: 60, profit: 0, returnRate: 0.01 },
  // Phase 2
  dayMs: 600000, maxCatchUp: 5, arDays: 10, leadTime: 3, reorderPoint: 6500, poQty: 7000, cartonCost: 0.2, expediteCost: 350,
  tempWage: 18, tempPerf: 0.7, maxTemps: 4, baselineOTHours: 2, pmCost: 200, pmHours: 4, repairCost: 600, baseEscape: 0.008, rework: 0.6, reworkCost: 0.1,
  trainHours: 4, trainNeed: 4, trainCost: 120, pathCost: 8, pathMastery: 25, hireCost: 300, hireDays: 5, quitDays: 10, transferDays: 2, matTransferFee: 0.05, workTransferFee: 0.15, expandCost: 14000, expandSeed: 3000,
  contractPenalty: 0.05, returnPenaltyPerUnit: 0.5, reserve: 1000,
};
export const SEASONS = [{ name: "Medium", m: 1 }, { name: "Low", m: 0.8 }, { name: "Medium", m: 1 }, { name: "High", m: 1.3 }];
// Capital investments. `real` (realized share of the effect, 70-100%) is drawn from the seeded RNG at purchase: the benefit is NOT guaranteed.
export const INVESTMENTS = [{ id: "conv", name: "Pick-line conveyor", p: "pick", cost: 4000, sec: 9, install: 3, ramp: 5, opex: 20, life: 240,
  desc: "Shortens the walk to location by up to 9s per unit at Each Pick.", assumptions: "Installed after 3 days, ramps up over 5 days, realizes 70–100% of the 9s. Cash savings only appear if overtime/temps are actually avoided." }];
export const PROCESSES = [
  { id: "rcv", name: "Receiving", icon: "📥", machine: "Dock Scanner", gx: 0, gy: 0, home: 2 },
  { id: "pick", name: "Each Pick", icon: "🛒", machine: "Pick Cart Line", gx: 1, gy: 0, home: 2 },
  { id: "pack", name: "Pack", icon: "📦", machine: "Pack Bench", gx: 1, gy: 1, home: 2 },
  { id: "ship", name: "Ship", icon: "🚚", machine: "Dock Door", gx: 0, gy: 1, home: 2 },
];
// Work elements (ids and meanings carried over from the v2 prototype). sec = standard seconds per unit.
// va: VA / NNVA / NVA. cont = containment root cause; cost = Earned Hours to remove it.
export const ELEMENTS = [
  { id: "WE-0001", p: "rcv", name: "Scan PO label", sec: 6, va: "NNVA" },
  { id: "WE-0002", p: "rcv", name: "Unload & stage cartons", sec: 14, va: "NNVA" },
  { id: "WE-0003", p: "rcv", name: "Put to dock lane", sec: 8, va: "NNVA" },
  { id: "WE-0004", p: "rcv", name: "Re-check ASN mismatches", sec: 7, va: "NVA", cont: "Supplier Issue", cost: 14 },
  { id: "WE-0005", p: "pick", name: "Walk to location", sec: 18, va: "NVA" },
  { id: "WE-0006", p: "pick", name: "Scan location barcode", sec: 3, va: "NNVA" },
  { id: "WE-0007", p: "pick", name: "Pick item to tote", sec: 7, va: "NNVA" },
  { id: "WE-0008", p: "pick", name: "Scan item", sec: 3, va: "NNVA" },
  { id: "WE-0009", p: "pick", name: "Hunt for mislabeled bins", sec: 9, va: "NVA", cont: "Poor Slotting", cost: 18 },
  { id: "WE-0010", p: "pick", name: "Double-count error-prone SKUs", sec: 5, va: "NVA", cont: "Quality Issue", cost: 12 },
  { id: "WE-0011", p: "pack", name: "Build carton", sec: 8, va: "VA" },
  { id: "WE-0012", p: "pack", name: "Pack items", sec: 9, va: "VA" },
  { id: "WE-0013", p: "pack", name: "Apply shipping label", sec: 5, va: "NNVA" },
  { id: "WE-0014", p: "pack", name: "Re-tape weak cartons", sec: 4, va: "NVA", cont: "Supplier Issue", cost: 10 },
  { id: "WE-0015", p: "ship", name: "Stage to lane", sec: 7, va: "NNVA" },
  { id: "WE-0016", p: "ship", name: "Load trailer", sec: 9, va: "NNVA" },
  { id: "WE-0017", p: "ship", name: "Scan manifest", sec: 3, va: "NNVA" },
  { id: "WE-0018", p: "ship", name: "Re-key BOL by hand", sec: 6, va: "NVA", cont: "System Limitation", cost: 14 },
];
export const START_CONTAINMENT = ["WE-0004", "WE-0009", "WE-0010", "WE-0014", "WE-0018"];
// mult = how much longer this product takes at each process than the standard. Both active products share Pack and cartons.
export const PRODUCTS = [
  { id: "kit", name: "Starter Kit", icon: "🧰", active: true, price: 2.2, mat: 0.5, share: 0.7, qty: [340, 488], mult: { rcv: 1, pick: 1, pack: 1, ship: 1 } },
  { id: "bundle", name: "Custom Bundle", icon: "🎁", active: true, price: 5.5, mat: 1.2, share: 0.3, qty: [212, 340], mult: { rcv: 1.3, pick: 1.8, pack: 2, ship: 1.2 } },
  { id: "gift", name: "Seasonal Gift Set", icon: "🎀", active: false, price: 4.2, mat: 1.0, share: 0, qty: [150, 250], mult: { rcv: 1.2, pick: 1.5, pack: 1.7, ship: 1.1 } },
];
export const CUSTOMERS = ["Maple Home", "Brightway", "Corner Co-op", "Northwind", "Pebble & Pine"];
// Worker names, in order. One name per worker: ask the owner for more names before adding people.
export const NAMES = ["Dru", "Geoff", "Ronnie", "John", "Theo", "Reggie", "Dolan", "Harrison"];
export const EVENTS = [
  { id: "idea", tone: "good", t: "Operator Suggestion", d: "A picker's idea earns +4 Earned Hours.", w: 1 },
  { id: "audit", tone: "neutral", t: "Audit Scheduled", d: "A customer visit is coming. No impact today.", w: 1 },
  { id: "jam", tone: "bad", t: "Equipment Jam", d: "One area runs at 70% for the day.", w: 1.2, safeFromDay: 4 },
  { id: "delay", tone: "bad", t: "Supplier Delay", d: "The next carton delivery slips 2 days. Check material cover.", w: 0.8, safeFromDay: 6 },
  { id: "rush", tone: "bad", t: "Rush Order", d: "A rush order arrives, due in 2 days.", w: 0.8, safeFromDay: 4 },
];

// ---- Phase 3 content ----
export const PATHS = {
  specialist: { name: "Specialist", desc: "+8% pace at the home area, but −5% when working elsewhere." },
  flex: { name: "Flexible Operator", desc: "Smaller penalty away from home (cuts it by about half); −3% pace at home." },
  trainer: { name: "Trainer", desc: "Halves training time for a trainee in the same area and builds their experience; −3% own pace." },
  lead: { name: "Team Lead", desc: "+2% pace for teammates in the same area and steadier days; −2% own pace." },
};
// Projects: focused events (1 stage) and staged projects (review between stages). sec = standard seconds removed per unit at full realisation.
export const PROJECTS = [
  { id: "slot", name: "Re-slot fast movers (kaizen event)", p: "pick", sec: 4, crewHours: 3, stages: [{ name: "Event", days: 2, cost: 500, frac: 1 }], risk: "Realizes 60–100% of the 4s. Two people spend 3h/day on it, so Each Pick loses capacity for 2 days." },
  { id: "label", name: "Label station kaizen", p: "ship", sec: 3, crewHours: 3, stages: [{ name: "Event", days: 2, cost: 400, frac: 1 }], risk: "Realizes 60–100% of the 3s. Ship loses capacity for 2 days." },
  { id: "packline", name: "Pack line redesign (staged)", p: "pack", sec: 8, crewHours: 3, stages: [{ name: "Design", days: 2, cost: 800, frac: 0 }, { name: "Pilot", days: 3, cost: 600, frac: 0.4 }, { name: "Rollout", days: 3, cost: 1200, frac: 1 }], risk: "Realizes 60–100% of the 8s. Nothing changes until the pilot, and you review before each paid stage." },
];
export const CHAPTERS = [
  { id: 1, name: "Turnaround", goal: "Stabilize a troubled plant: all four minimums for one quarter.", thr: {}, rules: { delayW: 1, safeDay: 4 }, intro: "Each Pick is the obvious bottleneck." },
  { id: 2, name: "Growth", goal: "A third product is unlocked. Grow without losing delivery.", thr: { otd: 0.88 }, rules: { delayW: 1.5, safeDay: 4 }, intro: "Fixing Pick moves the pinch point. The Seasonal Gift Set is available once Pack has standard work and two Pack-capable people." },
  { id: 3, name: "Supply Squeeze", goal: "Supplier delays are frequent. Hold delivery and profit.", thr: { otd: 0.85, profit: 2000 }, rules: { delayW: 3, safeDay: 1 }, intro: "Watch carton cover and expedite wisely." },
  { id: 4, name: "Sandbox", goal: "Campaign complete. Keep running, expand, experiment.", thr: { otd: 0.8, profit: -5000 }, rules: { delayW: 1.5, safeDay: 4 }, intro: "No formal ending." },
];
export const SCENARIOS = [
  { id: "flow", name: "Flow Crunch", seed: 101, days: 30, startDay: 181, pausePolicy: "none",
    lesson: "Capacity and flow: it's peak season. Find the constraint, relieve it, and watch the next one appear.",
    rules: { ot: true, invest: false, temps: true, delayW: 1, safeDay: 4, demandMult: 0.88, thr: { otd: 0.7, fpy: 0.95, profit: 0 } }, fail: "Cash below −$3,000",
    setup: { cash: 40000, bank: 45 }, controls: "Overtime and temps allowed; capital investment locked; no pausing.",
    objectives: ["On-time delivery ≥ 70%", "Profit ≥ $0", "First-pass quality ≥ 95%"] },
  { id: "steady", name: "Steady Hands", seed: 202, days: 30, startDay: 1, pausePolicy: "none",
    lesson: "Quality and people: worn machines and tired, uneasy people. Overtime is locked, so recovery has to come from maintenance, training and fair assignments.",
    rules: { ot: false, invest: false, temps: true, delayW: 1, safeDay: 4, demandMult: 0.8, thr: { otd: 0.6, fpy: 0.965, returnRate: 0.008, engagement: 55, profit: -8000 } }, fail: "Two or more people resign",
    setup: { cash: 30000, bank: 40, health: { pick: 35, pack: 38, rcv: 50, ship: 55 }, fat: 40, trust: 35, morale: 45 }, controls: "Overtime locked; investment locked; no pausing.",
    objectives: ["First-pass quality ≥ 96.5% and returns ≤ 0.8%", "Engagement ≥ 55", "Fewer than 2 resignations", "Profit ≥ −$8,000"] },
];

// How much game time passes per real-world time while the app is closed. Chosen per save; challenges are locked to "standard".
export const RATES = {
  relaxed: { label: "Relaxed", dayMs: 1800000, desc: "1 game day = 30 real minutes" },
  standard: { label: "Standard", dayMs: 600000, desc: "1 game day = 10 real minutes" },
  fast: { label: "Fast", dayMs: 300000, desc: "1 game day = 5 real minutes" },
  manual: { label: "Manual only", dayMs: 600000, desc: "Nothing advances while you're away; use Next day / Week" },
};
