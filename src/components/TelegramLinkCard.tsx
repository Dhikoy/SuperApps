"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type LinkState = {
  configured: boolean;
  botUsername: string | null;
  linked: boolean;
  telegramUsername: string | null;
  telegramLinkedAt: string | null;
};

export function TelegramLinkCard() {
  const { showToast } = useToast();
  const [state, setState] = useState<LinkState | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeInfo, setCodeInfo] = useState<{ code: string; deepLink: string | null; expiresAt: string } | null>(
    null
  );

  async function load() {
    const res = await fetch("/api/telegram/link");
    if (!res.ok) return;
    setState(await res.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function createLink() {
    setLoading(true);
    const res = await fetch("/api/telegram/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      showToast(data.error ?? "Gagal membuat kode", "error");
      return;
    }
    setCodeInfo({
      code: data.code,
      deepLink: data.deepLink,
      expiresAt: data.expiresAt,
    });
    showToast("Kode dibuat — buka bot dalam 10 menit", "success");
  }

  async function unlink() {
    if (!confirm("Putuskan tautan Telegram?")) return;
    setLoading(true);
    const res = await fetch("/api/telegram/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlink" }),
    });
    setLoading(false);
    if (!res.ok) {
      showToast("Gagal unlink", "error");
      return;
    }
    setCodeInfo(null);
    showToast("Telegram diputus", "success");
    load();
  }

  if (!state) {
    return (
      <div className="rounded-xl border bg-white p-5 sm:p-6 max-w-xl text-sm text-slate-500">
        Memuat status Telegram...
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-5 sm:p-6 max-w-xl space-y-3">
      <h2 className="font-semibold text-slate-900">Telegram</h2>
      <p className="text-sm text-slate-500">
        Notifikasi lembur/cuti/slip, reminder absensi, approve di chat, dan clock-in/out via bot.
        Website tetap bisa dipakai untuk semua fitur.
      </p>

      {!state.configured ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Bot belum dikonfigurasi di server. Hubungi admin IT.
        </p>
      ) : state.linked ? (
        <div className="space-y-2">
          <p className="text-sm text-emerald-700">
            Terhubung{state.telegramUsername ? ` sebagai @${state.telegramUsername}` : ""}.
          </p>
          {state.botUsername && (
            <a
              href={`https://t.me/${state.botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 font-medium"
            >
              Buka bot @{state.botUsername}
            </a>
          )}
          <button type="button" disabled={loading} onClick={unlink} className="btn-secondary text-sm">
            Putuskan tautan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">
            <li>Buat kode tautan di bawah</li>
            <li>Buka link bot (atau kirim <code className="text-xs bg-slate-100 px-1 rounded">/start KODE</code>)</li>
            <li>Selesai — notifikasi masuk ke Telegram Anda</li>
          </ol>
          <button type="button" disabled={loading} onClick={createLink} className="btn-primary text-sm">
            {loading ? "Memproses..." : "Hubungkan Telegram"}
          </button>
          {codeInfo && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
              <p>
                Kode: <span className="font-mono font-bold text-lg tracking-wider">{codeInfo.code}</span>
              </p>
              <p className="text-xs text-slate-500">
                Berlaku sampai {new Date(codeInfo.expiresAt).toLocaleTimeString("id-ID")}
              </p>
              {codeInfo.deepLink ? (
                <a href={codeInfo.deepLink} target="_blank" rel="noreferrer" className="btn-primary inline-block text-xs">
                  Buka Telegram & hubungkan
                </a>
              ) : (
                <p className="text-xs">Di bot kirim: /start {codeInfo.code}</p>
              )}
            </div>
          )}
        </div>
      )}

      <a href="/dashboard/bantuan/telegram" className="text-xs text-slate-500 underline block">
        Baca tata cara lengkap
      </a>
    </div>
  );
}
