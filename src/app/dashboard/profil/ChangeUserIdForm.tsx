"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INPUT_CLASS } from "@/components/ui";

export function ChangeUserIdForm({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const [newUserId, setNewUserId] = useState(currentUserId);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newUserId.trim().toLowerCase() === currentUserId) {
      setError("User ID sama dengan yang sekarang");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/user-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUserId: newUserId.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengubah User ID");
        return;
      }
      setSuccess(`User ID berhasil diubah menjadi @${data.userId}`);
      setPassword("");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">User ID baru (untuk login)</label>
        <input
          type="text"
          value={newUserId}
          onChange={(e) => setNewUserId(e.target.value.toLowerCase())}
          className={`${INPUT_CLASS} font-mono`}
          placeholder="contoh: muhammad.rijal"
          autoComplete="username"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          3–30 karakter — huruf, angka, titik (.), garis bawah (_). Contoh: <code>muhammad.rijal</code>,{" "}
          <code>babas</code>
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Password (konfirmasi)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Menyimpan..." : "Simpan User ID"}
      </button>
    </form>
  );
}
