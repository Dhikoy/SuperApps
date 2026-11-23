import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi } from "@/lib/hr-auth";
import { hashPassword } from "@/lib/auth";
import { generateNextNik } from "@/lib/nik";
import { suggestUserIdFromName } from "@/lib/user-id";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyPendingApproval } from "@/lib/notify";
import { defaultFlexibleAttendance, isItCompany } from "@/lib/roles";

const VALID_STATUSES = ["OPEN", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "CLOSED"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { id } = await params;
  const { status } = await request.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const existing = await prisma.recruitment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Kandidat tidak ditemukan" }, { status: 404 });

  const updated = await prisma.recruitment.update({
    where: { id },
    data: { status },
  });

  let createdUser = null;

  if (status === "HIRED") {
    const suggestedUserId = suggestUserIdFromName(existing.applicantName);
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ userId: suggestedUserId }, { name: existing.applicantName }] },
    });

    if (!existingUser) {
      const nik = await generateNextNik();
      const defaultPassword = await hashPassword("password123");
      createdUser = await prisma.user.create({
        data: {
          nik,
          userId: suggestedUserId,
          name: existing.applicantName,
          password: defaultPassword,
          role: isItCompany(existing.company) ? "IT" : "STAFF",
          company: existing.company,
          flexibleAttendance: defaultFlexibleAttendance(existing.company),
          jobTitle: existing.position,
          joinDate: new Date(),
          mustChangePassword: true,
        },
        select: { nik: true, userId: true, name: true },
      });

      await prisma.onboardingTask.createMany({
        data: [
          { userId: nik, title: "Serah terima laptop", completed: false },
          { userId: nik, title: "Briefing HRD", completed: false },
          { userId: nik, title: "Setup akun SuperApps", completed: true },
        ],
      });

      await writeAuditLog({
        actorId: auth.session?.nik,
        actorName: auth.session?.name,
        action: "HIRE",
        entity: "User",
        entityId: nik,
        details: `Dari rekrutmen: ${existing.position}`,
      });

      void notifyPendingApproval(
        "HRD",
        "onboarding karyawan baru",
        1
      );
    }
  }

  await writeAuditLog({
    actorId: auth.session?.nik,
    actorName: auth.session?.name,
    action: "UPDATE_STATUS",
    entity: "Recruitment",
    entityId: id,
    details: status,
  });

  return NextResponse.json({ ...updated, createdUser });
}
