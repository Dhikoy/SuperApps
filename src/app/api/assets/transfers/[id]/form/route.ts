import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { buildAssetTransferPdf } from "@/lib/asset-transfer-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const transfer = await prisma.assetTransfer.findUnique({ where: { id } });
  if (!transfer) return NextResponse.json({ error: "Form tidak ditemukan" }, { status: 404 });

  const doc = buildAssetTransferPdf(transfer);
  const pdf = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="serah-terima-${transfer.serialNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
