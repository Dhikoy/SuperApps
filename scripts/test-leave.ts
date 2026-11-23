import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
console.log("DB URL:", url);
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const { ApprovalStatus } = await import("../src/generated/prisma/enums");
    const rows = await prisma.leaveRequest.findMany({
      where: {
        approvalStatus: { in: [ApprovalStatus.PENDING, ApprovalStatus.ATASAN_APPROVED] },
      },
    });
    console.log("filtered OK", rows.length);
  } catch (e: unknown) {
    console.error("filter ERR:", e instanceof Error ? e.message : e);
  }
  try {
    const rows = await prisma.leaveRequest.findMany({
      include: { user: { select: { name: true } } },
    });
    console.log("OK", rows.length, "rows");
    rows.forEach((r) => console.log(r.leaveType, r.approvalStatus, r.user.name));
  } catch (e: unknown) {
    console.error("ERR:", e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
