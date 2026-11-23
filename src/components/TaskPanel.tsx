"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { INPUT_CLASS, StatusBadge } from "@/components/ui";
import {
  TASK_BOARD_COLUMNS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  emptyTaskForm,
  type TaskFormData,
  type TaskRow,
} from "@/lib/tasks-shared";
import { useCompanies } from "@/hooks/useCompanies";
import type { TaskStatus } from "@/generated/prisma/enums";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichTextView } from "@/components/RichTextView";
import { plainTextFromHtml } from "@/lib/rich-text";

type Employee = { nik: string; name: string; company: string };

type TaskPanelProps = {
  canManage: boolean;
  canViewAll: boolean;
  userNik: string;
};

type ModalState = { mode: "create" } | { mode: "task"; taskId: string } | null;

const UNASSIGNED = "__none__";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-[#503200] text-white shadow-sm"
      : "bg-white text-slate-700 ring-1 ring-[#e8dfd0] hover:bg-[#fdf6e8]"
  }`;
}

export function TaskPanel({ canManage, canViewAll, userNik }: TaskPanelProps) {
  const { companies } = useCompanies();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ptFilter, setPtFilter] = useState("");
  const [picFilter, setPicFilter] = useState("");

  const [quickTitle, setQuickTitle] = useState("");
  const [quickCompany, setQuickCompany] = useState("BCI");
  const [quickAssignee, setQuickAssignee] = useState("");

  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<TaskFormData>(emptyTaskForm("BCI"));
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [progressStatus, setProgressStatus] = useState<TaskStatus>("PROSES");
  const [progressSaving, setProgressSaving] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const loadTasks = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat task");
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat task");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!canManage) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEmployees(data);
      })
      .catch(() => {});
  }, [canManage]);

  useEffect(() => {
    if (companies.length > 0 && !companies.includes(quickCompany)) setQuickCompany(companies[0]);
  }, [companies, quickCompany]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const ptTasks = useMemo(
    () => (ptFilter ? tasks.filter((t) => t.company === ptFilter) : tasks),
    [tasks, ptFilter]
  );

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of ptTasks) if (t.assignee) map.set(t.assignee.nik, t.assignee.name);
    return [...map.entries()].map(([nik, name]) => ({ nik, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [ptTasks]);
  const hasUnassigned = ptTasks.some((t) => !t.assigneeId);

  const visibleTasks = useMemo(() => {
    if (!picFilter) return ptTasks;
    if (picFilter === UNASSIGNED) return ptTasks.filter((t) => !t.assigneeId);
    return ptTasks.filter((t) => t.assigneeId === picFilter);
  }, [ptTasks, picFilter]);

  const inProgress = visibleTasks.filter((t) => t.status === "PROSES" || t.status === "ON_PROSES").length;
  const done = visibleTasks.filter((t) => t.status === "DONE").length;

  const activeTask = modal?.mode === "task" ? tasks.find((t) => t.id === modal.taskId) ?? null : null;
  const formEmployees = employees.filter((e) => e.company === form.company);
  const quickEmployees = employees.filter((e) => e.company === quickCompany);

  function isAssignee(task: TaskRow) {
    return task.assigneeId === userNik;
  }

  function canMove(task: TaskRow) {
    return canManage || isAssignee(task);
  }

  function selectPt(pt: string) {
    setPtFilter(pt);
    setPicFilter("");
    if (pt) {
      setQuickCompany(pt);
      setQuickAssignee("");
    }
  }

  function openCreate() {
    setForm({
      ...emptyTaskForm(quickCompany),
      title: quickTitle.trim(),
      assigneeId: quickAssignee,
    });
    setModalError("");
    setModal({ mode: "create" });
  }

  function openTask(task: TaskRow) {
    setForm({
      title: task.title,
      description: task.description ?? "",
      company: task.company,
      status: task.status,
      assigneeId: task.assigneeId ?? "",
    });
    setProgressNote("");
    setProgressStatus(task.status === "ON_PROSES" ? "PROSES" : task.status);
    setModalError("");
    setModal({ mode: "task", taskId: task.id });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !modal) return;
    setSaving(true);
    setModalError("");
    try {
      const editing = modal.mode === "task";
      const res = await fetch(editing ? `/api/tasks/${modal.taskId}` : "/api/tasks", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan task");
      if (!editing) setQuickTitle("");
      setModal(null);
      await loadTasks();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Gagal menyimpan task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(task: TaskRow) {
    if (!canManage || !confirm(`Hapus task "${task.title}"?`)) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setModalError(data.error ?? "Gagal menghapus task");
      return;
    }
    setModal(null);
    await loadTasks();
  }

  async function handleProgressSubmit(task: TaskRow) {
    if (!plainTextFromHtml(progressNote).trim()) {
      setModalError("Catatan progress wajib diisi");
      return;
    }
    setProgressSaving(true);
    setModalError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: progressNote, status: progressStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan progress");
      setProgressNote("");
      await loadTasks();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Gagal menyimpan progress");
    } finally {
      setProgressSaving(false);
    }
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !canMove(task)) return;
    const column = TASK_BOARD_COLUMNS.find((c) => c.status === status);
    if (column?.includes.includes(task.status)) return;

    const previous = tasks;
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, status } : t)));
    setError("");
    const res = canManage
      ? await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      : await fetch(`/api/tasks/${taskId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: `Status dipindah ke ${TASK_STATUS_LABELS[status]}`, status }),
        });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Gagal memindahkan task");
      setTasks(previous);
      return;
    }
    void loadTasks();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Papan Task Tim</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canViewAll
              ? "Klik kartu untuk edit · seret kartu ke kolom lain untuk ganti status"
              : "Task Anda · klik kartu untuk update progress · seret kartu untuk ganti status"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            [visibleTasks.length, "task"],
            [inProgress, "sedang proses"],
            [done, "selesai"],
          ].map(([n, label]) => (
            <span key={label} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-[#e8dfd0]">
              <strong className="font-mono">{n}</strong> <span className="text-slate-500">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-10 text-xs font-medium uppercase text-slate-400">PT</span>
          <button type="button" onClick={() => selectPt("")} className={chipClass(!ptFilter)}>
            Semua PT
          </button>
          {companies.map((pt) => (
            <button key={pt} type="button" onClick={() => selectPt(pt)} className={chipClass(ptFilter === pt)}>
              {pt}
            </button>
          ))}
        </div>
        {canViewAll && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-10 text-xs font-medium uppercase text-slate-400">PIC</span>
            <button type="button" onClick={() => setPicFilter("")} className={chipClass(!picFilter)}>
              Semua orang
            </button>
            {people.map((p) => (
              <button key={p.nik} type="button" onClick={() => setPicFilter(p.nik)} className={chipClass(picFilter === p.nik)}>
                {p.name}
              </button>
            ))}
            {hasUnassigned && (
              <button type="button" onClick={() => setPicFilter(UNASSIGNED)} className={chipClass(picFilter === UNASSIGNED)}>
                Belum ditugaskan
              </button>
            )}
          </div>
        )}
      </div>

      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openCreate();
          }}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e8dfd0] bg-white p-3 shadow-sm"
        >
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Ketik task baru lalu tekan Enter..."
            className="min-w-[200px] flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <select
            value={quickCompany}
            onChange={(e) => {
              setQuickCompany(e.target.value);
              setQuickAssignee("");
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {companies.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
          <select
            value={quickAssignee}
            onChange={(e) => setQuickAssignee(e.target.value)}
            className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Belum ditugaskan</option>
            {quickEmployees.map((emp) => (
              <option key={emp.nik} value={emp.nik}>
                {emp.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary !py-2">
            Tambah
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Memuat task...</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TASK_BOARD_COLUMNS.map((col) => {
            const colTasks = visibleTasks.filter((t) => col.includes.includes(t.status));
            const highlighted = dragOver === col.status && dragId !== null;
            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setDragOver(col.status);
                }}
                onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  setDragOver(null);
                  setDragId(null);
                  if (id) void moveTask(id, col.status);
                }}
                className={`rounded-xl border bg-white/70 p-3 transition-colors ${
                  highlighted ? "border-[#503200] bg-[#fdf6e8]" : "border-[#e8dfd0]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <h2 className="font-semibold text-slate-800">{col.label}</h2>
                  </div>
                  <span className="font-mono text-xs text-slate-400">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">
                      {col.status === "BELUM_MULAI" && canManage ? "Tambah task lewat kolom di atas" : "Seret kartu ke sini"}
                    </p>
                  ) : (
                    colTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        draggable={canMove(task)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", task.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(task.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOver(null);
                        }}
                        onClick={() => openTask(task)}
                        className={`block w-full rounded-lg border border-slate-200 border-l-4 bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
                          task.status === "DONE" ? "border-l-emerald-500" : task.status === "ON_REVIEW" ? "border-l-indigo-500" : task.status === "BELUM_MULAI" ? "border-l-slate-300" : "border-l-amber-500"
                        } ${dragId === task.id ? "opacity-50" : ""} ${canMove(task) ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <p className="font-semibold text-slate-900">
                          {task.title}
                          {isAssignee(task) && (
                            <span className="ml-2 rounded bg-[#fdf6e8] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#503200]">
                              Anda
                            </span>
                          )}
                        </p>
                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{plainTextFromHtml(task.description)}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="rounded bg-[#fdf6e8] px-2 py-0.5 text-[11px] font-semibold text-[#503200]">
                            {task.company}
                          </span>
                          {task.assignee ? (
                            <span
                              title={task.assignee.name}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8a3b12] text-[10px] font-bold text-white"
                            >
                              {initials(task.assignee.name)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Belum ditugaskan</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {modal.mode === "create" ? "Tambah Task Baru" : canManage ? "Edit Task" : activeTask?.title}
                </h2>
                {activeTask && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {activeTask.company} · {activeTask.assignee?.name ?? "Belum ditugaskan"} · diperbarui {formatDate(activeTask.updatedAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            {canManage ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Judul Pekerjaan</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="Judul task"
                    autoFocus={modal.mode === "create" && !form.title}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Detail Pekerjaan</label>
                  <RichTextEditor
                    value={form.description}
                    onChange={(html) => setForm({ ...form, description: html })}
                    placeholder="Deskripsi / detail pekerjaan..."
                    minHeight={100}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">PT</label>
                    <select
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value, assigneeId: "" })}
                      className={INPUT_CLASS}
                    >
                      {companies.map((pt) => (
                        <option key={pt} value={pt}>
                          {pt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                    <select
                      value={form.status === "ON_PROSES" ? "PROSES" : form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                      className={INPUT_CLASS}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">PIC</label>
                    <select
                      value={form.assigneeId}
                      onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="">— Belum ditugaskan —</option>
                      {formEmployees.map((emp) => (
                        <option key={emp.nik} value={emp.nik}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {modalError && !activeTask && <p className="text-sm text-red-600">{modalError}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Menyimpan..." : modal.mode === "create" ? "Tambah Task" : "Simpan Perubahan"}
                  </button>
                  <button type="button" onClick={() => setModal(null)} className="btn-secondary">
                    Batal
                  </button>
                  {activeTask && (
                    <button
                      type="button"
                      onClick={() => handleDelete(activeTask)}
                      className="ml-auto text-sm font-medium text-red-600 hover:underline"
                    >
                      Hapus task
                    </button>
                  )}
                </div>
              </form>
            ) : (
              activeTask && (
                <div className="space-y-2">
                  <StatusBadge status={activeTask.status} />
                  {activeTask.description ? (
                    <RichTextView html={activeTask.description} />
                  ) : (
                    <p className="text-sm text-slate-500">Tidak ada detail.</p>
                  )}
                </div>
              )
            )}

            {activeTask && (
              <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Riwayat Progress</h3>
                  {(activeTask.progressLogs?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada update progress.</p>
                  ) : (
                    <ul className="max-h-60 space-y-2 overflow-y-auto">
                      {activeTask.progressLogs?.map((log) => (
                        <li key={log.id} className="rounded-lg border border-[#e8dfd0] bg-white px-3 py-2 text-sm">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-800">{log.author.name}</span>
                            <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
                            {log.status && <StatusBadge status={log.status} />}
                          </div>
                          <RichTextView html={log.note} className="text-slate-600" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canMove(activeTask) && (
                  <div className="rounded-lg border border-[#f7c200]/50 bg-[#fdf6e8]/40 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">
                      {isAssignee(activeTask) ? "Update Pekerjaan Anda" : "Tambah Catatan Progress"}
                    </h3>
                    <div className="space-y-3">
                      <RichTextEditor
                        value={progressNote}
                        onChange={setProgressNote}
                        placeholder="Contoh: Sudah selesai modul presensi, lanjut testing clock-in..."
                        minHeight={90}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={progressStatus}
                          onChange={(e) => setProgressStatus(e.target.value as TaskStatus)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={progressSaving}
                          onClick={() => handleProgressSubmit(activeTask)}
                          className="btn-primary"
                        >
                          {progressSaving ? "Menyimpan..." : "Kirim Update Progress"}
                        </button>
                      </div>
                      {modalError && <p className="text-sm text-red-600">{modalError}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
