import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { VALID_TASK_STATUSES } from "@/lib/tasks-shared";
import type { TaskStatus } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

async function canAccessTask(taskId: string, nik: string, role: Parameters<typeof hasPermission>[0]) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Task tidak ditemukan", status: 404 as const };

  const canViewAll =
    hasPermission(role, "tasks:manage") || hasPermission(role, "tasks:view");
  if (canViewAll || task.assigneeId === nik) {
    return { task };
  }
  return { error: "Forbidden", status: 403 as const };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccessTask(id, session.nik, session.role);
  if ("error" in access && !("task" in access)) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const logs = await prisma.taskProgress.findMany({
    where: { taskId: id },
    include: { author: { select: { nik: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccessTask(id, session.nik, session.role);
  if ("error" in access && !("task" in access)) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const task = access.task!;
  const isAssignee = task.assigneeId === session.nik;
  const canManage = hasPermission(session.role, "tasks:manage");

  if (!isAssignee && !canManage) {
    return NextResponse.json({ error: "Hanya PIC yang ditugaskan bisa update progress" }, { status: 403 });
  }

  const body = await request.json();
  const note = body.note?.trim();
  const status = (body.status || task.status) as TaskStatus;

  if (!note) {
    return NextResponse.json({ error: "Catatan progress wajib diisi" }, { status: 400 });
  }
  if (!VALID_TASK_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const [log] = await prisma.$transaction([
    prisma.taskProgress.create({
      data: {
        taskId: id,
        authorId: session.nik,
        note,
        status,
      },
      include: { author: { select: { nik: true, name: true } } },
    }),
    prisma.task.update({
      where: { id },
      data: { status },
    }),
  ]);

  return NextResponse.json(log, { status: 201 });
}
