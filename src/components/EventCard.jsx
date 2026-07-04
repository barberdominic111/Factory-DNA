import { CheckCircle2, Info, AlertTriangle } from "lucide-react";

const STYLES = {
  positive: { bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2 },
  neutral: { bg: "bg-sky-50", text: "text-sky-700", Icon: Info },
  negative: { bg: "bg-rose-50", text: "text-rose-700", Icon: AlertTriangle },
};

export default function EventCard({ event }) {
  if (!event) return null;
  const s = STYLES[event.tone];
  return (
    <div className={`rounded-2xl p-4 ${s.bg} flex items-start gap-3`}>
      <s.Icon className={s.text} size={22} />
      <div>
        <div className={`font-bold ${s.text}`}>{event.title}</div>
        <div className="text-sm text-stone-600">{event.desc}</div>
        <div className={`text-[10px] font-black uppercase tracking-wide mt-1 ${s.text}`}>{event.tag}</div>
      </div>
    </div>
  );
}
