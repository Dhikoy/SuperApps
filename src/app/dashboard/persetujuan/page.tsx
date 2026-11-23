import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, AlertBanner, EmptyState, Card, StatusBadge } from "@/components/ui";
import { hasPermission, hasAnyPermission, ATASAN_OVERRIDE_ROLES } from "@/lib/roles";
import { getApprovalFlowLabel, getNextApprovalStageSync, requiresAtasanApprovalSync } from "@/lib/leave";
import { safeLeaveRequestsPending } from "@/lib/safe-db";
import { ApprovalActions } from "./ApprovalActions";

async function getActionableLeaves(sessionId: string, sessionRole: Parameters<typeof hasPermission>[0]) {
  const canAtasan = hasPermission(sessionRole, "leave:approve_atasan");
  const canHrd = hasPermission(sessionRole, "leave:approve_hrd");

  const leaves = await safeLeaveRequestsPending();
  if (!leaves) return { items: [], dbError: true };

  const items = leaves.filter((leave) => {
    const stage = getNextApprovalStageSync(leave.leaveType, leave.approvalStatus);
    if (stage === "atasan" && canAtasan) {
      if (leave.user.supervisorId === sessionId) return true;
      if (ATASAN_OVERRIDE_ROLES.includes(sessionRole)) return true;
    }
    if (stage === "hrd" && canHrd) return true;
    return false;
  });

  return { items, dbError: false };
}

export default async function PersetujuanPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!hasAnyPermission(session.role, ["leave:approve_atasan", "leave:approve_hrd"])) {
    redirect("/dashboard");
  }

  const { items: pending, dbError } = await getActionableLeaves(session.id, session.role);
  const isHrd = hasPermission(session.role, "leave:approve_hrd");
  const isAtasan = hasPermission(session.role, "leave:approve_atasan");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Persetujuan Cuti & Izin"
        subtitle={
          isAtasan && isHrd
            ? "Atasan (tahap 1) · HRD (tahap final) · Sakit/Izin langsung ke HRD"
            : isAtasan
              ? "Setujui pengajuan cuti karyawan — tahap atasan"
              : "Setujui pengajuan setelah atasan, atau sakit/izin terlambat"
        }
        badge={`${pending.length} menunggu`}
      />

      {dbError && (
        <AlertBanner variant="warning">
          Data persetujuan belum dapat dimuat. Jalankan{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">npm run db:migrate</code>{" "}
          lalu <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">npm run db:seed</code>.
        </AlertBanner>
      )}

      <AlertBanner variant="info">
        <strong>Alur:</strong> Cuti Tahunan/Melahirkan/Penting → Karyawan → Atasan → HRD · Sakit/Izin Terlambat → Karyawan → HRD
      </AlertBanner>

      {pending.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Semua sudah diproses"
          description="Tidak ada pengajuan yang menunggu persetujuan Anda saat ini."
        />
      ) : (
        <div className="space-y-4">
          {pending.map((req) => {
            const stage = getNextApprovalStageSync(req.leaveType, req.approvalStatus);
            const stageLabel =
              stage === "atasan"
                ? "Menunggu Atasan"
                : stage === "hrd"
                  ? requiresAtasanApprovalSync(req.leaveType)
                    ? "Menunggu HRD (setelah atasan)"
                    : "Menunggu HRD"
                  : "";

            return (
              <Card key={req.id} className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 text-lg">{req.user.name}</h3>
                    <p className="text-sm text-slate-500">@{req.user.userId}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-200">
                        {req.leaveType}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {getApprovalFlowLabel(req.leaveType)}
                      </span>
                      <span className="text-sm text-slate-500">
                        {req.startDate.toLocaleDateString("id-ID")} — {req.endDate.toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    {req.remarks && (
                      <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        {req.remarks}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={req.approvalStatus} />
                </div>
                <ApprovalActions leaveId={req.id} stageLabel={stageLabel} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
