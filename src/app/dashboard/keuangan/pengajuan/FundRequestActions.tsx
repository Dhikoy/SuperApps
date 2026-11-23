"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FundRequestActions({
  id,
  status,
  canEdit,
}: {
  id: string;
  status: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  if (!canEdit || status !== "PENDING") return null;

  async function handleDelete() {
    if (!confirm("Hapus pengajuan ini?")) return;
    const res = await fetch(`/api/finance/requests/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Gagal menghapus");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/dashboard/keuangan/pengajuan/baru?edit=${encodeURIComponent(id)}`}
        className="text-xs font-semibold text-[#503200] hover:underline"
      >
        Edit
      </a>
      <button type="button" onClick={handleDelete} className="text-xs font-semibold text-red-600 hover:underline">
        Hapus
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
