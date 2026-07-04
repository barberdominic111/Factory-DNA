import { useMemo } from "react";
import { Factory, Sparkles, ArrowRight } from "lucide-react";
import { DNA_DIMENSIONS } from "../data/dna.js";
import { FACTORY_PROFILES } from "../data/presets.js";
import SliderRow from "./SliderRow.jsx";

export default function DNASetupScreen({ dna, setDna, onStart }) {
  const groups = useMemo(() => {
    const g = {};
    DNA_DIMENSIONS.forEach((d) => {
      g[d.group] = g[d.group] || [];
      g[d.group].push(d);
    });
    return g;
  }, []);

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center py-10 px-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-14 h-14 rounded-2xl bg-orange-400 flex items-center justify-center shadow-lg shadow-orange-200 rotate-3">
          <Factory className="text-white" size={30} />
        </div>
        <h1 className="text-4xl font-black text-stone-700 tracking-tight">Factory DNA</h1>
      </div>
      <p className="text-stone-500 mb-8 text-sm font-medium">A cozy manufacturing management simulator</p>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl shadow-orange-100 p-6 mb-6">
        <p className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" /> Quick-start profiles
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.keys(FACTORY_PROFILES).map((name) => (
            <button
              key={name}
              onClick={() => setDna(FACTORY_PROFILES[name])}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors text-left"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl shadow-orange-100 p-6 space-y-6">
        {Object.entries(groups).map(([groupName, dims]) => (
          <div key={groupName}>
            <p className="text-xs font-black uppercase tracking-widest text-orange-400 mb-3">{groupName}</p>
            {dims.map((dim) => (
              <SliderRow
                key={dim.key}
                dim={dim}
                value={dna[dim.key]}
                onChange={(k, v) => setDna((d) => ({ ...d, [k]: v }))}
              />
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="mt-8 bg-orange-500 hover:bg-orange-600 transition-colors text-white font-bold text-lg px-8 py-3 rounded-2xl shadow-lg shadow-orange-200 flex items-center gap-2"
      >
        Inherit This Factory <ArrowRight size={20} />
      </button>
    </div>
  );
}
