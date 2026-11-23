#!/usr/bin/env tsx
/**
 * Sync presensi: cuti APPROVED → IZIN, hari kerja tanpa absen → ALPHA
 * Usage: npm run db:sync-attendance [-- --year=2026 --month=9]
 */
import "dotenv/config";
import { syncAllApprovedLeaves } from "../src/lib/leave-attendance-sync";
import { syncAlphaAttendance } from "../src/lib/attendance-alpha";
import { getCalendarMonthForDate } from "../src/lib/period";

async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find((a) => a.startsWith("--year="))?.split("=")[1];
  const monthArg = args.find((a) => a.startsWith("--month="))?.split("=")[1];
  const period = getCalendarMonthForDate();

  const year = yearArg ? parseInt(yearArg, 10) : period.year;
  const month = monthArg ? parseInt(monthArg, 10) : period.month;

  console.log("==> Sync cuti disetujui → IZIN...");
  const leaveResult = await syncAllApprovedLeaves();
  console.log(`    ${leaveResult.leaves} cuti, ${leaveResult.synced} hari disync`);

  console.log(`==> Sync ALPHA periode ${month}/${year}...`);
  const alphaResult = await syncAlphaAttendance({ year, month });
  console.log(`    ${alphaResult.created} record ALPHA dibuat`);

  console.log("Selesai.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
