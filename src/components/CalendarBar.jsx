import { Calendar } from "lucide-react";

export default function CalendarBar({ day, week, month, quarter }) {
  const dayOfMonth = ((day - 1) % 30) + 1;
  let period = "Middle of Month";
  if (dayOfMonth <= 3) period = "Beginning of Month";
  if (dayOfMonth >= 28) period = "End of Month";
  const isQuarterEnd = month % 3 === 0 && dayOfMonth >= 28;
  if (isQuarterEnd) period = "End of Quarter";

  return (
    <div className="bg-white rounded-2xl shadow-sm px-5 py-3 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 text-stone-600 font-bold">
        <Calendar size={18} className="text-orange-400" />
        Day {day} · Week {week} · Month {month} · Q{quarter}
      </div>
      <span className="text-xs font-black uppercase tracking-wide px-3 py-1 rounded-full bg-orange-100 text-orange-600">
        {period}
      </span>
    </div>
  );
}
