import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { importPosTransaction, upsertPosByRef } from "@/lib/pos";
import { journalErrorResponse } from "@/lib/accounting/http";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-pos-api-key");
  const expectedKey = process.env.POS_WEBHOOK_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  if (
    !body ||
    (body.type !== "SALE" && body.type !== "EXPENSE") ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    typeof body.transactionDate !== "string" ||
    Number.isNaN(new Date(body.transactionDate).getTime())
  ) {
    return NextResponse.json({ error: "type (SALE/EXPENSE), amount, dan transactionDate (YYYY-MM-DD) wajib valid" }, { status: 400 });
  }

  const systemUser = await prisma.user.findFirst({
    where: { role: { in: ["KEUANGAN", "SUPER_ADMIN"] } },
    select: { nik: true },
  });

  if (!systemUser) {
    return NextResponse.json({ error: "No finance user configured" }, { status: 500 });
  }

  if (body.outlet || (typeof body.externalRef === "string" && body.externalRef.trim().toUpperCase().startsWith("POS:"))) {
    return NextResponse.json(
      { error: "Data outlet POS wajib lewat /api/integrations/pos/events (bertanda tangan)" },
      { status: 400 }
    );
  }

  try {
    const payload = { ...body, amount };
    if (typeof body.externalRef === "string" && body.externalRef.trim()) {
      const outcome = await upsertPosByRef({ ...payload, externalRef: body.externalRef.trim() }, systemUser.nik);
      return NextResponse.json({ ok: true, outcome }, { status: outcome === "created" ? 201 : 200 });
    }
    const result = await importPosTransaction(payload, systemUser.nik);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return journalErrorResponse(error);
  }
}
