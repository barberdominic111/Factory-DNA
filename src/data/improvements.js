import { HeartHandshake, ShieldCheck, CheckCircle2, Zap, Wrench } from "lucide-react";

// Earned Hours are spent here. `key` must match the field engine/simulate.js
// reads from the `improvements` object (see simulateDay).
export const IMPROVEMENTS = [
  { key: "crossTrain", label: "Cross Training", icon: HeartHandshake, cost: 25, desc: "+3 cross-training across the team", color: "text-teal-600" },
  { key: "pm", label: "Preventive Maintenance", icon: ShieldCheck, cost: 30, desc: "+5 availability, -10% breakdown risk on all machines", color: "text-sky-600" },
  { key: "standardWork", label: "Standard Work", icon: CheckCircle2, cost: 20, desc: "+4 standard work quality baseline", color: "text-emerald-600" },
  { key: "automation", label: "Automation Upgrade", icon: Zap, cost: 45, desc: "+6 efficiency on your slowest machine", color: "text-amber-600" },
  { key: "fixtures", label: "Fixtures & Tooling", icon: Wrench, cost: 18, desc: "-8% setup time on all machines", color: "text-orange-600" },
];
