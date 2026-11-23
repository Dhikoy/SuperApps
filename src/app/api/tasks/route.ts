import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidCompanyCode } from "@/lib/companies-server";
import { hasPermission } from "@/lib/roles";
import { VALID_TASK_STATUSES, type TaskFormData } from "@/lib/tasks-shared";
import type { TaskStatus } from "@/generated/prisma/enums";

function canReadTasks(role: Parameters<typeof hasPermission>[0]) {
  return (
    hasPermission(role, "tasks:manage") ||
    hasPermission(role, "tasks:view") ||
    hasPermission(role, "tasks:own")
  );
}

async function parseTaskBody(body: Partial<TaskFormData>) {
  const title = body.title?.trim();
  const company = (body.company?.trim() || "BCI").toUpperCase();
  const status = (body.status || "BELUM_MULAI") as TaskStatus;
  const description = body.description?.trim() || null;
  const assigneeId = body.assigneeId?.trim() || null;

  if (!title) return { error: "Judul task wajib diisi" };
  if (!(await isValidCompanyCode(company))) {
    return { error: "PT tidak valid" };
  }
  if (!VALID_TASK_STATUSES.includes(status)) {
    return { error: "Status tidak valid" };
  }

  return { title, company, status, description, assigneeId };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadTasks(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = request.nextUrl.searchParams.get("company")?.toUpperCase();
  const canViewAll =
    hasPermission(session.role, "tasks:manage") || hasPermission(session.role, "tasks:view");

  const where = canViewAll
    ? company
      ? { company }
      : {}
    : { assigneeId: session.nik, ...(company ? { company } : {}) };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { nik: true, name: true, company: true } },
      progressLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { author: { select: { nik: true, name: true } } },
      },
    },
    orderBy: [{ company: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "tasks:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = await parseTaskBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { nik: parsed.assigneeId },
      select: { company: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: "PIC tidak ditemukan" }, { status: 400 });
    }
    if (assignee.company !== parsed.company) {
      return NextResponse.json({ error: "PIC harus dari PT yang sama" }, { status: 400 });
    }
  }

  const task = await prisma.task.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      company: parsed.company,
      status: parsed.status,
      assigneeId: parsed.assigneeId,
    },
    include: {
      assignee: { select: { nik: true, name: true, company: true } },
    },
  });

  void import("@/lib/telegram/extras").then(({ notifyTaskAssigned }) =>
    notifyTaskAssigned({
      id: task.id,
      title: task.title,
      company: task.company,
      assigneeId: task.assigneeId,
    })
  );

  return NextResponse.json(task, { status: 201 });
}
