import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Public health check untuk monitoring / load balancer (tanpa auth). */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      uptimeMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        error: err instanceof Error ? err.message : "database unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
