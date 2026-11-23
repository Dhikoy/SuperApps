import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHrApi, requireHrSensitiveApi } from "@/lib/hr-auth";

export async function GET() {
  const auth = await requireHrSensitiveApi();
  if (auth.error) return auth.error;

  const trips = await prisma.businessTrip.findMany({
    include: { user: { select: { name: true, company: true } } },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ trips });
}

export async function POST(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { userId, destination, startDate, endDate, purpose, budget } = await request.json();
  if (!userId || !destination?.trim() || !startDate || !endDate) {
    return NextResponse.json({ error: "Data perjalanan dinas tidak lengkap" }, { status: 400 });
  }

  const trip = await prisma.businessTrip.create({
    data: {
      userId,
      destination: destination.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      purpose: purpose?.trim() || null,
      budget: budget ? Number(budget) : null,
    },
    include: { user: { select: { name: true } } },
  });

  void import("@/lib/telegram/extras").then(({ notifyBusinessTripSubmitted }) =>
    notifyBusinessTripSubmitted({
      id: trip.id,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      userName: trip.user.name,
    })
  );

  return NextResponse.json(trip, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireHrApi("hr:manage");
  if (auth.error) return auth.error;

  const { id, approvalStatus } = await request.json();
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  if (!["APPROVED", "REJECTED"].includes(approvalStatus)) {
    return NextResponse.json({ error: "approvalStatus harus APPROVED atau REJECTED" }, { status: 400 });
  }

  const trip = await prisma.businessTrip.update({
    where: { id },
    data: {
      approvalStatus,
      approvedBy: auth.session!.nik,
      approvedAt: approvalStatus === "APPROVED" ? new Date() : null,
    },
  });

  void import("@/lib/telegram/extras").then(({ notifyBusinessTripDecided }) =>
    notifyBusinessTripDecided({
      userId: trip.userId,
      destination: trip.destination,
      approved: approvalStatus === "APPROVED",
    })
  );

  return NextResponse.json(trip);
}
