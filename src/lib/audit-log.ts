import { prisma } from "@/lib/prisma";

export type AuditInput = {
  actorId?: string;
  actorName?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        details: input.details ?? null,
      },
    });
  } catch (err) {
    console.error("[audit-log]", err);
  }
}
