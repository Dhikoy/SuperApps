"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INPUT_CLASS, PageHeader } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichTextView } from "@/components/RichTextView";
import { canManageMomNotes } from "@/lib/roles";
import { plainTextFromHtml } from "@/lib/rich-text";

type MomNote = {
  id: string;
  title: string;
  content: string;
  meetingDate: string;
  createdAt: string;
  creator: { nik: string; name: string; userId: string };
};

function todayJakartaInput() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toDateInput(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default function MomNotesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<MomNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [meetingDate, setMeetingDate] = useState(todayJakartaInput);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/mom-notes");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error ?? "Gagal memuat catatan", "error");
      setItems([]);
      return;
    }
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    void (async () => {
      await load();
      let manage = false;
      try {
        const r = await fetch("/api/auth/session");
        const d = await r.json();
        manage = canManageMomNotes(d.role ?? "");
        setCanManage(manage);
      } catch {
        setCanManage(false);
      }
      const editId = new URLSearchParams(window.location.search).get("edit");
      if (editId && manage) {
        const res = await fetch("/api/mom-notes");
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.items) ? (data.items as MomNote[]) : [];
        const note = list.find((n) => n.id === editId);
        if (note) {
          setEditingId(note.id);
          setTitle(note.title);
          setContent(note.content);
          setMeetingDate(toDateInput(note.meetingDate));
          setExpandedId(note.id);
        }
      }
    })();
  }, []);

  function resetForm() {
    setTitle("");
    setContent("");
    setMeetingDate(todayJakartaInput());
    setEditingId(null);
  }

  function startEdit(n: MomNote) {
    setEditingId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setMeetingDate(toDateInput(n.meetingDate));
    setExpandedId(n.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (plainTextFromHtml(content).length < 5) {
      showToast("Isi catatan wajib diisi", "error");
      return;
    }
    setLoading(true);

    const isEdit = Boolean(editingId);
    const res = await fetch("/api/mom-notes", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEdit
          ? { id: editingId, title, content, meetingDate }
          : { title, content, meetingDate }
      ),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      showToast(data.error ?? "Gagal menyimpan", "error");
      return;
    }
    showToast(isEdit ? "Catatan MOM diperbarui" : "Catatan MOM disimpan", "success");
    resetForm();
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus catatan ini?")) return;
    const res = await fetch(`/api/mom-notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error ?? "Gagal menghapus", "error");
      return;
    }
    showToast("Catatan dihapus", "success");
    if (editingId === id) resetForm();
    load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Catatan MOM"
        subtitle="Minutes of Meeting — judul, tanggal, dan isi lengkap"
      />
      <Link href="/dashboard/information" className="text-sm text-blue-600 hover:underline">
        ← Information
      </Link>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
      >
        {editingId && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            <span>Mode edit catatan</span>
            <button type="button" onClick={resetForm} className="font-semibold underline">
              Batal
            </button>
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-slate-500">Judul catatan</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Contoh: MoM Evaluasi Operasional LBB"
            required
            minLength={3}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">
            Tanggal rapat (otomatis hari ini)
          </label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Isi catatan lengkap</label>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Ringkasan diskusi, keputusan, action item..."
            minHeight={180}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
            {loading ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Catatan"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Daftar catatan</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic rounded-xl border border-dashed border-slate-200 p-6 text-center">
            Belum ada catatan MOM
          </p>
        ) : (
          items.map((n) => {
            const open = expandedId === n.id;
            return (
              <div key={n.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex gap-3 items-start"
                  onClick={() => setExpandedId(open ? null : n.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(n.meetingDate).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "Asia/Jakarta",
                      })}
                      {" · "}
                      {n.creator.name}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <RichTextView html={n.content} />
                    {canManage && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(n)}
                          className="text-xs font-medium text-[#503200] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(n.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
