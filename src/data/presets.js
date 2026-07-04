// Quick-start factory profiles. Each simply preloads the Factory DNA sliders;
// players can customize everything afterward.

export const FACTORY_PROFILES = {
  "Injection Molding": { mix: 35, volume: 70, batchSize: 65, orderType: 60, skill: 45, crossTrain: 40, effort: 55, standardWork: 50, equipment: 55, supplyChain: 55, demand: 45 },
  "High Mix Assembly": { mix: 85, volume: 30, batchSize: 25, orderType: 30, skill: 60, crossTrain: 70, effort: 60, standardWork: 45, equipment: 40, supplyChain: 45, demand: 60 },
  "CNC Machine Shop": { mix: 70, volume: 35, batchSize: 30, orderType: 25, skill: 75, crossTrain: 45, effort: 60, standardWork: 55, equipment: 35, supplyChain: 50, demand: 55 },
  "Distribution Center": { mix: 60, volume: 85, batchSize: 55, orderType: 90, skill: 30, crossTrain: 55, effort: 50, standardWork: 60, equipment: 60, supplyChain: 65, demand: 70 },
  "Food Manufacturing": { mix: 40, volume: 80, batchSize: 75, orderType: 85, skill: 35, crossTrain: 50, effort: 55, standardWork: 65, equipment: 50, supplyChain: 60, demand: 50 },
  "Metal Fabrication": { mix: 65, volume: 45, batchSize: 40, orderType: 35, skill: 65, crossTrain: 35, effort: 55, standardWork: 40, equipment: 30, supplyChain: 40, demand: 55 },
};

export const FIRST_NAMES = ["Maya", "Theo", "Priya", "Deshawn", "Lin", "Oskar", "Fatima", "Nate", "Ceci", "Marcus", "Ines", "Owen"];

export const MACHINE_TYPES = [
  { name: "Press Line A", icon: "⚙️" },
  { name: "CNC Cell 2", icon: "🛠️" },
  { name: "Assembly Station", icon: "🔩" },
  { name: "Packaging Unit", icon: "📦" },
  { name: "Weld Cell", icon: "🔧" },
];
