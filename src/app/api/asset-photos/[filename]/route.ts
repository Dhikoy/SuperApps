import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllAssets, hasPermission } from "@/lib/roles";
import { resolveAssetPhoto, photoContentType } from "@/lib/asset-photo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "assets:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { filename } = await params;
  const fullPath = resolveAssetPhoto(filename);
  if (!fullPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const asset = await prisma.asset.findFirst({
    where: { photoPath: filename },
    select: { userId: true },
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewAllAssets(session.role) && asset.userId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await fs.readFile(fullPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": photoContentType(filename),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
