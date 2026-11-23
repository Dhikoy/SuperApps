import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPendingNotifications } from "@/lib/pending-notifications";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getPendingNotifications(session.role);
  return NextResponse.json(data);
}
