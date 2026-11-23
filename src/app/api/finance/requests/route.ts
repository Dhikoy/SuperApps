import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { calcTotalAmount } from "@/lib/finance-workflow";
import { parseFundItems } from "@/lib/accounting/fund-items";
import { journalErrorResponse } from "@/lib/accounting/http";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const company = request.nextUrl.searchParams.get("company")?.toUpperCase() ?? undefined;

  const canSeeAll =
    hasPermission(session.role, "finance:approve") ||
    hasPermission(session.role, "finance:pay") ||
    hasPermission(session.role, "finance:realize");

  const requests = await prisma.fundRequest.findMany({
    where: {
      ...(status ? { status: status as "PENDING" | "APPROVED" | "PAID" | "REALIZED" | "REJECTED" } : {}),
      ...(company ? { company } : {}),
      ...(!canSeeAll ? { submittedBy: session.id } : {}),
    },
    include: {
      submitter: { select: { name: true, userId: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "finance:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, company, description, items } = await request.json();

  if (!title?.trim() || !company?.trim() || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Judul, perusahaan, dan minimal 1 item wajib diisi" }, { status: 400 });
  }

  let parsedItems;
  try {
    parsedItems = await parseFundItems(prisma, items);
  } catch (error) {
    return journalErrorResponse(error);
  }

  const totalAmount = calcTotalAmount(parsedItems);

  const fundRequest = await prisma.fundRequest.create({
    data: {
      title: title.trim(),
      company: company.toUpperCase(),
      description: description?.trim() || null,
      totalAmount,
      submittedBy: session.id,
      items: { create: parsedItems },
    },
    include: {
      submitter: { select: { name: true, userId: true } },
      items: true,
    },
  });

  void import("@/lib/telegram/notify").then(({ notifyFundSubmitted }) =>
    notifyFundSubmitted({
      id: fundRequest.id,
      title: fundRequest.title,
      company: fundRequest.company,
      totalAmount: fundRequest.totalAmount,
      submitterName: fundRequest.submitter.name,
    })
  );

  return NextResponse.json(fundRequest, { status: 201 });
}
