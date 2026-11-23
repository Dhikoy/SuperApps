import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { DEFAULT_IT_DIRECTOR } from "@/lib/asset-loan-docx";
import {
  ASSET_LOAN_STATUSES,
  AssetLoanError,
  assetLoanInclude,
  loanErrorResponse,
  nextLoanNumber,
  parseLoanHeader,
  parseLoanItems,
} from "@/lib/asset-loan";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const rows = await prisma.assetLoan.findMany({
    where: status && (ASSET_LOAN_STATUSES as readonly string[]).includes(status) ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: assetLoanInclude,
    take: 500,
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const borrowerId = String(body.borrowerId ?? "");
  if (!borrowerId) return NextResponse.json({ error: "Pilih karyawan peminjam" }, { status: 400 });
  const borrower = await prisma.user.findUnique({ where: { nik: borrowerId }, select: { nik: true, name: true } });
  if (!borrower) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 400 });
  const header = parseLoanHeader(body);

  try {
    const loan = await prisma.$transaction(async (tx) => {
      const items = await parseLoanItems(tx, body.items);
      if (!header.hrName) throw new AssetLoanError("Nama penanggung jawab HRD wajib diisi");
      return tx.assetLoan.create({
        data: {
          number: await nextLoanNumber(tx),
          borrowerId: borrower.nik,
          borrowerName: borrower.name,
          jobTitle: header.jobTitle,
          homeAddress: header.homeAddress,
          contact: header.contact,
          hrName: header.hrName,
          directorName: header.directorName ?? DEFAULT_IT_DIRECTOR,
          createdById: session.nik,
          items: { create: items },
        },
        include: assetLoanInclude,
      });
    });

    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: "CREATE",
      entity: "AssetLoan",
      entityId: loan.id,
      details: `${loan.number} ${borrower.name}: ${loan.items.map((i) => i.serialNumber).join(", ")}`,
    });
    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    return loanErrorResponse(error, "Gagal membuat form peminjaman");
  }
}
