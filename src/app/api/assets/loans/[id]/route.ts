import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { DEFAULT_IT_DIRECTOR } from "@/lib/asset-loan-docx";
import { AssetLoanError, assetLoanInclude, loanErrorResponse, parseLoanHeader, parseLoanItems } from "@/lib/asset-loan";

async function authorize() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(session.role, "assets:manage")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Ubah form yang masih pending (data peminjam & daftar barang). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authorize();
  if (!session) return error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const header = parseLoanHeader(body);

  try {
    const loan = await prisma.$transaction(async (tx) => {
      const current = await tx.assetLoan.findUnique({ where: { id } });
      if (!current) throw new AssetLoanError("Form peminjaman tidak ditemukan");
      if (current.status !== "PENDING") throw new AssetLoanError("Hanya form berstatus pending yang bisa diubah");
      if (!header.hrName) throw new AssetLoanError("Nama penanggung jawab HRD wajib diisi");
      const items = body.items === undefined ? null : await parseLoanItems(tx, body.items, id);
      if (items) {
        await tx.assetLoanItem.deleteMany({ where: { loanId: id } });
        await tx.assetLoanItem.createMany({ data: items.map((item) => ({ ...item, loanId: id })) });
      }
      return tx.assetLoan.update({
        where: { id },
        data: {
          jobTitle: header.jobTitle,
          homeAddress: header.homeAddress,
          contact: header.contact,
          hrName: header.hrName,
          directorName: header.directorName ?? DEFAULT_IT_DIRECTOR,
        },
        include: assetLoanInclude,
      });
    });

    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: "UPDATE",
      entity: "AssetLoan",
      entityId: loan.id,
      details: `${loan.number} diubah`,
    });
    return NextResponse.json(loan);
  } catch (err) {
    return loanErrorResponse(err, "Gagal mengubah form peminjaman");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authorize();
  if (!session) return error;
  const { id } = await params;

  const loan = await prisma.assetLoan.findUnique({ where: { id } });
  if (!loan) return NextResponse.json({ error: "Form peminjaman tidak ditemukan" }, { status: 404 });
  if (loan.status !== "PENDING") {
    return NextResponse.json({ error: "Form yang sudah ditandatangani tidak bisa dibatalkan" }, { status: 400 });
  }
  await prisma.assetLoan.delete({ where: { id } });

  await writeAuditLog({
    actorId: session.nik,
    actorName: session.name,
    action: "DELETE",
    entity: "AssetLoan",
    entityId: id,
    details: `${loan.number} dibatalkan`,
  });
  return NextResponse.json({ ok: true });
}
