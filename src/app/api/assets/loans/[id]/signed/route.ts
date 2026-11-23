import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { readSignedScan, saveSignedScan } from "@/lib/asset-transfer-file";
import { assetLoanInclude } from "@/lib/asset-loan";

async function authorize() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(session.role, "assets:manage")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** Lihat scan form yang sudah ditandatangani. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authorize();
  if (!session) return error;
  const { id } = await params;
  const loan = await prisma.assetLoan.findUnique({ where: { id }, select: { number: true, signedPath: true } });
  if (!loan?.signedPath) return NextResponse.json({ error: "Form bertanda tangan belum diunggah" }, { status: 404 });
  const file = await readSignedScan("asset-loans", loan.signedPath);
  if (!file) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  const ext = loan.signedPath.split(".").pop();
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${loan.number}-ttd.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** HR mengunggah form bertanda tangan lengkap → status Dipinjam, barang tercatat di peminjam. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authorize();
  if (!session) return error;
  const { id } = await params;

  const loan = await prisma.assetLoan.findUnique({ where: { id }, include: assetLoanInclude });
  if (!loan) return NextResponse.json({ error: "Form peminjaman tidak ditemukan" }, { status: 404 });
  if (loan.status === "RETURNED") {
    return NextResponse.json({ error: "Peminjaman ini sudah selesai (barang dikembalikan)" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Pilih file form yang sudah ditandatangani" }, { status: 400 });
  }

  try {
    const signedPath = await saveSignedScan("asset-loans", id, file);
    const activating = loan.status === "PENDING";
    const updated = await prisma.$transaction(async (tx) => {
      if (activating) {
        for (const item of loan.items) {
          const asset = await tx.asset.findUnique({ where: { id: item.assetId }, select: { warehouse: true, userId: true } });
          if (!asset) continue;
          await tx.assetLoanItem.update({
            where: { id: item.id },
            data: { previousWarehouse: asset.warehouse, previousUserId: asset.userId },
          });
          await tx.asset.update({
            where: { id: item.assetId },
            data: { userId: loan.borrowerId, warehouse: loan.borrowerName },
          });
        }
      }
      return tx.assetLoan.update({
        where: { id },
        data: {
          status: activating ? "ACTIVE" : loan.status,
          signedPath,
          signedAt: new Date(),
          signedBy: session.name,
        },
        include: assetLoanInclude,
      });
    });

    await writeAuditLog({
      actorId: session.nik,
      actorName: session.name,
      action: "UPDATE",
      entity: "AssetLoan",
      entityId: id,
      details: activating
        ? `${loan.number} form bertanda tangan diunggah, barang dipinjam ${loan.borrowerName}`
        : `${loan.number} scan form diganti`,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengunggah form";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
