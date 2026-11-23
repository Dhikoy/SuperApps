import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { getJakartaTodayStart } from "@/lib/timezone";
import { plainTextFromHtml } from "@/lib/rich-text";
import { formatRupiah } from "@/lib/payroll-policy";
import { companyFinanceReport } from "@/lib/mcp/company-finance";
import { DEFAULT_COMPANIES } from "@/lib/companies";
import { FINANCE_DOC_TYPE_LABELS, type FinanceDocType } from "@/lib/invoice";

const MONTHS = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
];

export async function answerSiapaSaya(session: SessionUser) {
  return `${session.name} (${session.userId}) — role ${session.role}, NIK ${session.nik}`;
}

export async function answerKeuangan(session: SessionUser, year?: number, month?: number, company?: string) {
  if (!hasPermission(session.role, "finance:view")) return "Tidak punya akses untuk data keuangan.";
  const now = new Date();
  const report = await companyFinanceReport(year ?? now.getFullYear(), month ?? now.getMonth() + 1, company);
  const ranked = [...report.companies].sort((a, b) => b.laba - a.laba);
  const best = ranked[0];
  const spend = [...report.companies].sort((a, b) => b.totalKeluar - a.totalKeluar)[0];
  const extra =
    best && spend
      ? `\n\nPaling untung: ${best.company} (${formatRupiah(best.laba)}).\nPengeluaran terbesar: ${spend.company} (${formatRupiah(spend.totalKeluar)}).`
      : "";
  return report.lines + extra;
}

export async function answerPresensi(session: SessionUser) {
  const canAll = hasPermission(session.role, "attendance:view");
  const canSelf = hasPermission(session.role, "attendance:clock");
  if (!canAll && !canSelf) return "Tidak punya akses untuk data presensi.";
  const rows = await prisma.attendance.findMany({
    where: { date: getJakartaTodayStart(), ...(canAll ? {} : { userId: session.nik }) },
    include: { user: { select: { name: true, company: true } } },
    orderBy: { clockInTime: "asc" },
    take: 200,
  });
  if (rows.length === 0) return "Belum ada presensi hari ini.";
  return rows
    .map(
      (row) =>
        `${row.user.name} (${row.user.company ?? "-"}) ${row.clockInTime ?? "--:--"}–${row.clockOutTime ?? "--:--"} ${row.status}`
    )
    .join("\n");
}

export async function answerCuti(session: SessionUser) {
  if (!hasPermission(session.role, "leave:view") && !hasPermission(session.role, "leave:submit")) {
    return "Tidak punya akses untuk data cuti.";
  }
  const canReview =
    hasPermission(session.role, "leave:manage") ||
    hasPermission(session.role, "leave:approve_atasan") ||
    hasPermission(session.role, "leave:approve_hrd");
  const rows = await prisma.leaveRequest.findMany({
    where: {
      approvalStatus: { in: ["PENDING", "ATASAN_APPROVED"] },
      ...(canReview ? {} : { userId: session.nik }),
    },
    include: { user: { select: { name: true, company: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  if (rows.length === 0) return "Tidak ada cuti yang menunggu.";
  return rows
    .map((row) => {
      const start = row.startDate.toLocaleDateString("id-ID");
      const end = row.endDate.toLocaleDateString("id-ID");
      return `${row.user.name} (${row.user.company ?? "-"}) ${row.leaveType} ${start}–${end} [${row.approvalStatus}]`;
    })
    .join("\n");
}

export async function answerMom(session: SessionUser, limit = 5) {
  if (!hasPermission(session.role, "dashboard:view")) return "Tidak punya akses.";
  const notes = await prisma.momNote.findMany({
    include: { creator: { select: { name: true } } },
    orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  if (notes.length === 0) return "Belum ada catatan MOM.";
  return notes
    .map((note) => {
      const date = note.meetingDate.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
      return `${date} — ${note.title} (${note.creator.name})\n${plainTextFromHtml(note.content).slice(0, 800)}`;
    })
    .join("\n\n");
}

export async function answerDokumen(session: SessionUser, company?: string, limit = 15) {
  if (!hasPermission(session.role, "finance:view")) return "Tidak punya akses untuk dokumen keuangan.";
  const rows = await prisma.invoice.findMany({
    where: company ? { company: company.toUpperCase() } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  if (rows.length === 0) return "Belum ada dokumen keuangan.";
  return rows
    .map((row) => {
      const type = FINANCE_DOC_TYPE_LABELS[row.docType as FinanceDocType] ?? row.docType;
      const party = row.customerName || row.receivedFrom || row.subject || "-";
      return `${row.invoiceNumber} ${type} ${row.company} ${party} ${row.status} ${formatRupiah(row.totalAmount)}`;
    })
    .join("\n");
}

export async function answerKaryawan(session: SessionUser, company?: string) {
  if (!hasPermission(session.role, "users:view")) return "Tidak punya akses untuk daftar karyawan.";
  const users = await prisma.user.findMany({
    where: company ? { company: company.toUpperCase() } : {},
    select: {
      name: true,
      userId: true,
      role: true,
      company: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });
  if (users.length === 0) return "Tidak ada karyawan.";
  return users
    .map(
      (user) =>
        `${user.name} | ${user.userId} | ${user.company ?? "-"} | ${user.jobTitle ?? user.department?.name ?? "-"} | ${user.role}`
    )
    .join("\n");
}

function findCompany(text: string) {
  const upper = text.toUpperCase();
  return DEFAULT_COMPANIES.find((code) => new RegExp(`\\b${code}\\b`).test(upper));
}

function findPeriod(text: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) year = Number(yearMatch[1]);
  const monthName = MONTHS.findIndex((name) => text.includes(name));
  if (monthName >= 0) month = monthName + 1;
  if (text.includes("bulan lalu")) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return { year, month };
}

const HELP = `Saya asisten SuperApps. Tanyakan salah satu ini:
• Keuntungan dan pengeluaran setiap perusahaan
• Presensi hari ini
• Cuti yang menunggu
• Catatan MOM
• Invoice dan kwitansi
• Daftar karyawan`;

export async function answerAssistant(session: SessionUser, message: string) {
  const text = message.trim().toLowerCase();
  if (!text) return HELP;
  const company = findCompany(message);
  if (/siapa saya|akun saya|role saya/.test(text)) return answerSiapaSaya(session);
  if (/keuntungan|pengeluaran|laba|rugi|pendapatan|cash\s*flow|untung/.test(text)) {
    const period = findPeriod(text);
    return answerKeuangan(session, period.year, period.month, company);
  }
  if (/presensi|absen|clock|hadir hari ini|alpha/.test(text)) return answerPresensi(session);
  if (/cuti|izin/.test(text)) return answerCuti(session);
  if (/\bmom\b|notulen|rapat|minutes/.test(text)) return answerMom(session);
  if (/invoice|kwitansi|dokumen keuangan|pengajuan dana/.test(text)) return answerDokumen(session, company);
  if (/karyawan|pegawai|staff/.test(text)) return answerKaryawan(session, company);
  return HELP;
}
