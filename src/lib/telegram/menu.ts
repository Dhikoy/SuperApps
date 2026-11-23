import { hasPermission, type Role } from "@/lib/roles";
import { sendTelegramMessage, type TelegramSendOpts } from "@/lib/telegram/client";

export function mainMenuKeyboard(role: Role): NonNullable<TelegramSendOpts["reply_markup"]> {
  const rows: { text: string; callback_data: string }[][] = [
    [
      { text: "⏰ Clock In", callback_data: "menu:clockin" },
      { text: "🏠 Clock Out", callback_data: "menu:clockout" },
    ],
    [
      { text: "📋 Hari ini", callback_data: "menu:hariini" },
      { text: "📊 Status", callback_data: "menu:status" },
    ],
    [
      { text: "🌴 Ajukan cuti", callback_data: "menu:cuti" },
      { text: "🕒 Ajukan lembur", callback_data: "menu:lembur" },
    ],
    [
      { text: "🌴 Sisa cuti", callback_data: "menu:sisacuti" },
      { text: "🧾 Slip", callback_data: "menu:slip" },
    ],
    [
      { text: "✅ Onboarding", callback_data: "menu:onboarding" },
      { text: "📌 Task saya", callback_data: "menu:tasks" },
    ],
  ];

  rows.push([
    { text: "✏️ Koreksi absen", callback_data: "menu:koreksi" },
    { text: "⏰ Izin terlambat", callback_data: "menu:izintelat" },
  ]);
  rows.push([
    { text: "📅 Jadwal", callback_data: "menu:jadwal" },
    { text: "✈️ Dinas", callback_data: "menu:dinas" },
  ]);
  rows.push([
    { text: "📝 Progress task", callback_data: "menu:taskprog" },
    { text: "💰 Ajukan dana", callback_data: "menu:dana" },
  ]);

  if (
    hasPermission(role, "leave:approve_atasan") ||
    hasPermission(role, "leave:approve_hrd") ||
    hasPermission(role, "payroll:manage") ||
    hasPermission(role, "finance:approve") ||
    hasPermission(role, "hr:manage")
  ) {
    rows.push([{ text: "⏳ Pending approval", callback_data: "menu:pending" }]);
  }
  if (hasPermission(role, "finance:pay")) {
    rows.push([{ text: "💳 Bayar dana + bukti", callback_data: "menu:bayardana" }]);
  }
  if (role === "SUPER_ADMIN" || hasPermission(role, "hr:manage")) {
    rows.push([{ text: "📊 Laporan mingguan", callback_data: "menu:laporan" }]);
  }
  if (hasPermission(role, "hr:manage")) {
    rows.push([{ text: "📢 Broadcast HRD", callback_data: "menu:broadcast" }]);
  }

  rows.push([{ text: "❓ Bantuan", callback_data: "menu:help" }]);
  return { inline_keyboard: rows };
}

export async function sendMainMenu(chatId: string, role: Role, name: string) {
  await sendTelegramMessage(
    chatId,
    `Halo ${name} 👋\nPilih menu di bawah, atau ketik perintah.\nWebsite tetap bisa dipakai untuk semua fitur.`,
    { reply_markup: mainMenuKeyboard(role) }
  );
}
