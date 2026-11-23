import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { buildAssetLoanDocx } from "@/lib/asset-loan-docx";
import { assetLoanInclude } from "@/lib/asset-loan";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const loan = await prisma.assetLoan.findUnique({ where: { id }, include: assetLoanInclude });
  if (!loan) return NextResponse.json({ error: "Form peminjaman tidak ditemukan" }, { status: 404 });

  const docx = await buildAssetLoanDocx(loan);
  const safeName = loan.borrowerName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(docx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${loan.number}-${safeName || "peminjaman"}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
