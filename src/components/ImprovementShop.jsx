import { TrendingUp } from "lucide-react";
import { IMPROVEMENTS } from "../data/improvements.js";

export default function ImprovementShop({ earnedBank, purchased, onBuy }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1 text-stone-600 font-bold">
        <TrendingUp size={18} className="text-orange-400" /> Improvement Shop
      </div>
      <div className="text-xs text-stone-400 mb-3">
        Earned Hours Bank: <span className="font-black text-orange-500">{Math.round(earnedBank)}</span>
      </div>
      <div className="space-y-2">
        {IMPROVEMENTS.map((imp) => {
          const Icon = imp.icon;
          const owned = purchased[imp.key] || 0;
          const afford = earnedBank >= imp.cost;
          return (
            <button
              key={imp.key}
              disabled={!afford}
              onClick={() => onBuy(imp.key, imp.cost)}
              className={`w-full text-left rounded-xl px-3 py-2 flex items-center gap-3 transition-colors ${
                afford ? "bg-stone-50 hover:bg-orange-50" : "bg-stone-50 opacity-50 cursor-not-allowed"
              }`}
            >
              <Icon size={18} className={imp.color} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-stone-700 flex justify-between">
                  {imp.label} {owned > 0 && <span className="text-[10px] text-teal-500">x{owned}</span>}
                </div>
                <div className="text-[10px] text-stone-400">{imp.desc}</div>
              </div>
              <div className="text-xs font-black text-orange-500">{imp.cost}h</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
