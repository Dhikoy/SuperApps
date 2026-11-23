/**
 * Sinkron karyawan & gaji pokok dari Google Sheet "PAYROLL" (tab HR).
 * - Karyawan yang belum ada ditambahkan (PT, jabatan, tanggal masuk dari catatan); yang sudah ada tidak diubah.
 * - Gaji pokok = kolom "Estimasi Gaji Real"; bila kosong/0 (hari kerja belum diisi) memakai kolom "Gaji Pokok".
 * Usage: npx tsx scripts/import-payroll-sheet.ts [--dry] [csv-path|sheet-url]
 */
import "dotenv/config";
import fs from "fs";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { generateNextNik, uniqueUserIdFromName } from "../src/lib/nik";

const DEFAULT_SOURCE =
  "https://docs.google.com/spreadsheets/d/16rzJfvLP7NdlNvonzqd9Fax6GT5WkFCQrM6weHbjrE8/export?format=csv&gid=2015628032";

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function rupiah(value: string | undefined) {
  const digits = (value ?? "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

/** "Ramdani ( Adam )" → "ramdani", "Leonydas Cannavaro dkk" → "leonydas cannavaro". */
function nameKey(name: string) {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bdkk\.?\s*$/i, " ")
    .replace(/^dr\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanName(name: string) {
  return name.replace(/\s+dkk\.?\s*$/i, "").replace(/\s+/g, " ").trim();
}

function joinDateFrom(cells: string[], year: number) {
  for (const cell of cells) {
    const m = /tanggal\s+masuk\s+(\d{1,2})\s+([a-z]+)/i.exec(cell);
    if (m && MONTHS[m[2].toLowerCase()]) {
      const month = MONTHS[m[2].toLowerCase()];
      return new Date(`${year}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    }
  }
  return null;
}

async function loadCsv(source: string) {
  if (!/^https?:\/\//.test(source)) return fs.readFileSync(source, "utf8");
  const res = await fetch(source);
  if (!res.ok) throw new Error(`Gagal mengambil sheet: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const source = args.find((a) => !a.startsWith("--")) ?? DEFAULT_SOURCE;
  const rows = parseCsv(await loadCsv(source));

  const header = rows.findIndex((r) => r[3]?.trim() === "Nama Karyawan");
  if (header < 0) throw new Error("Kolom 'Nama Karyawan' tidak ditemukan — format sheet berubah?");
  const col = (label: string) => rows[header].findIndex((c) => c.trim().toLowerCase() === label.toLowerCase());
  const C = {
    period: col("Periode (Bln-Thn)"),
    company: col("PT"),
    name: col("Nama Karyawan"),
    title: col("Jabatan"),
    base: col("Gaji Pokok"),
    real: col("Estimasi Gaji Real"),
  };
  if (Object.values(C).some((i) => i < 0)) throw new Error(`Kolom wajib tidak lengkap: ${JSON.stringify(C)}`);

  const entries = rows
    .slice(header + 1)
    .filter((r) => /^\d+$/.test(r[0]?.trim() ?? "") && r[C.name]?.trim())
    .map((r) => {
      const year = Number(/\d{4}/.exec(r[C.period] ?? "")?.[0] ?? new Date().getFullYear());
      const real = rupiah(r[C.real]);
      const base = rupiah(r[C.base]);
      return {
        name: cleanName(r[C.name]),
        key: nameKey(r[C.name]),
        company: r[C.company].trim().toUpperCase(),
        jobTitle: r[C.title].trim(),
        salary: real > 0 ? real : base,
        fromBase: !(real > 0),
        joinDate: joinDateFrom(r, year),
      };
    });

  const users = await prisma.user.findMany({
    select: {
      nik: true,
      name: true,
      userId: true,
      company: true,
      salaries: { orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }], take: 1, select: { gajiPokok: true } },
    },
  });
  const byKey = new Map(users.map((u) => [nameKey(u.name), u]));
  const usedUserIds = new Set(users.map((u) => u.userId));
  const password = await bcrypt.hash("password123", 10);

  let created = 0;
  let salaryChanged = 0;
  const notes: string[] = [];

  for (const e of entries) {
    let user = byKey.get(e.key);
    if (!user) {
      const nik = await generateNextNik(e.company);
      const userId = uniqueUserIdFromName(e.name.replace(/^dr\.?\s+/i, ""), usedUserIds);
      console.log(`+ BARU   ${e.name} | ${e.company} | ${e.jobTitle} | NIK ${nik} | login ${userId} | masuk ${e.joinDate?.toISOString().slice(0, 10) ?? "-"}`);
      if (!dry) {
        await prisma.user.create({
          data: {
            nik,
            userId,
            name: e.name,
            password,
            mustChangePassword: true,
            role: "STAFF",
            company: e.company,
            jobTitle: e.jobTitle || "Staff",
            joinDate: e.joinDate,
          },
        });
      }
      user = { nik, name: e.name, userId, company: e.company, salaries: [] };
      byKey.set(e.key, user);
      created++;
    } else if ((user.company ?? "") !== e.company) {
      notes.push(`${user.name}: PT di sistem ${user.company ?? "-"}, di sheet ${e.company} (tidak diubah)`);
    }

    const current = user.salaries[0]?.gajiPokok ?? null;
    if (current === e.salary) continue;
    console.log(
      `~ GAJI   ${user.name.padEnd(42)} ${current === null ? "(belum ada)" : current.toLocaleString("id-ID")} → ${e.salary.toLocaleString("id-ID")}${e.fromBase ? "  [estimasi kosong, pakai gaji pokok]" : ""}`
    );
    if (!dry && e.salary > 0) {
      await prisma.userSalary.create({ data: { userId: user.nik, gajiPokok: e.salary } });
    }
    salaryChanged++;
  }

  const sheetKeys = new Set(entries.map((e) => e.key));
  for (const u of users) {
    if (!sheetKeys.has(nameKey(u.name))) notes.push(`${u.name} (${u.company ?? "-"}) ada di sistem tapi tidak ada di sheet (dibiarkan)`);
  }

  console.log(`\n${dry ? "[DRY RUN] " : ""}${entries.length} baris sheet: ${created} karyawan baru, ${salaryChanged} gaji pokok diperbarui.`);
  if (created && !dry) console.log("Password awal akun baru: password123 (wajib ganti saat login pertama)");
  if (notes.length) console.log(`\nCatatan:\n- ${notes.join("\n- ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
