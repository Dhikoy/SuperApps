import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidCompanyCode } from "@/lib/companies-server";
import { hasPermission } from "@/lib/roles";
import { VALID_TASK_STATUSES } from "@/lib/tasks-shared";
import type { TaskStatus } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "tasks:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Task tidak ditemukan" }, { status: 404 });

  const title = body.title?.trim() ?? existing.title;
  const company = (body.company?.trim() || existing.company).toUpperCase();
  const status = (body.status || existing.status) as TaskStatus;
  const description =
    body.description !== undefined ? body.description?.trim() || null : existing.description;
  const assigneeId =
    body.assigneeId !== undefined ? body.assigneeId?.trim() || null : existing.assigneeId;

  if (!title) return NextResponse.json({ error: "Judul task wajib diisi" }, { status: 400 });
  if (!(await isValidCompanyCode(company))) {
    return NextResponse.json({ error: "PT tidak valid" }, { status: 400 });
  }
  if (!VALID_TASK_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { nik: assigneeId },
      select: { company: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: "PIC tidak ditemukan" }, { status: 400 });
    }
    if (assignee.company !== company) {
      return NextResponse.json({ error: "PIC harus dari PT yang sama" }, { status: 400 });
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: { title, description, company, status, assigneeId },
    include: {
      assignee: { select: { nik: true, name: true, company: true } },
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "tasks:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
