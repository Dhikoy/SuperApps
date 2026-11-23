"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "Keuntungan tiap perusahaan",
  "Presensi hari ini",
  "Cuti menunggu",
  "Catatan MOM",
];

type Chat = { role: "user" | "assistant"; text: string };

export function AntaWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Chat[]>([
    {
      role: "assistant",
      text: "Hai, saya Anta. Tanya keuntungan perusahaan, presensi, cuti, MOM, invoice, atau karyawan.",
    },
  ]);
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
    <div className="fixed z-50 right-4 bottom-[5.25rem] lg:bottom-6 lg:right-6 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[min(70vh,520px)] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 bg-[#503200] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7c200] text-sm font-black text-[#503200]">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">Anta</p>
              <p className="text-[11px] text-white/75">Asisten BCI</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-lg leading-none text-white/80 hover:bg-white/10"
              aria-label="Tutup Anta"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-[#faf8f4] p-3">
            {messages.map((item, index) => (
              <div
                key={index}
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  item.role === "user"
                    ? "ml-auto bg-[#503200] text-white"
                    : "bg-white text-slate-800 border border-slate-200"
                }`}
              >
                {item.text}
              </div>
            ))}
            {loading && <p className="text-xs text-slate-400">Anta sedang mencari data...</p>}
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => ask(item)}
                className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#503200]"
              >
                {item}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-slate-100 bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tanya Anta..."
              className="input-field min-w-0 flex-1"
            />
            <button type="submit" disabled={loading} className="btn-primary shrink-0 px-3">
              Kirim
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full bg-[#503200] py-3 pl-3 pr-4 text-white shadow-lg hover:bg-[#3d2600]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7c200] text-sm font-black text-[#503200]">
          A
        </span>
        <span className="text-sm font-semibold">Anta</span>
      </button>
    </div>
  );
}
