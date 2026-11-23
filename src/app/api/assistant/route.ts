import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { answerAssistant } from "@/lib/assistant/answer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Pertanyaan kosong" }, { status: 400 });
  if (message.length > 500) return NextResponse.json({ error: "Pertanyaan terlalu panjang" }, { status: 400 });

  const answer = await answerAssistant(session, message);
  return NextResponse.json({ answer });
}
