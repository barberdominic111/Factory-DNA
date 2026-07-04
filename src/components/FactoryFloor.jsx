// Animation keyframes/classes (.conveyor-belt, .machine-active .gear,
// .worker-bob) live in src/index.css so they load once globally.

export default function FactoryFloor({ machines, workers }) {
  return (
    <div className="bg-gradient-to-b from-sky-50 to-white rounded-3xl p-5 shadow-inner relative overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 relative z-10">
        {machines.map((m) => {
          const worker = workers.find((w) => w.assignedMachine === m.id);
          const active = m.status === "running";
          const broken = m.status === "broken";
          return (
            <div
              key={m.id}
              className={`rounded-2xl p-3 border-2 transition-colors ${
                broken
                  ? "border-rose-300 bg-rose-50"
                  : active
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-stone-200 bg-white"
              } ${active ? "machine-active" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xl gear inline-block">{m.icon}</span>
                {worker && <span className="text-xl worker-bob">🧑‍🔧</span>}
              </div>
              <div className="text-xs font-bold text-stone-600 truncate">{m.name}</div>
              <div className="text-[10px] text-stone-400 mb-1">{worker ? worker.name : "Unstaffed"}</div>
              <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${broken ? "bg-rose-400" : "bg-emerald-400"}`}
                  style={{ width: `${m.progress || (broken ? 15 : 0)}%` }}
                />
              </div>
              {broken && <div className="text-[10px] font-bold text-rose-500 mt-1">⚠ down</div>}
            </div>
          );
        })}
      </div>
      <div className="conveyor-belt mt-5" />
    </div>
  );
}
