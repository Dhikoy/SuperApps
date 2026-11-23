"use client";

import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/ui";
import { useFormDraft } from "@/hooks/useFormDraft";

const DRAFT_KEY = "superapps-office-location-draft";

type Office = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
};

const INITIAL = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radiusMeters: "100",
};

export function OfficeLocationsSettings() {
  const [offices, setOffices] = useState<Office[]>([]);
  const { form, setForm, clearDraft } = useFormDraft(DRAFT_KEY, INITIAL);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const activeOffices = offices.filter((o) => o.isActive);
  const inactiveOffices = offices.filter((o) => !o.isActive);

  function load() {
    fetch("/api/settings/offices")
      .then(async (r) => {
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      })
      .then(setOffices)
      .catch(() => setOffices([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function addOffice(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings/offices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters) || 100,
      }),
    });
    clearDraft();
    load();
  }

  async function deactivateOffice(office: Office) {
    const ok = confirm(
      `Nonaktifkan lokasi "${office.name}"?\n\nKaryawan tidak bisa clock in di lokasi ini sampai diaktifkan kembali.`
    );
    if (!ok) return;

    setBusyId(office.id);
    setMessage(null);

    const res = await fetch(`/api/settings/offices/${office.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Gagal menonaktifkan lokasi" });
      setBusyId(null);
      return;
    }

    setMessage({ type: "success", text: `Lokasi "${office.name}" berhasil dinonaktifkan.` });
    setBusyId(null);
    load();
  }

  async function activateOffice(office: Office) {
    const ok = confirm(
      `Aktifkan kembali lokasi "${office.name}"?\n\nLokasi ini akan muncul lagi untuk presensi / geofence clock in.`
    );
    if (!ok) return;

    setBusyId(office.id);
    setMessage(null);

    const res = await fetch(`/api/settings/offices/${office.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Gagal mengaktifkan lokasi" });
      setBusyId(null);
      return;
    }

    setMessage({ type: "success", text: `Lokasi "${office.name}" berhasil diaktifkan kembali.` });
    setBusyId(null);
    load();
  }

  async function deleteOfficePermanently(office: Office) {
    const ok = confirm(
      `Hapus permanen lokasi "${office.name}"?\n\nData lokasi akan dihapus dari sistem dan tidak bisa dikembalikan.`
    );
    if (!ok) return;

    setBusyId(office.id);
    setMessage(null);

    const res = await fetch(`/api/settings/offices/${office.id}?permanent=1`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Gagal menghapus lokasi" });
      setBusyId(null);
      return;
    }

    setMessage({ type: "success", text: `Lokasi "${office.name}" berhasil dihapus permanen.` });
    setBusyId(null);
    load();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Draft form tersimpan otomatis — aman jika pindah tab atau refresh halaman sebelum submit.
      </p>
      <form onSubmit={addOffice} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nama kantor"
          className={INPUT_CLASS}
          required
        />
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Alamat"
          className={INPUT_CLASS}
        />
        <input
          value={form.latitude}
          onChange={(e) => setForm({ ...form, latitude: e.target.value })}
          placeholder="Latitude"
          className={INPUT_CLASS}
          required
        />
        <input
          value={form.longitude}
          onChange={(e) => setForm({ ...form, longitude: e.target.value })}
          placeholder="Longitude"
          className={INPUT_CLASS}
          required
        />
        <input
          value={form.radiusMeters}
          onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
          placeholder="Radius (meter)"
          className={INPUT_CLASS}
        />
        <button type="submit" className="btn-primary sm:col-span-2">
          Tambah Lokasi Kantor
        </button>
      </form>
      {message && (
        <p
          className={`text-sm ${message.type === "error" ? "text-red-600" : "text-emerald-700"}`}
          role="alert"
        >
          {message.text}
        </p>
      )}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Lokasi Aktif</h3>
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {activeOffices.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500 text-center bg-white">
              Belum ada lokasi kantor aktif
            </li>
          ) : (
            activeOffices.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm bg-white gap-4">
                <div>
                  <p className="font-medium text-slate-900">{o.name}</p>
                  <p className="text-slate-500 text-xs">
                    {o.latitude}, {o.longitude} · radius {o.radiusMeters}m
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deactivateOffice(o)}
                  disabled={busyId === o.id}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors shrink-0"
                >
                  {busyId === o.id ? "..." : "Nonaktifkan"}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {inactiveOffices.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Lokasi Nonaktif</h3>
          <p className="text-xs text-slate-500 mb-2">
            Lokasi yang dinonaktifkan tidak dipakai untuk geofence clock in. Bisa diaktifkan kembali atau dihapus permanen.
          </p>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {inactiveOffices.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between px-4 py-3 text-sm bg-slate-50 gap-4"
              >
                <div>
                  <p className="font-medium text-slate-600">{o.name}</p>
                  <p className="text-slate-400 text-xs">
                    {o.latitude}, {o.longitude} · radius {o.radiusMeters}m
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => activateOffice(o)}
                    disabled={busyId === o.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {busyId === o.id ? "..." : "Aktifkan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOfficePermanently(o)}
                    disabled={busyId === o.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
