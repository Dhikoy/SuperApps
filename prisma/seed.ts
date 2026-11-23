import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { EMPLOYEES } from "../src/lib/employees";
import { DEFAULT_PAYROLL_POLICIES } from "../src/lib/payroll-policy";
import { NATIONAL_HOLIDAYS_2026, NATIONAL_HOLIDAYS_2027 } from "../src/lib/holidays";
import { buildNik, nextSequenceForCompany, uniqueUserIdFromName } from "../src/lib/nik";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.syncLog.deleteMany();
  await prisma.stockOpname.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.payrollPosting.deleteMany();
  await prisma.posTransaction.deleteMany();
  await prisma.exitRequest.deleteMany();
  await prisma.pph21Profile.deleteMany();
  await prisma.bpjsEnrollment.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.businessTrip.deleteMany();
  await prisma.employmentContract.deleteMany();
  await prisma.onboardingTask.deleteMany();
  await prisma.recruitment.deleteMany();
  await prisma.jobGrade.deleteMany();
  await prisma.department.deleteMany();
  await prisma.fundRequestItem.deleteMany();
  await prisma.fundRequest.deleteMany();
  await prisma.incomeEntry.deleteMany();
  await prisma.taskProgress.deleteMany();
  await prisma.task.deleteMany();
  await prisma.overtime.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.companyPresensiConfig.deleteMany();
  await prisma.company.deleteMany();
  await prisma.officeLocation.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.userSalary.deleteMany();
  await prisma.publicHoliday.deleteMany();
  await prisma.payrollPolicy.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("password123", 10);
  const createdNiks: string[] = [];
  const companySeq: Record<string, number> = {};
  const usedUserIds = new Set<string>();

  function assignNik(company: string): string {
    if (!companySeq[company]) {
      companySeq[company] = nextSequenceForCompany(createdNiks, company);
    } else {
      companySeq[company]++;
    }
    const nik = buildNik(company, companySeq[company]);
    createdNiks.push(nik);
    return nik;
  }

  const userByNik = new Map<string, { nik: string; role: string }>();

  for (const emp of EMPLOYEES) {
    const nik = assignNik(emp.company);
    const userId = uniqueUserIdFromName(emp.name, usedUserIds);

    const user = await prisma.user.create({
      data: {
        nik,
        userId,
        name: emp.name,
        password,
        role: emp.role,
        company: emp.company,
        jobTitle: emp.jobTitle,
      },
    });
    userByNik.set(user.nik, { nik: user.nik, role: user.role });
  }

  const direksi = [...userByNik.entries()].find(([, u]) => u.role === "DIREKSI");
  const hrd = [...userByNik.entries()].find(([, u]) => u.role === "HRD");
  const keuangan = [...userByNik.entries()].find(([, u]) => u.role === "KEUANGAN");

  if (direksi) {
    await prisma.user.updateMany({
      where: { company: "BCI", role: "STAFF" },
      data: { supervisorId: direksi[0] },
    });
  }

  const lbbLead = await prisma.user.findFirst({ where: { company: "LBB", role: "LEAD" } });
  if (lbbLead) {
    await prisma.user.updateMany({
      where: { company: "LBB", role: "STAFF" },
      data: { supervisorId: lbbLead.nik },
    });
  }

  const shiftPagi = await prisma.workSchedule.create({
    data: {
      shiftName: "Shift Pagi",
      standardClockIn: "09:00",
      standardClockOut: "17:00",
      isActive: true,
    },
  });

  const shiftMalamA = await prisma.workSchedule.create({
    data: {
      shiftName: "Shift Malam A",
      standardClockIn: "22:00",
      standardClockOut: "07:00",
      isActive: true,
    },
  });

  const shiftMalamB = await prisma.workSchedule.create({
    data: {
      shiftName: "Shift Malam B",
      standardClockIn: "23:00",
      standardClockOut: "08:00",
      isActive: true,
    },
  });

  const bcg1 = await prisma.workSchedule.create({
    data: { shiftName: "BCG 1", standardClockIn: "06:00", standardClockOut: "14:00", isActive: true },
  });
  const bcg2 = await prisma.workSchedule.create({
    data: { shiftName: "BCG 2", standardClockIn: "09:00", standardClockOut: "17:00", isActive: true },
  });
  const bcg3 = await prisma.workSchedule.create({
    data: { shiftName: "BCG 3", standardClockIn: "14:00", standardClockOut: "22:00", isActive: true },
  });

  const leaveTypeSeed = [
    { name: "Cuti Tahunan", requiresAtasan: true, sortOrder: 1 },
    { name: "Cuti Melahirkan", requiresAtasan: true, sortOrder: 2 },
    { name: "Cuti Penting", requiresAtasan: true, sortOrder: 3 },
    { name: "Sakit", requiresAtasan: false, sortOrder: 4 },
    { name: "Izin Terlambat", requiresAtasan: false, sortOrder: 5 },
  ];
  for (const lt of leaveTypeSeed) {
    await prisma.leaveType.create({ data: lt });
  }

  const officeSeed = [
    {
      name: "Kantor BCI Jakarta Pusat",
      address: "Jakarta Pusat",
      latitude: -6.2088,
      longitude: 106.8456,
      radiusMeters: 100,
    },
    {
      name: "Kantor BCI Bekasi",
      address: "Bekasi",
      latitude: -6.2383,
      longitude: 106.9756,
      radiusMeters: 100,
    },
    {
      name: "Kantor BCI Tangerang",
      address: "Tangerang",
      latitude: -6.1783,
      longitude: 106.6319,
      radiusMeters: 100,
    },
  ];
  for (const office of officeSeed) {
    await prisma.officeLocation.create({ data: office });
  }

  const offices = await prisma.officeLocation.findMany();
  const jakarta = offices.find((o) => o.name.includes("Jakarta"));
  const bekasi = offices.find((o) => o.name.includes("Bekasi"));
  const tangerang = offices.find((o) => o.name.includes("Tangerang"));

  const companySeed = [
    { code: "BCI", name: "Brown Cinnamons International", description: "PT BCI — Head Office", sortOrder: 1 },
    { code: "MKTECH", name: "Mumpuni Teknologi Kolaborasi", description: "PT MKTECH", sortOrder: 2 },
    { code: "MNT", name: "MNT", description: "PT MNT", sortOrder: 3 },
    { code: "DPI", name: "Deprezz Power Indonesia", description: "PT DPI", sortOrder: 4 },
    { code: "LBB", name: "Lha Baguette Bekasi", description: "PT LBB", sortOrder: 5 },
    { code: "PIC", name: "Pandawa Integra Consulting", description: "Konsultan Internal & Eksternal", sortOrder: 6 },
  ];
  for (const c of companySeed) {
    await prisma.company.create({ data: c });
  }

  await prisma.companyPresensiConfig.createMany({
    data: [
      { company: "BCI", officeLocationId: jakarta?.id, workScheduleId: shiftPagi.id, workDaysPerMonth: 22 },
      { company: "MKTECH", officeLocationId: bekasi?.id, workScheduleId: shiftMalamA.id, workDaysPerMonth: 22 },
      { company: "MNT", officeLocationId: tangerang?.id, workScheduleId: shiftMalamB.id, workDaysPerMonth: 22 },
      { company: "DPI", officeLocationId: jakarta?.id, workScheduleId: shiftPagi.id, workDaysPerMonth: 22 },
      { company: "LBB", officeLocationId: bekasi?.id, workScheduleId: bcg2.id, workDaysPerMonth: 26, shiftOptions: JSON.stringify([bcg1.id, bcg2.id, bcg3.id]) },
      { company: "PIC", officeLocationId: jakarta?.id, workScheduleId: shiftPagi.id, workDaysPerMonth: 22 },
    ],
  });

  const staffList = [...userByNik.entries()].filter(([, u]) => u.role === "STAFF");
  const sampleStaff = staffList.slice(0, 3);

  if (sampleStaff[0]) {
    await prisma.asset.create({
      data: {
        laptop: "MacBook Pro M3",
        serialNumber: "MBP-001",
        condition: "Baik",
        warehouse: "Gudang A",
        userId: sampleStaff[0][0],
      },
    });
  }

  if (sampleStaff[1]) {
    await prisma.task.create({
      data: {
        title: "Onboarding sistem SuperApps",
        description: "Setup akun, training presensi, dan orientasi modul HR.",
        company: "BCI",
        status: "PROSES",
        assigneeId: sampleStaff[1][0],
      },
    });
  }

  if (sampleStaff[0] && direksi) {
    await prisma.leaveRequest.create({
      data: {
        userId: sampleStaff[0][0],
        leaveType: "Cuti Tahunan",
        startDate: new Date("2026-07-10"),
        endDate: new Date("2026-07-12"),
        remarks: "Liburan keluarga",
        approvalStatus: "PENDING",
      },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sampleStaff[0]) {
    await prisma.attendance.create({
      data: {
        userId: sampleStaff[0][0],
        jamKerjaId: shiftPagi.id,
        date: yesterday,
        clockInTime: "08:05",
        clockOutTime: "17:10",
        latitude: -6.2088,
        longitude: 106.8456,
        status: "TERLAMBAT",
      },
    });
  }

  for (const policy of DEFAULT_PAYROLL_POLICIES) {
    await prisma.payrollPolicy.create({
      data: {
        company: policy.company,
        standardWorkDays: policy.standardWorkDays,
        salaryDivisor: policy.salaryDivisor,
        calculationMode: policy.calculationMode,
        overtimeWeekday: policy.overtimeWeekday,
        overtimeHoliday: policy.overtimeHoliday,
        useNationalHoliday: policy.useNationalHoliday,
        workDaysPattern: policy.workDaysPattern,
        description: policy.description,
      },
    });
  }

  for (const h of [...NATIONAL_HOLIDAYS_2026, ...NATIONAL_HOLIDAYS_2027]) {
    await prisma.publicHoliday.create({
      data: { date: new Date(h.date), name: h.name },
    });
  }

  const salaryMap: Record<string, number> = {
    BCI: 5_000_000,
    LBB: 4_000_000,
    MKTECH: 6_000_000,
    MNT: 4_500_000,
    DPI: 5_500_000,
    PIC: 5_000_000,
  };

  for (const [nik] of userByNik) {
    const user = await prisma.user.findUnique({ where: { nik }, select: { company: true } });
    if (!user) continue;
    const gaji = salaryMap[user.company ?? "BCI"] ?? 5_000_000;
    await prisma.userSalary.create({ data: { userId: nik, gajiPokok: gaji } });
  }

  const mktechAdmin = [...userByNik.entries()].find(
    ([, u]) => u.role === "SUPER_ADMIN"
  );
  if (mktechAdmin) {
    await prisma.attendance.create({
      data: {
        userId: mktechAdmin[0],
        jamKerjaId: shiftPagi.id,
        date: yesterday,
        clockInTime: "08:00",
        clockOutTime: "17:00",
        latitude: -6.2088,
        longitude: 106.8456,
        status: "HADIR",
      },
    });
  }

  const bciStaff = [...userByNik.entries()].find(([, u]) => u.role === "STAFF");
  if (bciStaff) {
    await prisma.overtime.create({
      data: {
        userId: bciStaff[0],
        date: new Date("2026-07-02"),
        hours: 2,
        type: "WEEKDAY",
        approvalStatus: "APPROVED",
        approvedBy: hrd?.[0] ?? null,
        approvedAt: new Date(),
        remarks: "Sample lembur proyek",
      },
    });
  }

  if (keuangan && direksi) {
    const financeUser = keuangan[0];
    const fundPending = await prisma.fundRequest.create({
      data: {
        title: "Kebutuhan operasional BCI — galon air minum",
        company: "BCI",
        description: "PT BCI minggu ini butuh 3 galon air minum",
        totalAmount: 45_000,
        status: "PENDING",
        submittedBy: financeUser,
        items: {
          create: [
            { itemName: "Galon air minum 19L", quantity: 3, unit: "galon", unitPrice: 15_000, subtotal: 45_000 },
          ],
        },
      },
    });

    await prisma.fundRequest.create({
      data: {
        title: "Perlengkapan operasional LBB",
        company: "LBB",
        description: "Sample pengajuan sudah direalisasi",
        totalAmount: 250_000,
        status: "REALIZED",
        submittedBy: financeUser,
        approvedBy: direksi[0],
        approvedAt: new Date("2026-07-01"),
        paidBy: financeUser,
        paidAt: new Date("2026-07-02"),
        paymentRef: "TRF-001",
        realizedBy: financeUser,
        realizedAt: new Date("2026-07-03"),
        items: {
          create: [
            { itemName: "ATK", quantity: 1, unit: "paket", unitPrice: 250_000, subtotal: 250_000 },
          ],
        },
      },
    });

    await prisma.incomeEntry.create({
      data: {
        title: "Penjualan harian LBB (manual)",
        company: "LBB",
        amount: 1_500_000,
        source: "MANUAL",
        entryDate: new Date("2026-07-03"),
        remarks: "Sample pendapatan — nanti dari POS",
        createdBy: financeUser,
      },
    });

    await prisma.posTransaction.createMany({
      data: [
        {
          company: "LBB",
          type: "SALE",
          amount: 2_200_000,
          description: "Penjualan POS harian",
          transactionDate: new Date("2026-07-03"),
          externalRef: "POS-SALE-001",
        },
        {
          company: "LBB",
          type: "EXPENSE",
          amount: 350_000,
          description: "Biaya operasional POS",
          transactionDate: new Date("2026-07-03"),
          externalRef: "POS-EXP-001",
        },
      ],
    });

    await prisma.incomeEntry.create({
      data: {
        title: "Penjualan POS LBB",
        company: "LBB",
        amount: 2_200_000,
        source: "POS",
        entryDate: new Date("2026-07-03"),
        remarks: "Sync POS LBB",
        createdBy: financeUser,
      },
    });

    const galon = await prisma.stockItem.create({
      data: {
        name: "Galon air minum 19L",
        company: "BCI",
        unit: "galon",
        minQuantity: 3,
        currentQty: 1,
      },
    });

    await prisma.stockOpname.create({
      data: {
        stockItemId: galon.id,
        countedQty: 1,
        countedBy: financeUser,
        note: "Stok kurang — butuh pengajuan",
      },
    });

    console.log(`Sample pengajuan dana: ${fundPending.id} (PENDING)`);
  }

  if (hrd) {
    const hrdNik = hrd[0];
    const staffBci = await prisma.user.findFirst({ where: { company: "BCI", role: "STAFF" } });

    const deptHr = await prisma.department.create({
      data: { name: "Human Resources", company: "BCI", headNik: hrdNik, description: "Divisi HR BCI" },
    });

    const gradeStaff = await prisma.jobGrade.create({
      data: { title: "Staff Operasional", grade: "G2", company: "BCI", minSalary: 4_000_000, maxSalary: 6_000_000 },
    });

    await prisma.jobGrade.create({
      data: { title: "Manager", grade: "G4", company: "BCI", minSalary: 8_000_000, maxSalary: 12_000_000 },
    });

    if (staffBci) {
      await prisma.user.update({
        where: { nik: staffBci.nik },
        data: { departmentId: deptHr.id, jobGradeId: gradeStaff.id },
      });

      await prisma.onboardingTask.createMany({
        data: [
          { userId: staffBci.nik, title: "Orientasi perusahaan & budaya kerja" },
          { userId: staffBci.nik, title: "Setup akun SuperApps & presensi", completed: true, completedAt: new Date() },
        ],
      });

      await prisma.employmentContract.create({
        data: {
          userId: staffBci.nik,
          type: "PKWT",
          startDate: new Date("2025-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });

      await prisma.bpjsEnrollment.create({
        data: { userId: staffBci.nik, bpjsKes: "0001234567890", bpjsTk: "12012345678" },
      });

      await prisma.pph21Profile.create({
        data: { userId: staffBci.nik, npwp: "12.345.678.9-000.000", ptkpStatus: "TK/0" },
      });
    }

    await prisma.recruitment.create({
      data: {
        position: "Admin Keuangan",
        company: "BCI",
        applicantName: "Budi Santoso",
        email: "budi@email.com",
        status: "INTERVIEW",
      },
    });

    if (staffBci) {
      await prisma.performanceReview.create({
        data: {
          userId: staffBci.nik,
          period: "2026-H1",
          score: 85,
          kpiNotes: "Kinerja baik, konsisten hadir",
          reviewerNik: hrdNik,
        },
      });
    }
  }

  console.log(`Seed selesai — ${EMPLOYEES.length} karyawan dengan NIK.`);
  console.log("Password default semua akun: password123");
  if (hrd) {
    const hrdUser = await prisma.user.findUnique({ where: { nik: hrd[0] } });
    console.log(`HRD login: ${hrdUser?.userId}`);
  }
  if (keuangan) {
    const keuUser = await prisma.user.findUnique({ where: { nik: keuangan[0] } });
    console.log(`Keuangan login: ${keuUser?.userId}`);
  }
  const superAdmin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (superAdmin) console.log(`Super Admin login: ${superAdmin.userId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
