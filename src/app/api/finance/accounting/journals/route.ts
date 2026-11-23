import { NextRequest, NextResponse } from "next/server";
import type { JournalSource, Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { journalErrorResponse } from "@/lib/accounting/http";
import { createJournal } from "@/lib/accounting/journal";
import { endOfDayJakarta, parseReportFilter, startOfDayJakarta } from "@/lib/accounting/reports";
import { JOURNAL_SOURCE_LABELS } from "@/lib/accounting/constants";
import { parseManualHeader } from "@/lib/accounting/manual";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const filter = parseReportFilter(params);
  const source = params.get("source") ?? "";
  const q = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);

  const where: Prisma.JournalEntryWhereInput = {
    date: { gte: startOfDayJakarta(filter.from), lte: endOfDayJakarta(filter.to) },
    ...(filter.company ? { company: filter.company } : {}),
    ...(source in JOURNAL_SOURCE_LABELS ? { source: source as JournalSource } : {}),
    ...(q
      ? { OR: [{ number: { contains: q } }, { description: { contains: q } }, { lines: { some: { accountCode: q } } }] }
      : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: { account: { select: { name: true } } },
        },
      },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    filter,
    page,
    pageSize: PAGE_SIZE,
    total,
    entries: entries.map((e) => ({
      id: e.id,
      number: e.number,
      date: e.date.toISOString(),
      company: e.company,
      description: e.description,
      source: e.source,
      sourceId: e.sourceId,
      locked: e.source !== "MANUAL" && e.source !== "OPENING",
      totalDebit: e.lines.reduce((s, l) => s + l.debit, 0),
      lines: e.lines.map((l) => ({
        accountCode: l.accountCode,
        accountName: l.account.name,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = parseManualHeader(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const entry = await prisma.$transaction((tx) =>
      createJournal(tx, { ...parsed, createdBy: session.nik }, Array.isArray(body.lines) ? body.lines : [])
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return journalErrorResponse(error);
  }
}