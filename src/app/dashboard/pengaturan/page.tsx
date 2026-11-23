import { getSession } from "@/lib/auth";
import { requirePermission, PageHeader, Card } from "@/components/ui";
import { ROLE_LABELS, canManageHrSettings, hasAnyPermission, type Role } from "@/lib/roles";
import { LeaveTypesSettings } from "@/components/LeaveTypesSettings";
import { OfficeLocationsSettings } from "@/components/OfficeLocationsSettings";
import { CompanyPresensiSettings } from "@/components/CompanyPresensiSettings";
import { AttendanceSyncSettings } from "@/components/AttendanceSyncSettings";
import { AuditLogPanel } from "@/components/AuditLogPanel";

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: "Akses penuh sistem, kelola semua modul, jadwal, dan pengaturan",
  ADMIN: "Kelola karyawan, aset, task, payroll, keuangan, dan approve cuti tahap atasan",
  DIREKSI: "View dashboard, approve cuti tahap atasan, lihat laporan",
  HRD: "Kelola karyawan, cuti, presensi, jadwal kerja, dan pengaturan HR",
  KEUANGAN: "Payroll, pengajuan dana, pembayaran, realisasi, cash flow, dan presensi",
  LEAD: "Berikan task ke tim, approve cuti/izin bawahan, clock in presensi",
  STAFF: "Clock in presensi dengan selfie, ajukan cuti/izin, lihat task pribadi",
  IT: "Staff MKTECH — akses semua modul seperti Super Admin, kecuali gaji karyawan",
};

export default async function PengaturanPage() {
  const session = await getSession();
  if (!session) return null;

  const canSettings = hasAnyPermission(session.role, ["settings:manage"]);
  const canHrConfig = canManageHrSettings(session.role);

  if (!canHrConfig) {
    requirePermission(session.role, "settings:manage");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Sistem"
        subtitle="Konfigurasi presensi, cuti, dan hak akses"
      />

      {canSettings && (
      <Card className="overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Level Role & Permission</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
            <div
              key={role}
              className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <p className="font-medium text-slate-900">{ROLE_LABELS[role]}</p>
                <p className="text-sm text-slate-500 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
              <span className="self-start sm:self-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-600">
                {role}
              </span>
            </div>
          ))}
        </div>
      </Card>
      )}

      {canHrConfig && (
      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Jenis Cuti / Izin</h2>
        <p className="text-sm text-slate-500">Tambah jenis cuti baru kapan saja. Atur apakah perlu approval atasan.</p>
        <LeaveTypesSettings />
      </Card>
      )}

      {canHrConfig && (
      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Lokasi Kantor (Geofence 100m)</h2>
        <p className="text-sm text-slate-500">Presensi hanya valid dalam radius kantor. Koordinat bisa disesuaikan via Google Maps.</p>
        <OfficeLocationsSettings />
      </Card>
      )}

      {canHrConfig && (
      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Presensi per PT</h2>
        <p className="text-sm text-slate-500">
          Kantor, shift jam masuk, dan target hari kerja per perusahaan — semua karyawan PT yang sama otomatis mengikuti.
        </p>
        <CompanyPresensiSettings />
      </Card>
      )}

      {canHrConfig && (
      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Sync Presensi (Cuti & ALPHA)</h2>
        <AttendanceSyncSettings />
      </Card>
      )}

      {canSettings && (
      <Card className="p-5 sm:p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Audit Log</h2>
        <p className="text-sm text-slate-500">Riwayat aksi sensitif: login, approve, export, hapus data</p>
        <AuditLogPanel />
      </Card>
      )}
    </div>
  );
}
