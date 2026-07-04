const TONES = {
  good: "bg-emerald-50 text-emerald-700",
  bad: "bg-rose-50 text-rose-700",
  neutral: "bg-sky-50 text-sky-700",
  warn: "bg-amber-50 text-amber-700",
};

export default function StatPill({ icon: Icon, label, value, tone = "neutral" }) {
  return (
    <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${TONES[tone]}`}>
      <Icon size={20} />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</div>
        <div className="text-lg font-black leading-tight">{value}</div>
      </div>
    </div>
  );
}
