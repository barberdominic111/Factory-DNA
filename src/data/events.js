// Random daily events. `tone` drives styling; `id` is consumed by
// engine/simulate.js to apply a concrete gameplay effect. Add new events here
// and handle their `id` in simulateDay() to extend the pool.

export const EVENT_POOL = [
  { id: "op_suggestion", tone: "positive", title: "Operator Suggestion", desc: "An operator suggests a small tweak that saves setup time today.", tag: "+ efficiency" },
  { id: "supplier_early", tone: "positive", title: "Supplier Shipped Early", desc: "A key shipment arrived ahead of schedule. Inventory risk is lower today.", tag: "+ inventory" },
  { id: "machine_exceptional", tone: "positive", title: "Machine Running Great", desc: "One machine is performing above spec today.", tag: "+ machine efficiency" },
  { id: "forecast_up", tone: "positive", title: "Customer Increases Forecast", desc: "A customer just raised their forecast — good news, more demand ahead.", tag: "+ future demand" },
  { id: "ci_success", tone: "positive", title: "Improvement Success", desc: "A continuous improvement idea paid off. Standard work improves slightly.", tag: "+ standard work" },
  { id: "eng_revision", tone: "neutral", title: "Engineering Revision", desc: "A drawing revision came through. No major impact, just paperwork.", tag: "neutral" },
  { id: "new_employee", tone: "neutral", title: "New Employee Starting", desc: "A new hire joins the floor soon — they'll need ramp-up time.", tag: "neutral" },
  { id: "packaging_change", tone: "neutral", title: "Packaging Change", desc: "A customer changed their packaging spec. Minor adjustment needed.", tag: "neutral" },
  { id: "audit", tone: "neutral", title: "Audit Scheduled", desc: "A customer audit is scheduled for next week. Keep things tidy.", tag: "neutral" },
  { id: "breakdown", tone: "negative", title: "Machine Breakdown", desc: "A machine went down unexpectedly. It'll run at reduced availability today.", tag: "− machine availability" },
  { id: "absent", tone: "negative", title: "Operator Absent", desc: "One of your operators called out today.", tag: "− staffing" },
  { id: "shortage", tone: "negative", title: "Material Shortage", desc: "A key material is short. Some machines may starve for parts.", tag: "− throughput" },
  { id: "quality_issue", tone: "negative", title: "Quality Issue", desc: "A quality escape was caught on the line. Rework is needed.", tag: "− quality" },
  { id: "rush_order", tone: "negative", title: "Rush Order", desc: "A customer needs an order expedited. It'll strain today's schedule.", tag: "− schedule slack" },
  { id: "power_outage", tone: "negative", title: "Power Outage", desc: "A brief power outage stopped the line for part of the day.", tag: "− availability, all machines" },
];

export function rollEvent(rng) {
  return EVENT_POOL[Math.floor(rng() * EVENT_POOL.length)];
}
