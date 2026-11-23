import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          Pragma: "no-cache",
        },
      }
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { nik: session.nik },
    select: { mustChangePassword: true },
  });

  return NextResponse.json(
    {
      userId: session.userId,
      name: session.name,
      role: session.role,
      mustChangePassword: dbUser?.mustChangePassword ?? false,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
      },
    }
  );
}
