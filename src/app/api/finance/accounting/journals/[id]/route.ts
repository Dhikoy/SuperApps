import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { journalErrorResponse } from "@/lib/accounting/http";
import { deleteJournal, updateJournal } from "@/lib/accounting/journal";
import { parseManualHeader } from "@/lib/accounting/manual";

type Ctx = { params: Promise<{ id: string }> };

async function loadEditable(id: string) {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(session.role, "finance:accounting")) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const entry = await prisma.journalEntry.findUnique({ where: { id } });
  if (!entry) return { response: NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 }) };
  if (entry.source !== "MANUAL" && entry.source !== "OPENING") {
    return {
      response: NextResponse.json(
        { error: "Jurnal otomatis dikunci — ubah lewat transaksi sumbernya" },
        { status: 400 }
      ),
    };
  }
  return { entry };
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const loaded = await loadEditable(id);
  if ("response" in loaded) return loaded.response;

  const body = await request.json();
  const parsed = parseManualHeader(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const entry = await prisma.$transaction((tx) =>
      updateJournal(tx, id, parsed, Array.isArray(body.lines) ? body.lines : [])
    );
    return NextResponse.json(entry);
  } catch (error) {
    return journalErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const loaded = await loadEditable(id);
  if ("response" in loaded) return loaded.response;

  try {
    await deleteJournal(prisma, id);
  } catch (error) {
    return journalErrorResponse(error);
  }
  return NextResponse.json({ ok: true });
}
