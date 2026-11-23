import { prisma } from "@/lib/prisma";

export type OwnedRecordSummary = {
  invoices: number;
  incomes: number;
  fundRequests: number;
  momNotes: number;
  assetLoansCreated: number;
  assetTransfersCreated: number;
  penaltiesCreated: number;
};

export class DeleteUserBlockedError extends Error {
  constructor(
    message: string,
    readonly code: "TRANSFER_REQUIRED" | "INVALID_TRANSFER" | "ACTIVE_ASSETS",
    readonly owned?: OwnedRecordSummary
  ) {
    super(message);
  }
}

/** Dokumen perusahaan yang dibuat karyawan ini: tidak boleh ikut terhapus, harus dialihkan */
export async function countOwnedRecords(nik: string): Promise<OwnedRecordSummary> {
  const [invoices, incomes, fundRequests, momNotes, assetLoansCreated, assetTransfersCreated, penaltiesCreated] =
    await Promise.all([
      prisma.invoice.count({ where: { createdBy: nik } }),
      prisma.incomeEntry.count({ where: { createdBy: nik } }),
      prisma.fundRequest.count({ where: { submittedBy: nik } }),
      prisma.momNote.count({ where: { createdBy: nik } }),
      prisma.assetLoan.count({ where: { createdById: nik } }),
      prisma.assetTransfer.count({ where: { createdById: nik } }),
      prisma.employeePenalty.count({ where: { createdByNik: nik } }),
    ]);
  return { invoices, incomes, fundRequests, momNotes, assetLoansCreated, assetTransfersCreated, penaltiesCreated };
}

export function hasOwnedRecords(owned: OwnedRecordSummary): boolean {
  return Object.values(owned).some((n) => n > 0);
}

/**
 * Hapus karyawan beserta data pribadinya (presensi, gaji, cuti, lembur, tugas, dll).
 * Dokumen perusahaan yang ia buat (invoice, pemasukan, pengajuan dana, MoM, surat aset, penalti yang ia input)
 * dialihkan ke `transferTo`, bukan dihapus, supaya pembukuan dan jurnal tetap utuh.
 */
export async function deleteUserWithRelations(nik: string, opts: { transferTo?: string } = {}) {
  const owned = await countOwnedRecords(nik);
  const transferTo = opts.transferTo?.trim() || null;

  if (hasOwnedRecords(owned)) {
    if (!transferTo) {
      throw new DeleteUserBlockedError(
        "Karyawan ini masih tercatat sebagai pembuat dokumen perusahaan. Pilih karyawan pengganti untuk mengalihkan dokumen tersebut.",
        "TRANSFER_REQUIRED",
        owned
      );
    }
    if (transferTo === nik) {
      throw new DeleteUserBlockedError("Karyawan pengganti tidak boleh orang yang sama.", "INVALID_TRANSFER");
    }
    const successor = await prisma.user.findUnique({ where: { nik: transferTo }, select: { nik: true } });
    if (!successor) {
      throw new DeleteUserBlockedError("Karyawan pengganti tidak ditemukan.", "INVALID_TRANSFER");
    }
  }

  const [activeLoans, pendingTransfers] = await Promise.all([
    prisma.assetLoan.count({ where: { borrowerId: nik, status: { not: "RETURNED" } } }),
    prisma.assetTransfer.count({ where: { toUserId: nik, status: "pending" } }),
  ]);
  if (activeLoans > 0 || pendingTransfers > 0) {
    throw new DeleteUserBlockedError(
      `Karyawan ini masih memegang aset (${activeLoans} surat pinjam aktif, ${pendingTransfers} serah terima menunggu). Selesaikan pengembalian aset dulu.`,
      "ACTIVE_ASSETS"
    );
  }

  await prisma.$transaction(async (tx) => {
    if (transferTo && hasOwnedRecords(owned)) {
      await tx.invoice.updateMany({ where: { createdBy: nik }, data: { createdBy: transferTo } });
      await tx.incomeEntry.updateMany({ where: { createdBy: nik }, data: { createdBy: transferTo } });
      await tx.fundRequest.updateMany({ where: { submittedBy: nik }, data: { submittedBy: transferTo } });
      await tx.momNote.updateMany({ where: { createdBy: nik }, data: { createdBy: transferTo } });
      await tx.assetLoan.updateMany({ where: { createdById: nik }, data: { createdById: transferTo } });
      await tx.assetTransfer.updateMany({ where: { createdById: nik }, data: { createdById: transferTo } });
      await tx.employeePenalty.updateMany({ where: { createdByNik: nik }, data: { createdByNik: transferTo } });
    }

    const attendanceIds = (
      await tx.attendance.findMany({
        where: { userId: nik },
        select: { id: true },
      })
    ).map((a) => a.id);

    const taskIdsFromAttendance =
      attendanceIds.length > 0
        ? (
            await tx.task.findMany({
              where: { attendanceId: { in: attendanceIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

    const taskIdsFromAssignee = (
      await tx.task.findMany({
        where: { assigneeId: nik },
        select: { id: true },
      })
    ).map((t) => t.id);

    const taskIdsFromAuthor = (
      await tx.taskProgress.findMany({
        where: { authorId: nik },
        select: { taskId: true },
      })
    ).map((p) => p.taskId);

    const taskIds = [...new Set([...taskIdsFromAttendance, ...taskIdsFromAssignee, ...taskIdsFromAuthor])];

    if (taskIds.length > 0) {
      await tx.taskProgress.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    }

    await tx.taskProgress.deleteMany({ where: { authorId: nik } });
    await tx.task.deleteMany({ where: { assigneeId: nik } });
    await tx.attendanceCorrection.updateMany({
      where: { attendanceId: { in: attendanceIds } },
      data: { attendanceId: null },
    });
    await tx.attendance.deleteMany({ where: { userId: nik } });
    await tx.leaveRequest.deleteMany({ where: { userId: nik } });
    await tx.userSalary.deleteMany({ where: { userId: nik } });
    await tx.overtime.deleteMany({ where: { userId: nik } });
    await tx.employeePenalty.deleteMany({ where: { userId: nik } });
    await tx.assetLoan.deleteMany({ where: { borrowerId: nik } });
    await tx.assetTransfer.deleteMany({ where: { toUserId: nik } });

    await tx.onboardingTask.deleteMany({ where: { userId: nik } });
    await tx.employmentContract.deleteMany({ where: { userId: nik } });
    await tx.businessTrip.deleteMany({ where: { userId: nik } });
    await tx.performanceReview.deleteMany({ where: { userId: nik } });
    await tx.bpjsEnrollment.deleteMany({ where: { userId: nik } });
    await tx.pph21Profile.deleteMany({ where: { userId: nik } });
    await tx.exitRequest.deleteMany({ where: { userId: nik } });

    await tx.asset.updateMany({ where: { userId: nik }, data: { userId: null } });
    await tx.user.updateMany({ where: { supervisorId: nik }, data: { supervisorId: null } });
    await tx.department.updateMany({ where: { headNik: nik }, data: { headNik: null } });

    await tx.user.delete({ where: { nik } });
  });
}
