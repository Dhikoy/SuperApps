import { prisma } from "@/lib/prisma";
import { getJakartaTodayStart } from "@/lib/timezone";

type AttendanceLike = {
  id: string;
  userId: string;
  date: Date | string;
  clockInTime?: string | null;
  clockOutTime?: string | null;
  status?: string;
  createdAt?: Date;
};

const STATUS_SCORE: Record<string, number> = {
  HADIR: 4,
  TERLAMBAT: 3,
  IZIN: 2,
  ALPHA: 1,
};

function dayKey(userId: string, date: Date | string) {
  const d = getJakartaTodayStart(typeof date === "string" ? new Date(date) : date);
  return `${userId}:${d.getTime()}`;
}

function scoreRecord(record: AttendanceLike): number {
  let score = 0;
  if (record.clockInTime) score += 100;
  if (record.clockOutTime) score += 10;
  score += STATUS_SCORE[record.status ?? ""] ?? 0;
  if (record.createdAt) score += record.createdAt.getTime() / 1e15;
  return score;
}

/** Simpan 1 record terbaik per karyawan per hari */
export function dedupeAttendanceRows<T extends AttendanceLike>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = dayKey(row.userId, row.date);
    const current = best.get(key);
    if (!current || scoreRecord(row) > scoreRecord(current)) {
      best.set(key, row);
    }
  }
  return Array.from(best.values());
}

/** Hapus duplikat di database — jalankan sebelum unique constraint */
export async function dedupeAttendanceRecords() {
  const all = await prisma.attendance.findMany({
    select: {
      id: true,
      userId: true,
      date: true,
      clockInTime: true,
      clockOutTime: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Normalisasi tanggal ke 00:00 WIB
  for (const row of all) {
    const normalized = getJakartaTodayStart(row.date);
    if (row.date.getTime() !== normalized.getTime()) {
      await prisma.attendance.update({
        where: { id: row.id },
        data: { date: normalized },
      });
      row.date = normalized;
    }
  }

  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const key = dayKey(row.userId, row.date);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const deleteIds: string[] = [];
  for (const records of groups.values()) {
    if (records.length <= 1) continue;
    const keeper = records.reduce((a, b) => (scoreRecord(a) >= scoreRecord(b) ? a : b));
    const normalized = getJakartaTodayStart(keeper.date);
    if (keeper.date.getTime() !== normalized.getTime()) {
      await prisma.attendance.update({
        where: { id: keeper.id },
        data: { date: normalized },
      });
    }
    for (const record of records) {
      if (record.id !== keeper.id) deleteIds.push(record.id);
    }
  }

  if (deleteIds.length > 0) {
    await prisma.attendance.deleteMany({ where: { id: { in: deleteIds } } });
  }

  return deleteIds.length;
}
