// Factory DNA dimensions. Each slider runs 0-100 and changes gameplay
// mechanics (not just difficulty) — see engine/simulate.js and engine/generate.js
// for how each key is consumed.

export const DNA_DIMENSIONS = [
  { key: "mix", group: "Production", left: "Low Mix", right: "High Mix" },
  { key: "volume", group: "Production", left: "Low Volume", right: "High Volume" },
  { key: "batchSize", group: "Production", left: "Small Batch", right: "Large Batch" },
  { key: "orderType", group: "Production", left: "Engineer to Order", right: "Make to Stock" },
  { key: "skill", group: "Workforce", left: "Entry Level", right: "Highly Skilled" },
  { key: "crossTrain", group: "Workforce", left: "Low Cross Training", right: "Highly Cross Trained" },
  { key: "effort", group: "Workforce", left: "Low Effort", right: "High Effort" },
  { key: "standardWork", group: "Workforce", left: "Poor Standard Work", right: "Excellent Standard Work" },
  { key: "equipment", group: "Equipment", left: "Frequent Breakdowns", right: "High Automation" },
  { key: "supplyChain", group: "Supply Chain", left: "Variable Suppliers", right: "Reliable Suppliers" },
  { key: "demand", group: "Customer Demand", left: "Stable Demand", right: "Highly Variable / Rush Heavy" },
];

export const DEFAULT_DNA = Object.fromEntries(DNA_DIMENSIONS.map((d) => [d.key, 50]));
