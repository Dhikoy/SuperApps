"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";

const SUGGESTIONS = [
  "Keuntungan dan pengeluaran setiap perusahaan bulan ini",
  "Presensi hari ini",
  "Cuti yang menunggu",
  "Catatan MOM",
  "Invoice terbaru",
  "Daftar karyawan",
];

type Chat = { role: "user" | "assistant"; text: string };

export default function AsistenPage() {
  const [messages, setMessages] = useState<Chat[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setLoading(true);
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: res.ok ? String(data.answer ?? "") : String(data.error ?? "Gagal menjawab"),
      },
    ]);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Asisten AI"
        subtitle="Gratis untuk semua user yang login. Jawaban diambil dari data SuperApps sesuai role Anda."
      />

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => ask(item)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[#503200]"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="min-h-[280px] space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">Pilih contoh di atas, atau ketik pertanyaan.</p>
        )}
        {messages.map((item, index) => (
          <div
            key={index}
            className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
              item.role === "user" ? "bg-[#503200] text-white" : "bg-slate-50 text-slate-800"
            }`}
          >
            {item.text}
          </div>
        ))}
        {loading && <p className="text-sm text-slate-400">Mencari data...</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tanya keuntungan perusahaan, presensi, MOM..."
          className="input-field flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary shrink-0">
          Tanya
        </button>
      </form>
    </div>
  );
}
