import { FIRST_NAMES, MACHINE_TYPES } from "../data/presets.js";

export function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

// Simple seedable RNG so a given seed always produces the same factory —
// useful later for daily challenges / shared seeds.
export function makeRng(seed = Math.floor(Math.random() * 1e9) || 1) {
  let s = seed;
  return function rng() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function generateWorkers(dna, rng, count = 6) {
  const names = [...FIRST_NAMES].sort(() => rng() - 0.5).slice(0, count);
  return names.map((name, i) => {
    const variance = 25;
    return {
      id: `w${i}`,
      name,
      skill: clamp(dna.skill + (rng() - 0.5) * variance),
      effort: clamp(dna.effort + (rng() - 0.5) * variance),
      reliability: clamp(60 + (rng() - 0.5) * 40),
      experience: clamp(40 + (rng() - 0.5) * 40),
      learningSpeed: clamp(50 + (rng() - 0.5) * 40),
      crossTraining: clamp(dna.crossTrain + (rng() - 0.5) * variance),
      attitude: clamp(60 + (rng() - 0.5) * 40),
      fatigue: 0,
      morale: clamp(70 + (rng() - 0.5) * 20),
      assignedMachine: null,
      present: true,
    };
  });
}

export function generateMachines(dna, rng) {
  const reliabilityBase = dna.equipment; // higher = more automated/reliable
  return MACHINE_TYPES.map((m, i) => ({
    id: `m${i}`,
    name: m.name,
    icon: m.icon,
    availability: clamp(70 + (rng() - 0.5) * 20),
    efficiency: clamp(55 + reliabilityBase * 0.3 + (rng() - 0.5) * 20),
    pmStatus: clamp(60 + (rng() - 0.5) * 30),
    breakdownRisk: clamp(35 - reliabilityBase * 0.25 + (rng() - 0.5) * 10, 5, 60),
    cycleTimeSec: Math.round(20 + rng() * 40),
    setupTimeSec: Math.round(5 + rng() * 15),
    qualityRate: clamp(85 + (rng() - 0.5) * 15, 60, 99),
    status: "idle", // idle | running | broken
    progress: 0,
    assignedWorkerId: null,
    downToday: false,
  }));
}
