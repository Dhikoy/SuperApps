import { MONTHS_ID } from "@/lib/period";
import { jakartaWeekday } from "@/lib/workdays";
import type { AttendanceDay } from "@/lib/staff-dashboard";

const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

type Props = {
  year: number;
  month: number;
  days: Record<number, AttendanceDay>;
};

export function AttendanceMonthCalendar({ year, month, days }: Props) {
  const lastDay = new Date(year, month, 0).getDate();
  const firstWeekday = jakartaWeekday(
    new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00+07:00`)
  );

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-center text-sm font-semibold text-slate-800 mb-2">
        {MONTHS_ID[month - 1]} {year}
      </h3>
      <div className="grid grid-cols-7 border border-slate-300 text-center text-xs">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`border-b border-r border-slate-300 py-1.5 font-medium ${
              i === 0 || i === 6 ? "bg-slate-100 text-slate-600" : "bg-white text-slate-700"
            }`}
          >
            {day}
          </div>
        ))}
        {cells.map((day, idx) => {
          const weekday = idx % 7;
          const isWeekend = weekday === 0 || weekday === 6;
          const data = day ? days[day] : null;

          return (
            <div
              key={idx}
              className={`relative min-h-[52px] border-b border-r border-slate-300 p-1 ${
                isWeekend ? "bg-slate-50" : "bg-white"
              }`}
            >
              {day && (
                <>
                  <span className="absolute left-1 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#503200] text-[10px] font-bold text-white">
                    {day}
                  </span>
                  {data?.clockIn && (
                    <div className="mt-5 leading-tight text-[10px] text-slate-700 font-mono">
                      <div>{data.clockIn}</div>
                      {data.clockOut && <div>-{data.clockOut}</div>}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
