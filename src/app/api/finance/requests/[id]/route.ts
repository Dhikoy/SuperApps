import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { calcTotalAmount } from "@/lib/finance-workflow";
import { parseFundItems } from "@/lib/accounting/fund-items";
import { journalErrorResponse } from "@/lib/accounting/http";
import { assertAccount, syncFundRequestJournals } from "@/lib/accounting/journal";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { action, paymentRef, realizationNote } = body;

  const fundRequest = await prisma.fundRequest.findUnique({
    where: { id },
    include: { items: true, submitter: { select: { name: true } } },
  });

  if (!fundRequest) return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
  if (fundRequest.status === "REALIZED" || fundRequest.status === "REJECTED") {
    return NextResponse.json({ error: "Pengajuan sudah final" }, { status: 400 });
  }

  if (action === "update") {
    if (!hasPermission(session.role, "finance:submit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (fundRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Hanya pengajuan PENDING yang bisa diedit" }, { status: 400 });
    }

    const title = String(body.title ?? "").trim();
    const company = String(body.company ?? "").trim().toUpperCase();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const items = body.items;
    if (!title || !company || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Judul, perusahaan, dan minimal 1 item wajib diisi" }, { status: 400 });
    }

    let parsedItems;
    try {
      parsedItems = await parseFundItems(prisma, items);
    } catch (error) {
      return journalErrorResponse(error);
    }

    await prisma.fundRequestItem.deleteMany({ where: { fundRequestId: id } });
    const updated = await prisma.fundRequest.update({
      where: { id },
      data: {
        title,
        company,
        description: description || null,
        totalAmount: calcTotalAmount(parsedItems),
        items: { create: parsedItems },
      },
      include: { submitter: { select: { name: true } }, items: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "reject") {
    if (!hasPermission(session.role, "finance:approve")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (fundRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Hanya pengajuan PENDING yang bisa ditolak" }, { status: 400 });
    }
    const updated = await prisma.fundRequest.update({
      where: { id },
      data: { status: "REJECTED" },
      include: { submitter: { select: { name: true } }, items: true },
    });
    void import("@/lib/telegram/notify").then(({ notifyFundDecided }) =>
      notifyFundDecided({
        submittedBy: fundRequest.submittedBy,
        title: fundRequest.title,
        approved: false,
      })
    );
    return NextResponse.json(updated);
  }

  if (action === "approve") {
    if (!hasPermission(session.role, "finance:approve")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (fundRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Status tidak valid untuk approve" }, { status: 400 });
    }
    const updated = await prisma.fundRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: session.nik,
        approvedAt: new Date(),
      },
      include: { submitter: { select: { name: true } }, items: true },
    });
    void import("@/lib/telegram/notify").then(({ notifyFundDecided }) =>
      notifyFundDecided({
        submittedBy: fundRequest.submittedBy,
        title: fundRequest.title,
        approved: true,
      })
    );
    return NextResponse.json(updated);
  }

  if (action === "pay") {
    if (!hasPermission(session.role, "finance:pay")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (fundRequest.status !== "APPROVED") {
      return NextResponse.json({ error: "Hanya pengajuan APPROVED yang bisa dibayar" }, { status: 400 });
    }
    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const paidFromAccount = await assertAccount(tx, body.paidFromAccount, {
          label: "Dibayar dari",
          cash: true,
        });
        const row = await tx.fundRequest.update({
          where: { id },
          data: {
            status: "PAID",
            paidBy: session.nik,
            paidAt: new Date(),
            paymentRef: paymentRef?.trim() || null,
            paidFromAccount,
          },
          include: { submitter: { select: { name: true } }, items: true },
        });
        await syncFundRequestJournals(tx, id);
        return row;
      });
    } catch (error) {
      return journalErrorResponse(error);
    }
    void import("@/lib/telegram/extras").then(({ notifyFundStage }) =>
      notifyFundStage({
        submittedBy: fundRequest.submittedBy,
        title: fundRequest.title,
        stage: "PAID",
      })
    );
    return NextResponse.json(updated);
  }

  if (action === "realize") {
    if (!hasPermission(session.role, "finance:realize")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (fundRequest.status !== "PAID") {
      return NextResponse.json({ error: "Hanya pengajuan PAID yang bisa direalisasi" }, { status: 400 });
    }

    const rawAmount = body.realizedAmount;
    let realizedAmount: number | null = null;
    if (rawAmount !== undefined && rawAmount !== null && rawAmount !== "") {
      realizedAmount = Number(rawAmount);
      if (!Number.isFinite(realizedAmount) || realizedAmount < 0) {
        return NextResponse.json({ error: "Nominal realisasi tidak valid" }, { status: 400 });
      }
      if (realizedAmount === fundRequest.totalAmount) realizedAmount = null;
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const row = await tx.fundRequest.update({
          where: { id },
          data: {
            status: "REALIZED",
            realizedBy: session.nik,
            realizedAt: new Date(),
            realizationNote: realizationNote?.trim() || null,
            realizedAmount,
          },
          include: { submitter: { select: { name: true } }, items: true },
        });
        await syncFundRequestJournals(tx, id);
        return row;
      });
    } catch (error) {
      return journalErrorResponse(error);
    }

    void import("@/lib/telegram/extras").then(({ notifyFundStage }) =>
      notifyFundStage({
        submittedBy: fundRequest.submittedBy,
        title: fundRequest.title,
        stage: "REALIZED",
      })
    );

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const fundRequest = await prisma.fundRequest.findUnique({ where: { id } });
  if (!fundRequest) return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
  if (fundRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Hanya pengajuan PENDING yang bisa dihapus" }, { status: 400 });
  }

  await prisma.fundRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
