import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { SessionUser } from "@/lib/auth";
import {
  answerCuti,
  answerDokumen,
  answerKaryawan,
  answerKeuangan,
  answerMom,
  answerPresensi,
  answerSiapaSaya,
} from "@/lib/assistant/answer";

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

export function createSuperAppsMcp(session: SessionUser) {
  const server = new McpServer({
    name: "superapps-bci",
    version: "1.0.0",
  });

  server.registerTool(
    "siapa_saya",
    { title: "Siapa saya", description: "Identitas dan role akun.", inputSchema: {} },
    async () => text(await answerSiapaSaya(session))
  );

  server.registerTool(
    "ringkasan_keuangan",
    {
      title: "Keuntungan dan pengeluaran per perusahaan",
      description: "Pendapatan, pengeluaran, dan laba tiap perusahaan pada satu periode.",
      inputSchema: {
        year: z.number().int().optional(),
        month: z.number().int().min(1).max(12).optional(),
        company: z.string().optional(),
      },
    },
    async ({ year, month, company }) => text(await answerKeuangan(session, year, month, company))
  );

  server.registerTool(
    "presensi_hari_ini",
    { title: "Presensi hari ini", description: "Clock in/out hari ini.", inputSchema: {} },
    async () => text(await answerPresensi(session))
  );

  server.registerTool(
    "cuti_menunggu",
    { title: "Cuti menunggu", description: "Pengajuan cuti yang belum selesai.", inputSchema: {} },
    async () => text(await answerCuti(session))
  );

  server.registerTool(
    "catatan_mom",
    {
      title: "Catatan MOM",
      description: "Minutes of Meeting terbaru.",
      inputSchema: { limit: z.number().int().min(1).max(20).optional() },
    },
    async ({ limit }) => text(await answerMom(session, limit))
  );

  server.registerTool(
    "dokumen_keuangan",
    {
      title: "Invoice, kwitansi, pengajuan dana",
      description: "Dokumen keuangan terbaru.",
      inputSchema: {
        company: z.string().optional(),
        limit: z.number().int().min(1).max(30).optional(),
      },
    },
    async ({ company, limit }) => text(await answerDokumen(session, company, limit))
  );

  server.registerTool(
    "daftar_karyawan",
    {
      title: "Daftar karyawan",
      description: "Nama, perusahaan, jabatan, dan role.",
      inputSchema: { company: z.string().optional() },
    },
    async ({ company }) => text(await answerKaryawan(session, company))
  );

  server.registerPrompt(
    "keuntungan_pengeluaran_perusahaan",
    {
      title: "Keuntungan dan pengeluaran setiap perusahaan",
      description: "Ringkasan laba, pendapatan, dan pengeluaran per PT.",
      argsSchema: {
        year: z.string().optional(),
        month: z.string().optional(),
      },
    },
    async ({ year, month }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Ringkas keuntungan dan pengeluaran setiap perusahaan${year ? ` tahun ${year}` : ""}${month ? ` bulan ${month}` : " bulan ini"}. Sebutkan PT paling untung dan pengeluaran terbesar.`,
          },
        },
      ],
    })
  );

  return server;
}
