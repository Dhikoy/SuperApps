import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi, requireHrSensitiveApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrSensitiveApi();
  if (auth.error) return auth.error;

  const items = await prisma.recruitment.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { position, company, applicantName, email, phone, notes, status } = await request.json();
  if (!position?.trim() || !company?.trim() || !applicantName?.trim()) {
    return NextResponse.json({ error: "Posisi, perusahaan, dan nama kandidat wajib" }, { status: 400 });
  }

  const item = await prisma.recruitment.create({
    data: {
      position: position.trim(),
      company: company.toUpperCase(),
      applicantName: applicantName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      status: status || "OPEN",
    },
  });

  return NextResponse.json(item, { status: 201 });
}
