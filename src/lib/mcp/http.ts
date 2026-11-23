import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getSession, verifySessionToken, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function sameSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function sessionFromMachineKey(request: Request): Promise<SessionUser | null> {
  const expected = process.env.MCP_ACCESS_KEY?.trim();
  const given = request.headers.get("x-superapps-mcp-key")?.trim();
  if (!expected || !given || !sameSecret(given, expected)) return null;

  const user = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    orderBy: { name: "asc" },
    select: { nik: true, userId: true, name: true, role: true },
  });
  if (!user) return null;
  return {
    id: user.nik,
    nik: user.nik,
    userId: user.userId,
    name: user.name,
    role: user.role,
  };
}

export async function sessionFromMcpRequest(request: Request) {
  const fromKey = await sessionFromMachineKey(request);
  if (fromKey) return fromKey;

  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) {
      const fromBearer = await verifySessionToken(token);
      if (fromBearer) return fromBearer;
    }
  }
  return getSession();
}

export function mcpUnauthorized() {
  return NextResponse.json(
    { error: "Koneksi AI belum dikenali." },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": "Bearer",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
