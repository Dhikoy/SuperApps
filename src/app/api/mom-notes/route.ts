import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, canManageMomNotes } from "@/lib/roles";
import { getJakartaTodayStart } from "@/lib/timezone";
import { plainTextFromHtml, sanitizeRichHtml } from "@/lib/rich-text";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "dashboard:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notes = await prisma.momNote.findMany({
    include: {
      creator: { select: { nik: true, name: true, userId: true } },
    },
    orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ items: notes });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "dashboard:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const content = sanitizeRichHtml(String(body.content ?? ""));
  const meetingDateRaw = body.meetingDate as string | undefined;
  const plain = plainTextFromHtml(content);

  if (!title || title.length < 3) {
    return NextResponse.json({ error: "Judul minimal 3 karakter" }, { status: 400 });
  }
  if (!plain || plain.length < 5) {
    return NextResponse.json({ error: "Isi catatan wajib diisi" }, { status: 400 });
  }

  let meetingDate: Date;
  if (meetingDateRaw) {
    meetingDate = new Date(`${meetingDateRaw}T00:00:00+07:00`);
    if (Number.isNaN(meetingDate.getTime())) {
      return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
    }
  } else {
    meetingDate = getJakartaTodayStart();
  }

  const note = await prisma.momNote.create({
    data: {
      title,
      content,
      meetingDate,
      createdBy: session.nik,
    },
    include: {
      creator: { select: { nik: true, name: true, userId: true } },
    },
  });

  return NextResponse.json(note, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMomNotes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const existing = await prisma.momNote.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const title = body.title !== undefined ? String(body.title).trim() : existing.title;
  const content =
    body.content !== undefined
      ? sanitizeRichHtml(String(body.content))
      : existing.content;
  const meetingDateRaw = body.meetingDate as string | undefined;

  if (!title || title.length < 3) {
    return NextResponse.json({ error: "Judul minimal 3 karakter" }, { status: 400 });
  }
  if (plainTextFromHtml(content).length < 5) {
    return NextResponse.json({ error: "Isi catatan wajib diisi" }, { status: 400 });
  }

  let meetingDate = existing.meetingDate;
  if (meetingDateRaw) {
    meetingDate = new Date(`${meetingDateRaw}T00:00:00+07:00`);
    if (Number.isNaN(meetingDate.getTime())) {
      return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
    }
  }

  const note = await prisma.momNote.update({
    where: { id },
    data: { title, content, meetingDate },
    include: {
      creator: { select: { nik: true, name: true, userId: true } },
    },
  });

  return NextResponse.json(note);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMomNotes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const note = await prisma.momNote.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  await prisma.momNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
