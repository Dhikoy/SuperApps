import { ApprovalStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export function isDbSchemaError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("PrismaClientValidationError") ||
    msg.includes("PrismaClientKnownRequestError") ||
    msg.includes("ATASAN_APPROVED") ||
    msg.includes("column") ||
    msg.includes("no such column") ||
    msg.includes("does not exist")
  );
}

export async function safeLeaveRequestsPending() {
  try {
    return await prisma.leaveRequest.findMany({
      where: {
        approvalStatus: {
          in: [ApprovalStatus.PENDING, ApprovalStatus.ATASAN_APPROVED],
        },
      },
      include: {
        user: { select: { nik: true, name: true, userId: true, supervisorId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[safeLeaveRequestsPending]", error);
    return null;
  }
}

export async function safeLeaveRequestsAll(userId?: string) {
  try {
    return await prisma.leaveRequest.findMany({
      where: userId ? { userId } : {},
      include: { user: { select: { name: true, userId: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[safeLeaveRequestsAll]", error);
    return null;
  }
}

export async function safePendingLeaveCount() {
  try {
    return await prisma.leaveRequest.count({
      where: {
        approvalStatus: {
          in: [ApprovalStatus.PENDING, ApprovalStatus.ATASAN_APPROVED],
        },
      },
    });
  } catch {
    return 0;
  }
}
