import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi } from "@/lib/hr-auth";

export async function GET(request: NextRequest) {
  const auth = await requireHrApi("hr:view");
  if (auth.error) return auth.error;

  const userId = request.nextUrl.searchParams.get("userId");
  const tasks = await prisma.onboardingTask.findMany({
    where: userId ? { userId } : undefined,
    include: { user: { select: { name: true, company: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { userId, title } = await request.json();
  if (!userId || !title?.trim()) {
    return NextResponse.json({ error: "userId dan title wajib" }, { status: 400 });
  }

  const task = await prisma.onboardingTask.create({
    data: { userId, title: title.trim() },
  });

  void import("@/lib/telegram/extras").then(({ notifyOnboardingCreated }) =>
    notifyOnboardingCreated(userId, title.trim())
  );

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { id, completed } = await request.json();
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const task = await prisma.onboardingTask.update({
    where: { id },
    data: { completed: Boolean(completed), completedAt: completed ? new Date() : null },
  });

  return NextResponse.json(task);
}
