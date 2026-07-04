import { Users } from "lucide-react";

export default function WorkerPanel({ workers, machines, onAssign }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3 text-stone-600 font-bold">
        <Users size={18} className="text-orange-400" /> Team
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {workers.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-2 bg-stone-50 rounded-xl px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-700 truncate">{w.name}</div>
              <div className="text-[10px] text-stone-400 flex gap-2">
                <span>Skill {Math.round(w.skill)}</span>
                <span>Effort {Math.round(w.effort)}</span>
                <span className={w.morale < 40 ? "text-rose-400" : ""}>Morale {Math.round(w.morale)}</span>
              </div>
            </div>
            <select
              value={w.assignedMachine || ""}
              onChange={(e) => onAssign(w.id, e.target.value || null)}
              className="text-xs font-semibold bg-white border border-stone-200 rounded-lg px-2 py-1"
            >
              <option value="">Unassigned</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
