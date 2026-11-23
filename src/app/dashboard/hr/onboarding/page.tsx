"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type OnboardingTask = {
  id: string;
  title: string;
  completed: boolean;
  userId: string;
  user: { name: string; company: string | null };
};

type UserOption = { nik: string; name: string };

export default function OnboardingPage() {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ userId: "", title: "" });

  async function load() {
    const [tasksRes, usersRes] = await Promise.all([
      hrFetchJson<{ tasks: OnboardingTask[] }>("/api/hr/onboarding"),
      hrFetchJson<UserOption[]>("/api/users"),
    ]);
    if (!tasksRes.ok) showToast(tasksRes.error, "error");
    else setTasks(tasksRes.data.tasks ?? []);
    if (!usersRes.ok) showToast(usersRes.error, "error");
    else setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  const progressByUser = useMemo(() => {
    const map = new Map<string, { name: string; company: string | null; done: number; total: number }>();
    for (const t of tasks) {
      const cur = map.get(t.userId) ?? { name: t.user.name, company: t.user.company, done: 0, total: 0 };
      cur.total += 1;
      if (t.completed) cur.done += 1;
      map.set(t.userId, cur);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [tasks]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await hrFetchJson("/api/hr/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Task onboarding ditambahkan", "success");
    setForm({ userId: "", title: "" });
    load();
  }

  async function toggle(id: string, completed: boolean) {
    const res = await hrFetchJson("/api/hr/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: !completed }),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6 p-8 max-w-3xl">
      <PageHeader title="Onboarding" subtitle="Checklist orientasi karyawan baru" badge={`${tasks.length} task`} />
      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">← Dashboard HR</Link>

      {progressByUser.length > 0 && (
        <div className="rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Progress per karyawan</h2>
          {progressByUser.map(([userId, p]) => {
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <div key={userId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="text-slate-500">{p.done}/{p.total} ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} className="rounded-xl border bg-white p-5 grid gap-3">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="input-field" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => <option key={u.nik} value={u.nik}>{u.name}</option>)}
        </select>
        <input placeholder="Task onboarding" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" required />
        <button type="submit" className="btn-primary">Tambah Task</button>
      </form>

      <div className="space-y-2">
        {tasks.map((t) => (
          <label key={t.id} className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={t.completed} onChange={() => toggle(t.id, t.completed)} />
            <div>
              <p className={`font-medium ${t.completed ? "line-through text-slate-400" : "text-slate-900"}`}>{t.title}</p>
              <p className="text-xs text-slate-500">{t.user.name} · {t.user.company}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
