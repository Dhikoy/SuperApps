import { NextResponse } from "next/server";
import { getSession, signSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await signSessionToken(session);
  return NextResponse.json({
    token,
    url: "https://appsbci.com/api/mcp",
    expiresInDays: 7,
    name: session.name,
    role: session.role,
  });
}
