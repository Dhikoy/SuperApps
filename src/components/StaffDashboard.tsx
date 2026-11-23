import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildStaffDashboardData } from "@/lib/staff-dashboard";
import { AttendanceMonthCalendar } from "@/components/AttendanceMonthCalendar";
import { ROLE_LABELS, hasPermission, canManageMomNotes, type Role } from "@/lib/roles";
import type { SessionUser } from "@/lib/auth";
import { MomDashboardList } from "@/components/MomDashboardList";
import { TodayAttendanceHero } from "@/components/TodayAttendanceHero";

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-stretch border-b border-slate-200">
        <div className="w-1.5 bg-[#503200] shrink-0" />
        <h2 className="px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[#503200]">
          {title}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm py-0.5">
      <span className="w-16 shrink-0 text-slate-500">{label}</span>
      <span className="text-slate-400">:</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

export async function StaffDashboard({ session }: { session: SessionUser }) {
  const data = await buildStaffDashboardData(session.nik);
  const canManage = hasPermission(session.role, "attendance:manage");
  const canClock = hasPermission(session.role, "attendance:clock");
  const canEditMom = canManageMomNotes(session.role);

  const momNotes = await prisma.momNote.findMany({
    include: { creator: { select: { name: true } } },
    orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
    take: 10,
  });

  const firstName = data.profile.name.split(" ")[0];
  const initials = data.profile.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  const currentLeave = data.leaveSummaries[0];

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Halo, {firstName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{ROLE_LABELS[session.role as Role]}</p>
        </div>
        <div className="hidden sm:flex flex-wrap gap-2">
          {canManage && (
            <Link
              href="/dashboard/presensi/laporan"
              className="inline-flex items-center justify-center rounded-lg border border-[#503200] px-4 py-2 text-sm font-semibold text-[#503200] hover:bg-[#503200]/5 transition-colors"
            >
              Laporan Presensi
            </Link>
          )}
          <Link
            href="/dashboard/cuti/ajukan"
            className="inline-flex items-center justify-center rounded-lg bg-[#503200] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3d2600] transition-colors"
          >
            Ajukan Izin/Cuti
          </Link>
        </div>
      </div>

      {canClock && <TodayAttendanceHero nik={session.nik} />}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Link href="/dashboard/cuti" className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm active:scale-[0.98] transition-transform">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500">Sisa cuti</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{currentLeave?.remainingAnnual ?? "-"}</p>
          <p className="text-[11px] text-slate-400">hari</p>
        </Link>
        <Link href="/dashboard/profil" className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm active:scale-[0.98] transition-transform">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500">Terlambat</p>
          <p className={`mt-1 text-2xl font-bold ${data.lateThisMonth > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {data.lateThisMonth}
          </p>
          <p className="text-[11px] text-slate-400">kali bulan ini</p>
        </Link>
        <Link href="/dashboard/profil#slip-gaji" className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm active:scale-[0.98] transition-transform">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500">Slip gaji</p>
          <p className="mt-1 text-2xl" aria-hidden>📄</p>
          <p className="text-[11px] text-slate-400">lihat slip</p>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <Link
          href="/dashboard/cuti/ajukan"
          className="flex items-center justify-center rounded-xl border border-[#503200]/30 bg-white py-3 text-sm font-semibold text-[#503200]"
        >
          Ajukan Izin/Cuti
        </Link>
        <Link
          href={canManage ? "/dashboard/presensi/laporan" : "/dashboard/task"}
          className="flex items-center justify-center rounded-xl border border-[#503200]/30 bg-white py-3 text-sm font-semibold text-[#503200]"
        >
          {canManage ? "Laporan Presensi" : "Task Saya"}
        </Link>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-4">
          <SectionCard title="Profil Saya">
            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="h-16 w-16 rounded-full bg-[#503200] flex items-center justify-center text-xl font-bold text-white">
                  {initials || "?"}
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <ProfileRow label="NIK" value={data.profile.nik} />
                <ProfileRow label="Nama" value={data.profile.name} />
                <ProfileRow label="Divisi" value={data.profile.department ?? "-"} />
                <ProfileRow label="Jabatan" value={data.profile.jobTitle ?? "-"} />
                <ProfileRow label="Status" value={data.profile.status} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Pelanggaran">
            {data.violations.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Tidak ada pelanggaran</p>
            ) : (
              <ul className="space-y-2">
                {data.violations.map((v, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{v.date}</span>
                    <span className="font-medium text-orange-700">{v.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-8">
          <SectionCard title="Kehadiran & Cuti">
            {data.calendars.map((cal) => (
              <AttendanceMonthCalendar
                key={`${cal.year}-${cal.month}`}
                year={cal.year}
                month={cal.month}
                days={cal.days}
              />
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2 pt-4 border-t border-slate-200">
              {data.leaveSummaries.map((summary) => (
                <div key={summary.year}>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Izin {summary.year}</p>
                  <p className="text-3xl font-bold text-slate-900 mb-3">
                    {summary.totalUsed}{" "}
                    <span className="text-base font-normal text-slate-500">Total</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                      sisa cuti {summary.year}
                    </span>
                    <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded bg-[#503200] px-2 py-1 text-sm font-bold text-white">
                      {summary.remainingAnnual}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <Link
                href="/dashboard/cuti"
                className="inline-flex items-center justify-center rounded bg-[#503200] px-6 py-2 text-sm font-semibold text-white hover:bg-[#3d2600] transition-colors"
              >
                Riwayat Izin & Cuti
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Catatan MOM">
        <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
          <Link
            href="/dashboard/information/struktur"
            className="text-xs font-semibold text-[#503200] hover:underline"
          >
            Struktur Role
          </Link>
          <Link
            href="/dashboard/information/mom"
            className="inline-flex items-center rounded bg-[#503200] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3d2600]"
          >
            + Tambah catatan
          </Link>
        </div>

        <MomDashboardList
          canManage={canEditMom}
          notes={momNotes.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            meetingDate: n.meetingDate.toISOString(),
            creatorName: n.creator.name,
          }))}
        />
      </SectionCard>
    </div>
  );
}
