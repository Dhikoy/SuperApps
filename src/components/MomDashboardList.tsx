"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { RichTextView } from "@/components/RichTextView";

type MomItem = {
  id: string;
  title: string;
  content: string;
  meetingDate: string;
  creatorName: string;
};

export function MomDashboardList({
  notes,
  canManage,
}: {
  notes: MomItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  async function handleDelete(id: string) {
    if (!confirm("Hapus catatan ini?")) return;
    const res = await fetch(`/api/mom-notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error ?? "Gagal menghapus", "error");
      return;
    }
    showToast("Catatan dihapus", "success");
    router.refresh();
  }

  if (notes.length === 0) {
    return <p className="text-sm text-slate-400 italic">Belum ada catatan MOM</p>;
  }

  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-900">{n.title}</p>
            <p className="text-xs text-slate-500">
              {new Date(n.meetingDate).toLocaleDateString("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Jakarta",
              })}
              {" · "}
              {n.creatorName}
            </p>
          </div>
          <div className="mt-2">
            <RichTextView html={n.content} />
          </div>
          {canManage && (
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href={`/dashboard/information/mom?edit=${encodeURIComponent(n.id)}`}
                className="text-xs font-medium text-[#503200] hover:underline"
              >
                Edit
              </a>
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Hapus
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
