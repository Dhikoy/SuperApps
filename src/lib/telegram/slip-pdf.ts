import { jsPDF } from "jspdf";
import { getPeriodForDate, formatPeriodLabel } from "@/lib/period";
import { loadUserPayrollItem } from "@/lib/payroll-data";
import { sendTelegramDocument, sendTelegramMessage, appBaseUrl } from "@/lib/telegram/client";

async function loadSlipItem(userNik: string, year: number, month: number) {
  const loaded = await loadUserPayrollItem(userNik, year, month);
  return loaded ? { ...loaded, periodLabel: formatPeriodLabel(year, month) } : null;
}

export async function sendSlipPdf(userNik: string, chatId: string) {
  const period = getPeriodForDate();
  const loaded = await loadSlipItem(userNik, period.year, period.month);
  if (!loaded) {
    await sendTelegramMessage(chatId, "Akun tidak ditemukan.");
    return;
  }
  const { user, item, periodLabel } = loaded;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text("Slip Gaji — SuperApps BCI", 14, 20);
  doc.setFontSize(11);
  doc.text(`Periode: ${periodLabel}`, 14, 30);
  doc.text(`Nama: ${user.name}`, 14, 38);
  doc.text(`NIK: ${user.nik}`, 14, 46);
  doc.text(`PT: ${user.company ?? "-"}`, 14, 54);
  doc.text(`Gaji pokok: Rp ${Math.round(item.gajiPokok).toLocaleString("id-ID")}`, 14, 66);
  doc.text(`Gaji periode: Rp ${Math.round(item.gajiPeriod).toLocaleString("id-ID")}`, 14, 74);
  const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
  const lines: [string, number][] = [
    ["Lembur", item.overtime.tunjanganLembur],
    ["Tunjangan", item.adjustment.allowance],
    ["Uang makan", item.adjustment.mealAllowance],
    ["Potongan denda", -item.penalty.amount],
    ["Potongan lain", -item.adjustment.deduction],
  ];
  let y = 82;
  for (const [label, amount] of lines) {
    if (label !== "Lembur" && !amount) continue;
    doc.text(`${label}: ${amount < 0 ? "-" : ""}${rp(Math.abs(amount))}`, 14, y);
    y += 8;
  }
  doc.setFontSize(12);
  doc.text(`TOTAL: ${rp(item.totalGaji)}`, 14, y + 4);
  doc.setFontSize(9);
  doc.text(`Dokumen ringkas bot. Cetak lengkap: ${appBaseUrl()}/dashboard/profil`, 14, y + 20);

  const buf = Buffer.from(doc.output("arraybuffer"));
  const filename = `slip-${user.userId}-${period.year}-${period.month}.pdf`;
  const ok = await sendTelegramDocument(chatId, filename, buf, `Slip ${periodLabel}`);
  if (!ok) {
    await sendTelegramMessage(
      chatId,
      `Slip ${periodLabel}\nTotal: Rp ${Math.round(item.totalGaji).toLocaleString("id-ID")}\n(PDF gagal dikirim — buka web)`
    );
  }
}
