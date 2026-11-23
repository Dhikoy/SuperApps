import { prisma } from "@/lib/prisma";
import { hasAnyPermission, hasPermission, type Role } from "@/lib/roles";
import { safePendingLeaveCount } from "@/lib/safe-db";

export type PendingNotifications = {
  leave: number;
  overtime: number;
  finance: number;
  total: number;
  items: { type: string; label: string; count: number; href: string }[];
};

export async function getPendingNotifications(role: Role): Promise<PendingNotifications> {
  const items: PendingNotifications["items"] = [];

  let leave = 0;
  if (hasAnyPermission(role, ["leave:approve_atasan", "leave:approve_hrd"])) {
    leave = await safePendingLeaveCount();
    if (leave > 0) {
      items.push({
        type: "leave",
        label: "Cuti / Izin",
        count: leave,
        href: "/dashboard/persetujuan",
      });
    }
  }

  let overtime = 0;
  if (hasPermission(role, "payroll:manage")) {
    overtime = await prisma.overtime.count({ where: { approvalStatus: "PENDING" } });
    if (overtime > 0) {
      items.push({
        type: "overtime",
        label: "Lembur",
        count: overtime,
        href: "/dashboard/payroll/lembur",
      });
    }
  }

  let finance = 0;
  if (hasPermission(role, "finance:approve")) {
    finance = await prisma.fundRequest.count({ where: { status: "PENDING" } });
    if (finance > 0) {
      items.push({
        type: "finance",
        label: "Pengajuan Dana",
        count: finance,
        href: "/dashboard/keuangan/persetujuan",
      });
    }
  }

  return {
    leave,
    overtime,
    finance,
    total: leave + overtime + finance,
    items,
  };
}
