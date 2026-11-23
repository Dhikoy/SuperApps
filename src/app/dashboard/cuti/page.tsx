import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  PageHeader,
  StatusBadge,
  AlertBanner,
  EmptyState,
  DataTable,
  TableHeader,
  TableCell,
} from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { getApprovalFlowLabel } from "@/lib/leave";
import { safeLeaveRequestsAll } from "@/lib/safe-db";
import { RichTextView } from "@/components/RichTextView";

export default async function CutiPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role, "leave:view")) redirect("/dashboard");

  const canSeeAll =
    hasPermission(session.role, "leave:manage") ||
    hasPermission(session.role, "leave:approve_atasan") ||
    hasPermission(session.role, "leave:approve_hrd");

  const requests = await safeLeaveRequestsAll(canSeeAll ? undefined : session.id);
  const dbError = requests === null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cuti & Izin"
        subtitle={canSeeAll ? "Semua pengajuan cuti karyawan" : "Riwayat pengajuan cuti Anda"}
        badge={dbError ? undefined : `${requests?.length ?? 0} pengajuan`}
      />

      {dbError && (
        <AlertBanner variant="warning">
          Data cuti belum bisa dimuat. Restart server dev lalu jalankan:{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">npx prisma generate</code>
          dan{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">npm run db:seed</code>
        </AlertBanner>
      )}

      {!dbError && requests!.length === 0 ? (
        <EmptyState
          icon="📅"
          title="Belum ada pengajuan"
          description="Pengajuan cuti atau izin akan muncul di sini."
        />
      ) : !dbError ? (
        <DataTable>
          <table className="w-full table-responsive">
            <TableHeader>
              {canSeeAll && <th className="px-4 sm:px-6 py-3.5">Karyawan</th>}
              <th className="px-4 sm:px-6 py-3.5">Jenis</th>
              <th className="px-4 sm:px-6 py-3.5">Tanggal</th>
              <th className="px-4 sm:px-6 py-3.5">Keterangan</th>
              <th className="px-4 sm:px-6 py-3.5 hidden md:table-cell">Alur</th>
              <th className="px-4 sm:px-6 py-3.5">Status</th>
            </TableHeader>
            <tbody className="divide-y divide-cyan-500/5">
              {requests!.map((req) => (
                <tr key={req.id} className="hover:bg-cyan-500/5 transition-colors">
                  {canSeeAll && (
                    <TableCell label="Karyawan" className="font-medium text-slate-900">
                      {req.user.name}
                    </TableCell>
                  )}
                  <TableCell label="Jenis">
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                      {req.leaveType}
                    </span>
                  </TableCell>
                  <TableCell label="Tanggal" className="text-slate-600">
                    {req.startDate.toLocaleDateString("id-ID")} — {req.endDate.toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell label="Keterangan" className="text-slate-500">
                    <RichTextView html={req.remarks} empty="-" />
                  </TableCell>
                  <TableCell label="Alur" className="text-xs text-slate-500 hidden md:table-cell">
                    {getApprovalFlowLabel(req.leaveType)}
                  </TableCell>
                  <TableCell label="Status">
                    <StatusBadge status={req.approvalStatus} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      ) : null}
    </div>
  );
}
