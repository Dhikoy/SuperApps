"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalActions({
  leaveId,
  stageLabel,
}: {
  leaveId: string;
  stageLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    await fetch(`/api/leave/${leaveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-xs text-slate-500 mb-3">Tahap persetujuan: {stageLabel}</p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading === "approve" ? "..." : "Setujui"}
        </button>
        <button
          onClick={() => handleAction("reject")}
          disabled={loading !== null}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loading === "reject" ? "..." : "Tolak"}
        </button>
      </div>
    </div>
  );
}
