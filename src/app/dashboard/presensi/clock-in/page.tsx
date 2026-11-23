"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SelfieCapture } from "@/components/SelfieCapture";
import { LiveClock, jakartaHHMM } from "@/components/LiveClock";

type Schedule = {
  id: string;
  shiftName: string;
  standardClockIn: string;
  standardClockOut: string;
};

type TodayAttendance = {
  clockInTime: string | null;
  clockOutTime: string | null;
  status: string;
  jamKerja?: { shiftName: string; standardClockIn: string; standardClockOut: string } | null;
};

type Office = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

type PresensiConfig = {
  company: string | null;
  flexibleAttendance?: boolean;
  onBusinessTrip?: boolean;
  office: Office | null;
  schedule: Schedule | null;
  workScheduleId: string | null;
  allowShiftSelection?: boolean;
  availableShifts?: Schedule[];
};

type Mode = "loading" | "in" | "out" | "done";

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export default function ClockInPage() {
  const [config, setConfig] = useState<PresensiConfig | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [todayLoaded, setTodayLoaded] = useState(false);
  const [jamKerjaId, setJamKerjaId] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ kind: "in" | "out"; time: string; status?: string } | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setTimeout(() => setGpsError("HP ini tidak mendukung GPS."), 0);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsError("");
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      () => setGpsError("Lokasi belum diizinkan. Aktifkan GPS dan izinkan akses lokasi untuk aplikasi ini."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    fetch("/api/me/presensi-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: PresensiConfig | null) => {
        if (!cfg) return;
        setConfig(cfg);
        if (cfg.allowShiftSelection && cfg.availableShifts?.length) setJamKerjaId(cfg.availableShifts[0].id);
        else if (cfg.workScheduleId) setJamKerjaId(cfg.workScheduleId);
      })
      .catch(() => null);

    fetch("/api/attendance/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setToday((data?.today as TodayAttendance | null) ?? null))
      .catch(() => setToday(null))
      .finally(() => setTodayLoaded(true));

    fetch("/api/offices")
      .then((r) => r.json())
      .then((all) => setOffices(Array.isArray(all) ? (all as Office[]) : []))
      .catch(() => null);

    requestLocation();
  }, [requestLocation]);

  const mode: Mode = !todayLoaded
    ? "loading"
    : !today?.clockInTime
      ? "in"
      : !today.clockOutTime
        ? "out"
        : "done";

  const shiftChoices = config?.availableShifts ?? [];
  const mustPickShift = Boolean(config?.allowShiftSelection && shiftChoices.length >= 2);
  const schedule: Pick<Schedule, "shiftName" | "standardClockIn" | "standardClockOut"> | null =
    today?.jamKerja ?? shiftChoices.find((s) => s.id === jamKerjaId) ?? config?.schedule ?? null;

  const freeLocation = Boolean(config?.flexibleAttendance || config?.onBusinessTrip);
  const allOffices = offices.length > 0 ? offices : config?.office ? [config.office] : [];
  const nearest = location
    ? allOffices
        .map((o) => ({ ...o, dist: distanceM(location.lat, location.lng, o.latitude, o.longitude) }))
        .sort((a, b) => a.dist - b.dist)[0] ?? null
    : null;
  const insideOffice = Boolean(nearest && nearest.dist <= nearest.radiusMeters);
  const locationOk = Boolean(location) && (freeLocation || insideOffice);

  async function submit() {
    if (!selfie || !location) return;
    if (mode === "in" && mustPickShift && !jamKerjaId) {
      setError("Pilih shift Anda terlebih dahulu");
      return;
    }
    if (mode === "out" && schedule && jakartaHHMM() < schedule.standardClockOut) {
      const ok = window.confirm(
        `Jadwal pulang Anda ${schedule.standardClockOut}. Yakin clock out sekarang (${jakartaHHMM()})?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    setError("");
    const isIn = mode === "in";
    const res = await fetch(isIn ? "/api/attendance/clock" : "/api/attendance/clock-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isIn ? { jamKerjaId: jamKerjaId || config?.workScheduleId || null } : {}),
        latitude: location.lat,
        longitude: location.lng,
        selfieImage: selfie,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSubmitting(false);

    if (!res || !res.ok) {
      setError(data.error ?? "Gagal menyimpan presensi. Periksa koneksi lalu coba lagi.");
      return;
    }

    setSelfie(null);
    if (isIn) {
      setToday({ clockInTime: data.clockInTime ?? jakartaHHMM(), clockOutTime: null, status: data.status ?? "HADIR", jamKerja: schedule });
      setResult({ kind: "in", time: data.clockInTime ?? jakartaHHMM(), status: data.status });
    } else {
      setToday((prev) => (prev ? { ...prev, clockOutTime: data.clockOutTime ?? jakartaHHMM() } : prev));
      setResult({ kind: "out", time: data.clockOutTime ?? jakartaHHMM() });
    }
  }

  if (result) {
    const late = result.status === "TERLAMBAT";
    return (
      <div className="mx-auto max-w-md space-y-5 pt-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{result.kind === "in" ? "Clock in tercatat" : "Clock out tercatat"}</p>
          <p className="mt-1 font-mono text-5xl font-bold text-slate-900">{result.time}</p>
          {result.kind === "in" && (
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                late ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {late ? "Terlambat" : "Tepat waktu"}
            </span>
          )}
        </div>
        {result.kind === "in" ? (
          <div className="rounded-2xl border border-[#503200]/15 bg-[#fdf6e8] px-5 py-4 text-sm text-[#503200]">
            Jangan lupa <strong>clock out</strong>
            {schedule ? (
              <>
                {" "}jam <strong>{schedule.standardClockOut}</strong>
              </>
            ) : null}{" "}
            sebelum pulang.
          </div>
        ) : (
          <p className="text-sm text-slate-500">Terima kasih, hati-hati di jalan.</p>
        )}
        <div className="flex flex-col gap-2">
          <Link href="/dashboard" className="btn-primary w-full !py-3.5 text-base">
            Ke Beranda
          </Link>
          {result.kind === "in" && (
            <button type="button" onClick={() => setResult(null)} className="py-2 text-sm font-medium text-slate-500">
              Lihat status presensi
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <LiveClock className="block font-mono text-5xl font-bold tracking-tight text-slate-900" />
        <LiveClock dateOnly className="mt-1 block text-sm text-slate-500" />
        {schedule && (
          <p className="mt-2 text-xs text-slate-400">
            {schedule.shiftName} · masuk {schedule.standardClockIn} · pulang {schedule.standardClockOut}
          </p>
        )}
      </div>

      {mode === "loading" && <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />}

      {mode === "done" && today && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-lg font-bold text-emerald-800">Presensi hari ini lengkap ✓</p>
          <p className="mt-2 text-sm text-emerald-700">
            Masuk <span className="font-mono font-semibold">{today.clockInTime}</span> · Pulang{" "}
            <span className="font-mono font-semibold">{today.clockOutTime}</span>
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-emerald-800 underline">
            Kembali ke Beranda
          </Link>
        </div>
      )}

      {(mode === "in" || mode === "out") && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-slate-900">{mode === "in" ? "Clock In" : "Clock Out"}</h1>
            {mode === "out" && today?.clockInTime && (
              <span className="text-xs text-slate-500">
                Masuk <span className="font-mono font-semibold text-slate-700">{today.clockInTime}</span>
              </span>
            )}
          </div>

          {/* Status lokasi */}
          {gpsError ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{gpsError}</span>
              <button type="button" onClick={requestLocation} className="shrink-0 font-semibold underline">
                Coba lagi
              </button>
            </div>
          ) : !location ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Mencari lokasi…</div>
          ) : locationOk ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              ✓ Lokasi sesuai
              <span className="font-normal text-emerald-700">
                {insideOffice && nearest
                  ? ` · ${nearest.name}`
                  : config?.onBusinessTrip
                    ? " · perjalanan dinas"
                    : " · presensi bebas lokasi"}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                Di luar area kantor
                {nearest ? ` (${formatDistance(nearest.dist)} dari ${nearest.name})` : ""}
              </span>
              <button type="button" onClick={requestLocation} className="shrink-0 font-semibold underline">
                Perbarui
              </button>
            </div>
          )}

          {mode === "in" && mustPickShift && (
            <select
              value={jamKerjaId}
              onChange={(e) => setJamKerjaId(e.target.value)}
              className="input-field w-full !py-3 text-sm"
              aria-label="Pilih shift"
            >
              {shiftChoices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shiftName} — {s.standardClockIn} s/d {s.standardClockOut}
                </option>
              ))}
            </select>
          )}

          <SelfieCapture captured={selfie} onCapture={setSelfie} onRetake={() => setSelfie(null)} />

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {selfie && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !location || !!gpsError}
              className="btn-primary w-full !py-4 text-base active:scale-[0.98]"
            >
              {submitting ? "Menyimpan…" : mode === "in" ? "Kirim Clock In" : "Kirim Clock Out"}
            </button>
          )}

          {location && !gpsError && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer select-none">Detail lokasi</summary>
              <p className="mt-2 font-mono">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)} (±{Math.round(location.accuracy)} m)
              </p>
              {!freeLocation && (
                <p className="mt-1">
                  Di luar kota? Ajukan Perjalanan Dinas di Modul HR. Setelah disetujui, presensi bisa dari lokasi mana
                  pun.
                </p>
              )}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
