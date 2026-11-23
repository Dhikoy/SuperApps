import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { ScheduleEditor } from "./ScheduleEditor";

export default async function JadwalPage() {
  const session = await getSession();
  if (!session) return null;
  requirePermission(session.role, "schedules:view");

  const canManage = hasPermission(session.role, "schedules:manage");

  const schedules = await prisma.workSchedule.findMany({
    orderBy: { shiftName: "asc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Jadwal Kerja</h1>
        <p className="text-gray-500 mt-1">
          {canManage
            ? "Kelola shift dan jam kerja standar (Super Admin & HRD)"
            : "Shift dan jam kerja standar karyawan"}
        </p>
      </div>

      {canManage ? (
        <ScheduleEditor key={schedules.map((s) => `${s.id}-${s.isActive}-${s.standardClockIn}`).join()} schedules={schedules} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {schedules.filter((s) => s.isActive).map((schedule) => (
            <div key={schedule.id} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🕐</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Aktif
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-lg">{schedule.shiftName}</h3>
              <div className="mt-3 flex gap-6 text-sm text-gray-600">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Masuk</p>
                  <p className="font-medium">{schedule.standardClockIn}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Pulang</p>
                  <p className="font-medium">{schedule.standardClockOut}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
