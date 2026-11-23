import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { resolveSelfiePath } from "@/lib/selfie-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;
  const relative = `/api/selfies/${path.join("/")}`;
  const fullPath = resolveSelfiePath(relative);
  if (!fullPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerNik = path[0];
  const canViewAll = hasPermission(session.role, "attendance:manage");
  if (!canViewAll && session.nik !== ownerNik) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await fs.readFile(fullPath);
    const ext = fullPath.endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": ext,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
