import { Smile, Meh, Gauge, Clock, Package, AlertTriangle, HeartHandshake, ChevronRight } from "lucide-react";
import StatPill from "./StatPill.jsx";

export default function ResultsModal({ results, onNext }) {
  if (!results) return null;
  const good = results.productivity >= 100;
  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center gap-2 mb-4">
          {good ? <Smile className="text-emerald-500" size={26} /> : <Meh className="text-amber-500" size={26} />}
          <h2 className="text-xl font-black text-stone-700">Day Results</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatPill icon={Gauge} label="Productivity" value={`${results.productivity}%`} tone={results.productivity >= 100 ? "good" : "warn"} />
          <StatPill icon={Clock} label="Earned Hours" value={results.earnedHours} tone={results.earnedHours > 0 ? "good" : "neutral"} />
          <StatPill icon={Package} label="Good Units" value={results.unitsGood} tone="neutral" />
          <StatPill icon={AlertTriangle} label="Scrap" value={results.unitsScrap} tone={results.unitsScrap > 20 ? "bad" : "neutral"} />
          <StatPill icon={Smile} label="Cust. Satisfaction" value={`${results.customerSat}%`} tone={results.customerSat >= 70 ? "good" : "warn"} />
          <StatPill icon={HeartHandshake} label="Morale" value={`${results.moraleAvg}%`} tone={results.moraleAvg >= 60 ? "good" : "warn"} />
        </div>
        <button
          onClick={onNext}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2"
        >
          Next Day <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
