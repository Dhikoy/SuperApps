"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Schedule = {
  id: string;
  shiftName: string;
  standardClockIn: string;
  standardClockOut: string;
  isActive: boolean;
};

export function ScheduleEditor({ schedules: initial }: { schedules: Schedule[] }) {
  const router = useRouter();
  const [schedules, setSchedules] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    shiftName: "",
    standardClockIn: "09:00",
    standardClockOut: "17:00",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function startEdit(schedule: Schedule) {
    setEditingId(schedule.id);
    setForm({
      shiftName: schedule.shiftName,
      standardClockIn: schedule.standardClockIn,
      standardClockOut: schedule.standardClockOut,
      isActive: schedule.isActive,
    });
  }

  function startCreate() {
    setEditingId("new");
    setForm({ shiftName: "", standardClockIn: "09:00", standardClockOut: "17:00", isActive: true });
  }

  async function handleSave() {
    setLoading(true);
    setError("");

    const res =
      editingId === "new"
        ? await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch(`/api/schedules/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Gagal menyimpan");
      setLoading(false);
      return;
    }

    setEditingId(null);
    setLoading(false);
    router.refresh();
  }

  async function toggleActive(schedule: Schedule) {
    await fetch(`/api/schedules/${schedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !schedule.isActive }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={startCreate}
          className="rounded-lg bg-[#1a2332] px-4 py-2 text-sm font-medium text-white hover:bg-[#243044]"
        >
          + Tambah Shift
        </button>
      </div>

      {(editingId === "new" || editingId) && (
        <div className="rounded-xl bg-white p-5 shadow-sm border border-orange-200 space-y-4">
          <h3 className="font-semibold">{editingId === "new" ? "Tambah Jadwal" : "Edit Jadwal"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama Shift</label>
              <input
                value={form.shiftName}
                onChange={(e) => setForm({ ...form, shiftName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Aktif
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Jam Masuk</label>
              <input
                type="time"
                value={form.standardClockIn}
                onChange={(e) => setForm({ ...form, standardClockIn: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Jam Pulang</label>
              <input
                type="time"
                value={form.standardClockOut}
                onChange={(e) => setForm({ ...form, standardClockOut: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Simpan
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">🕐</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  schedule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {schedule.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">{schedule.shiftName}</h3>
            <div className="mt-3 flex gap-6 text-sm text-gray-600">
              <div>
                <p className="text-xs text-gray-400 uppercase">Masuk</p>
                <p className="font-medium">{schedule.standardClockIn}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase">Pulang</p>
                <p className="font-medium">{schedule.standardClockOut}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => startEdit(schedule)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(schedule)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                {schedule.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
