import { TrendingUp } from "lucide-react";

export default function HistoryStrip({ history }) {
  const recent = history.slice(-7);
  if (recent.length === 0) return null;
  const max = Math.max(...recent.map((h) => h.productivity), 100);
  return (
    <div className="bg-white rounded-3xl shadow-sm p-5">
      <div className="text-stone-600 font-bold mb-3 flex items-center gap-2">
        <TrendingUp size={18} className="text-orange-400" /> Last 7 Days — Productivity
      </div>
      <div className="flex items-end gap-2 h-24">
        {recent.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-lg ${h.productivity >= 100 ? "bg-emerald-400" : "bg-amber-400"}`}
              style={{ height: `${Math.max(6, (h.productivity / max) * 80)}px` }}
            />
            <span className="text-[9px] text-stone-400 font-bold">D{h.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
