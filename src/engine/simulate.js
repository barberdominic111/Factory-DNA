import { clamp, makeRng } from "./generate.js";

// Pure function: given today's workers/machines/dna/event/improvements,
// compute results. Does not mutate inputs — callers apply the returned
// deltas to their own state (see App.jsx's runSimulation).
export function simulateDay({ workers, machines, dna, event, improvements, rngSeed }) {
  const rng = makeRng(rngSeed ?? (Math.floor(Math.random() * 1e9) || 1));

  let totalBudgetHours = 0;
  let totalActualHours = 0;
  let unitsGood = 0;
  let unitsScrap = 0;
  const machineResults = [];
  const workerResults = [];

  const standardWorkBonus = (improvements.standardWork || 0) * 0.01;
  const pmBonus = improvements.pm || 0;
  const crossTrainBonus = improvements.crossTrain || 0;
  const fixturesBonus = improvements.fixtures || 0;
  const automationBonus = improvements.automation || 0;

  const slowestId = [...machines].sort((a, b) => a.efficiency - b.efficiency)[0]?.id;
  // pre-pick which single machine (if any) suffers the scripted "breakdown" event,
  // rather than re-rolling per machine in the loop.
  const scriptedBreakdownId =
    event?.id === "breakdown" ? machines[Math.floor(rng() * machines.length)]?.id : null;

  machines.forEach((m) => {
    const worker = workers.find((w) => w.assignedMachine === m.id && w.present);
    let availability = m.availability + pmBonus;
    let efficiency = m.efficiency + (m.id === slowestId ? automationBonus : 0);
    let setupTime = Math.max(2, m.setupTimeSec * (1 - fixturesBonus * 0.01));
    let breakdownRisk = Math.max(2, m.breakdownRisk * (1 - pmBonus * 0.02));
    let downToday = false;

    if (m.id === scriptedBreakdownId) {
      availability -= 35;
      downToday = true;
    }
    if (event?.id === "power_outage") availability -= 20;
    if (event?.id === "machine_exceptional" && rng() < 0.4) efficiency += 15;

    // independent random breakdown roll
    if (rng() * 100 < breakdownRisk * 0.15) {
      availability -= 20;
      downToday = true;
    }

    availability = clamp(availability, 5, 100);
    efficiency = clamp(efficiency, 10, 100);

    const budgetHours = 8; // standard shift budget per machine-slot
    totalBudgetHours += budgetHours;

    if (!worker) {
      machineResults.push({ ...m, availability, efficiency, downToday, status: "idle", progress: 0, unitsGood: 0 });
      return;
    }

    const skillFactor = 0.4 + (worker.skill / 100) * 0.4;
    const effortFactor = 0.7 + (worker.effort / 100) * 0.3;
    const crossFactor = 0.9 + ((worker.crossTraining + crossTrainBonus) / 100) * 0.15;
    const fatiguePenalty = 1 - worker.fatigue / 200;
    const moralePenalty = 0.85 + (worker.morale / 100) * 0.15;

    const materialShortage = event?.id === "shortage" ? 0.75 : 1;
    const qualityHit = event?.id === "quality_issue" ? 0.85 : 1;
    const rushPressure = event?.id === "rush_order" ? 1.1 : 1;
    const ciBonus = event?.id === "ci_success" ? 1.08 : 1;

    const rate =
      skillFactor *
      effortFactor *
      crossFactor *
      fatiguePenalty *
      moralePenalty *
      (availability / 100) *
      (efficiency / 100) *
      materialShortage *
      rushPressure *
      ciBonus *
      (1 + standardWorkBonus);

    const cyclesPossible = (budgetHours * 3600) / ((m.cycleTimeSec || 30) + setupTime);
    const unitsAttempted = Math.round(cyclesPossible * rate);
    const qualityRate = clamp((m.qualityRate + standardWorkBonus * 100) * qualityHit, 40, 99.5) / 100;
    const good = Math.round(unitsAttempted * qualityRate);
    const scrap = unitsAttempted - good;

    const actualHours = budgetHours / Math.max(rate, 0.15);
    totalActualHours += Math.min(actualHours, budgetHours * 1.6);
    unitsGood += good;
    unitsScrap += scrap;

    machineResults.push({
      ...m,
      availability,
      efficiency,
      downToday,
      status: downToday ? "broken" : "running",
      progress: clamp(rate * 100, 5, 100),
      unitsGood: good,
    });

    workerResults.push({
      id: worker.id,
      fatigueDelta: 6 + (rushPressure > 1 ? 3 : 0),
      moraleDelta: downToday ? -4 : rng() < 0.3 ? 2 : 0,
    });
  });

  if (event?.id === "absent" && workers.length) {
    const absentWorker = workers[Math.floor(rng() * workers.length)];
    workerResults.push({ id: absentWorker.id, forcedAbsent: true, fatigueDelta: 0, moraleDelta: 0 });
  }

  const earnedHours = Math.max(0, totalBudgetHours - totalActualHours);
  const productivity =
    totalActualHours > 0 ? clamp((totalBudgetHours / totalActualHours) * 100, 20, 200) : 100;
  const customerSat = clamp(
    70 + (earnedHours - 5) * 1.5 + (event?.tone === "negative" ? -6 : event?.tone === "positive" ? 4 : 0)
  );
  const moraleAvg = clamp(
    workers.reduce((s, w) => s + w.morale, 0) / Math.max(workers.length, 1) +
      (event?.tone === "negative" ? -2 : 1)
  );

  return {
    machineResults,
    workerResults,
    totalBudgetHours: Math.round(totalBudgetHours),
    totalActualHours: Math.round(totalActualHours),
    earnedHours: Math.round(earnedHours * 10) / 10,
    productivity: Math.round(productivity),
    unitsGood,
    unitsScrap,
    customerSat: Math.round(customerSat),
    moraleAvg: Math.round(moraleAvg),
  };
}
