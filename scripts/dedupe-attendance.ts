#!/usr/bin/env tsx
import "dotenv/config";
import { dedupeAttendanceRecords } from "../src/lib/attendance-dedupe";

async function main() {
  const deleted = await dedupeAttendanceRecords();
  console.log(`==> Hapus ${deleted} presensi duplikat`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
