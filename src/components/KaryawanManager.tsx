"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { IT_ROLE_COMPANY, ROLE_LABELS, canAssignUserRole, canDeleteUser, canManageUser, getDeleteUserBlockReason, type Role } from "@/lib/roles";
import { CompanySelect } from "@/components/CompanySelect";
import { INPUT_CLASS } from "@/components/ui";
import { type UserProfileFields, formatJobTitle } from "@/lib/user-profile";
import { suggestUserIdFromName } from "@/lib/user-id";

type UserRow = {
  nik: string;
  userId: string;
  name: string;
  role: Role;
  company?: string | null;
  jobTitle?: string | null;
  flexibleAttendance?: boolean;
  createdAt: string;
} & UserProfileFields;

type ProfileDraft = UserProfileFields & { name: string; jobTitle: string; flexibleAttendance: boolean; userId: string };

type CreateForm = {
  name: string;
  userId: string;
  password: string;
  company: string;
  role: Role;
  jobTitle: string;
  birthDate: string;
  joinDate: string;
  bankAccount: string;
  homeAddress: string;
};

const OWNED_LABELS: Record<string, string> = {
  invoices: "Invoice / kwitansi / pengajuan dana (dokumen keuangan)",
  incomes: "Pemasukan (beserta jurnalnya)",
  fundRequests: "Pengajuan dana",
  momNotes: "Catatan MoM",
  assetLoansCreated: "Surat pinjam aset yang ia buat",
  assetTransfersCreated: "Serah terima aset yang ia buat",
  penaltiesCreated: "Poin penalti yang ia input",
};

const emptyCreateForm = (): CreateForm => ({
  name: "",
  userId: "",
  password: "",
  company: "BCI",
  role: "STAFF",
  jobTitle: "Staff",
  birthDate: "",
  joinDate: "",
  bankAccount: "",
  homeAddress: "",
});

export function KaryawanManager({
  users: initialUsers,
  assignableRoles,
  canManage,
  canEditProfile,
  canViewProfile,
  actorRole,
  actorNik,
  actorUserId,
}: {
  users: UserRow[];
  assignableRoles: Role[];
  canManage: boolean;
  canEditProfile: boolean;
  canViewProfile: boolean;
  actorRole: Role;
  actorNik: string;
  actorUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<CreateForm>(emptyCreateForm());
  const [updatingNik, setUpdatingNik] = useState<string | null>(null);
  const [deletingNik, setDeletingNik] = useState<string | null>(null);
  const [transferPrompt, setTransferPrompt] = useState<{
    nik: string;
    name: string;
    company: string | null;
    owned: Record<string, number>;
    successor: string;
  } | null>(null);
  const [editingProfileNik, setEditingProfileNik] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    name: "",
    jobTitle: "Staff",
    birthDate: null,
    joinDate: null,
    bankAccount: null,
    homeAddress: null,
    flexibleAttendance: false,
    userId: "",
  });
  const [userIdTouched, setUserIdTouched] = useState(false);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Gagal menambah karyawan");
      setLoading(false);
      return;
    }

    setUsers((prev) =>
      [...prev, { ...data, createdAt: new Date(data.createdAt).toISOString() }].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setForm(emptyCreateForm());
    setUserIdTouched(false);
    setShowForm(false);
    setLoading(false);
    router.refresh();
  }

  async function handleRoleChange(nik: string, role: Role) {
    setUpdatingNik(nik);
    setError("");

    const res = await fetch(`/api/users/${encodeURIComponent(nik)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Gagal mengubah role");
      setUpdatingNik(null);
      return;
    }

    setUsers((prev) => prev.map((u) => (u.nik === nik ? { ...u, role: data.role } : u)));
    setUpdatingNik(null);
    router.refresh();
  }

  function startEditProfile(user: UserRow) {
    setEditingProfileNik(user.nik);
    setProfileDraft({
      name: user.name,
      jobTitle: user.jobTitle ?? "Staff",
      birthDate: user.birthDate ?? "",
      joinDate: user.joinDate ?? "",
      bankAccount: user.bankAccount ?? "",
      homeAddress: user.homeAddress ?? "",
      flexibleAttendance: user.flexibleAttendance ?? false,
      userId: user.userId,
    });
  }

  function suggestCreateUserId(name: string) {
    if (!name.trim()) return;
    setForm((prev) => ({
      ...prev,
      userId: userIdTouched ? prev.userId : suggestUserIdFromName(name),
    }));
  }

  async function saveProfile(nik: string) {
    setUpdatingNik(nik);
    setError("");

    const res = await fetch(`/api/users/${encodeURIComponent(nik)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profileDraft.name.trim(),
        jobTitle: profileDraft.jobTitle.trim() || "Staff",
        birthDate: profileDraft.birthDate || null,
        joinDate: profileDraft.joinDate || null,
        bankAccount: profileDraft.bankAccount || null,
        homeAddress: profileDraft.homeAddress || null,
        flexibleAttendance: profileDraft.flexibleAttendance,
        userId: profileDraft.userId.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan profil");
      setUpdatingNik(null);
      return;
    }

    setUsers((prev) =>
      [...prev
        .map((u) =>
          u.nik === nik
            ? {
                ...u,
                name: data.name ?? u.name,
                jobTitle: data.jobTitle ?? u.jobTitle,
                birthDate: data.birthDate,
                joinDate: data.joinDate,
                bankAccount: data.bankAccount,
                homeAddress: data.homeAddress,
                flexibleAttendance: data.flexibleAttendance ?? false,
                userId: data.userId ?? u.userId,
              }
            : u
        )
        .sort((a, b) => a.name.localeCompare(b.name))]
    );
    setEditingProfileNik(null);
    setUpdatingNik(null);
    router.refresh();
  }

  async function handleDelete(nik: string, name: string, transferTo?: string) {
    if (!transferTo && !confirm(`Hapus karyawan "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;

    setDeletingNik(nik);
    setError("");
    setSuccess("");

    const query = transferTo ? `?transferTo=${encodeURIComponent(transferTo)}` : "";
    const res = await fetch(`/api/users/${encodeURIComponent(nik)}${query}`, { method: "DELETE" });

    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.code === "TRANSFER_REQUIRED") {
      const target = users.find((u) => u.nik === nik);
      setTransferPrompt({
        nik,
        name,
        company: target?.company ?? null,
        owned: data.owned ?? {},
        successor: "",
      });
      setDeletingNik(null);
      return;
    }
    if (!res.ok) {
      const detail = data.detail ? ` (${data.detail})` : "";
      setError((data.error ?? "Gagal menghapus karyawan") + detail);
      setDeletingNik(null);
      return;
    }

    setUsers((prev) => prev.filter((u) => u.nik !== nik));
    setDeletingNik(null);
    setTransferPrompt(null);
    setError("");
    const successorName = transferTo ? users.find((u) => u.nik === transferTo)?.name : null;
    setSuccess(
      successorName
        ? `Karyawan "${name}" berhasil dihapus. Dokumen yang ia buat dialihkan ke ${successorName}.`
        : `Karyawan "${name}" berhasil dihapus.`
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div>
          {!showForm ? (
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
              + Tambah Karyawan
            </button>
          ) : (
            <form
              onSubmit={handleCreate}
              className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4 max-w-2xl"
            >
              <h2 className="font-semibold text-slate-900">Tambah Karyawan Baru</h2>
              <p className="text-xs text-slate-500">
                NIK digenerate otomatis. User ID bisa diisi sendiri (mis. <code>muhammad.rijal</code>) — kosongkan
                untuk otomatis dari nama. Karyawan baru otomatis ber-role <strong>Staff</strong>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((prev) => {
                        const next = { ...prev, name };
                        if (!userIdTouched && name.trim()) {
                          next.userId = suggestUserIdFromName(name);
                        }
                        return next;
                      });
                    }}
                    onBlur={() => suggestCreateUserId(form.name)}
                    className={INPUT_CLASS}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">User ID (login)</label>
                  <input
                    type="text"
                    value={form.userId}
                    onChange={(e) => {
                      setUserIdTouched(true);
                      setForm((prev) => ({ ...prev, userId: e.target.value.toLowerCase() }));
                    }}
                    className={`${INPUT_CLASS} font-mono`}
                    placeholder="muhammad.rijal — kosongkan untuk otomatis"
                    autoComplete="off"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="Contoh: Staff, Admin Keuangan, Manager LBB"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Perusahaan (PT)</label>
                  <CompanySelect value={form.company} onChange={(company) => setForm({ ...form, company })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {form.company.trim().toUpperCase() === IT_ROLE_COMPANY ? ROLE_LABELS.IT : ROLE_LABELS.STAFF}
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      {form.company.trim().toUpperCase() === IT_ROLE_COMPANY
                        ? "Staff MKTECH otomatis IT: akses semua modul kecuali gaji, presensi bebas lokasi"
                        : "Ubah role lewat Super Admin setelah karyawan dibuat"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tgl Lahir</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tgl Masuk</label>
                  <input
                    type="date"
                    value={form.joinDate}
                    onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">No. Rekening</label>
                  <input
                    type="text"
                    value={form.bankAccount}
                    onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="Contoh: 1234567890"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Rumah</label>
                  <textarea
                    value={form.homeAddress}
                    onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                    className={`${INPUT_CLASS} min-h-[72px] resize-y`}
                    rows={2}
                    placeholder="Alamat lengkap"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={INPUT_CLASS}
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}

      {transferPrompt && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
          <div>
            <p className="font-semibold text-slate-900">Alihkan dokumen sebelum menghapus {transferPrompt.name}</p>
            <p className="text-sm text-slate-600 mt-1">
              Dokumen perusahaan berikut dibuat oleh {transferPrompt.name}. Dokumen tidak dihapus, hanya pemiliknya
              yang dipindah ke karyawan pengganti. Data pribadi (presensi, gaji, cuti) tetap ikut terhapus.
            </p>
          </div>
          <ul className="text-sm text-slate-700 list-disc pl-5">
            {Object.entries(OWNED_LABELS)
              .filter(([key]) => (transferPrompt.owned[key] ?? 0) > 0)
              .map(([key, label]) => (
                <li key={key}>
                  {label}: <strong>{transferPrompt.owned[key]}</strong>
                </li>
              ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs font-medium text-slate-500 mb-1">Karyawan pengganti</span>
              <select
                value={transferPrompt.successor}
                onChange={(e) => setTransferPrompt({ ...transferPrompt, successor: e.target.value })}
                className={`${INPUT_CLASS} min-w-[260px]`}
              >
                <option value="">Pilih karyawan…</option>
                {[...users]
                  .filter((u) => u.nik !== transferPrompt.nik)
                  .sort(
                    (a, b) =>
                      Number(b.company === transferPrompt.company) - Number(a.company === transferPrompt.company) ||
                      a.name.localeCompare(b.name)
                  )
                  .map((u) => (
                    <option key={u.nik} value={u.nik}>
                      {u.name} — {u.company ?? "-"} ({ROLE_LABELS[u.role] ?? u.role})
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!transferPrompt.successor || deletingNik === transferPrompt.nik}
              onClick={() => handleDelete(transferPrompt.nik, transferPrompt.name, transferPrompt.successor)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {deletingNik === transferPrompt.nik ? "Memproses…" : "Alihkan & hapus"}
            </button>
            <button
              type="button"
              onClick={() => setTransferPrompt(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm table-responsive">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="w-[11%] px-3 py-3 font-medium">NIK</th>
                <th className="w-[34%] px-3 py-3 font-medium">Nama</th>
                <th className="w-[7%] px-3 py-3 font-medium">PT</th>
                <th className="w-[12%] px-3 py-3 font-medium">User ID</th>
                <th className="w-[14%] px-3 py-3 font-medium">Role</th>
                {(canManage || canEditProfile || canViewProfile) && (
                  <th className="w-[22%] px-3 py-3 font-medium text-right">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const canEditProfileRow =
                  canEditProfile && canManageUser(actorRole, user.role);
                const canEditRoleRow =
                  canAssignUserRole(actorRole) && canManageUser(actorRole, user.role);
                const canEditRow = canManage && canManageUser(actorRole, user.role);
                const canDeleteRow =
                  canManage &&
                  canDeleteUser(actorRole, actorNik, actorUserId, user.nik, user.userId, user.role);
                const deleteBlockReason = canManage
                  ? getDeleteUserBlockReason(
                      actorRole,
                      actorNik,
                      actorUserId,
                      user.nik,
                      user.userId,
                      user.role
                    )
                  : null;
                const isEditingProfile = editingProfileNik === user.nik;
                const hasAksiCol = canManage || canEditProfile || canViewProfile;
                const tableColCount = hasAksiCol ? 6 : 5;
                const displayJobTitle = formatJobTitle(user.jobTitle);

                return (
                  <Fragment key={user.nik}>
                    <tr className="hover:bg-slate-50 transition-colors align-top">
                      <td data-label="NIK" className="px-3 py-3 font-mono text-[11px] text-slate-600 truncate">
                        {user.nik}
                      </td>
                      <td data-label="Nama" className="px-3 py-3 font-medium text-slate-900 min-w-0">
                        {isEditingProfile ? (
                          <div className="space-y-1">
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#503200]">
                              Edit Nama
                            </label>
                            <input
                              type="text"
                              value={profileDraft.name}
                              onChange={(e) =>
                                setProfileDraft({ ...profileDraft, name: e.target.value })
                              }
                              className={`${INPUT_CLASS} !py-1.5 text-sm font-medium`}
                              required
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="truncate" title={user.name}>
                              {user.name}
                            </div>
                            {user.flexibleAttendance && (
                              <div className="text-[10px] text-violet-600 font-normal truncate">
                                Lintas kantor
                              </div>
                            )}
                            {displayJobTitle && (
                              <div
                                className="text-[10px] text-slate-400 font-normal truncate"
                                title={displayJobTitle}
                              >
                                {displayJobTitle}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label="PT" className="px-3 py-3 text-slate-600 text-xs">
                        {user.company ?? "—"}
                      </td>
                      <td
                        data-label="User ID"
                        className="px-3 py-3 font-mono text-[11px] text-slate-600 truncate"
                        title={user.userId}
                      >
                        {user.userId}
                      </td>
                      <td data-label="Role" className="px-3 py-3">
                        {canEditRoleRow ? (
                          <select
                            value={user.role}
                            disabled={updatingNik === user.nik}
                            onChange={(e) => handleRoleChange(user.nik, e.target.value as Role)}
                            className="input-field !py-1 !px-2 text-[11px] !w-full max-w-full disabled:opacity-50"
                          >
                            {assignableRoles
                              .filter((r) =>
                                user.company?.trim().toUpperCase() === IT_ROLE_COMPANY
                                  ? r === "SUPER_ADMIN" || r === "IT"
                                  : r !== "IT"
                              )
                              .map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 whitespace-nowrap">
                            {ROLE_LABELS[user.role]}
                          </span>
                        )}
                      </td>
                      {hasAksiCol && (
                        <td data-label="Aksi" className="px-3 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {canEditProfileRow && !isEditingProfile && (
                              <button
                                type="button"
                                onClick={() => startEditProfile(user)}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#503200] bg-[#fdf6e8] ring-1 ring-[#e8dfd0] hover:bg-[#f7c200]/20"
                              >
                                Profil
                              </button>
                            )}
                            {canManage && canDeleteRow && (
                              <button
                                type="button"
                                onClick={() => handleDelete(user.nik, user.name)}
                                disabled={deletingNik === user.nik || updatingNik === user.nik}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                {deletingNik === user.nik ? "..." : "Hapus"}
                              </button>
                            )}
                            {!canManage && canViewProfile && !canDeleteRow && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                            {canManage && !canDeleteRow && deleteBlockReason && (
                              <span className="text-[10px] text-slate-400 max-w-[120px] text-right leading-tight">
                                {deleteBlockReason}
                              </span>
                            )}
                            {canManage && !canEditRoleRow && !canDeleteRow && !deleteBlockReason && (
                              <span className="text-xs text-slate-400" title="Hanya Super Admin yang bisa mengubah role">
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {isEditingProfile && (
                      <tr className="bg-[#fdf6e8]/50">
                        <td colSpan={tableColCount} className="px-3 py-4">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#503200] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Edit Profil
                            </span>
                            <span className="text-sm font-medium text-slate-800">{profileDraft.name || user.name}</span>
                            <span className="text-xs text-slate-500 font-mono">NIK {user.nik}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl">
                            <div className="sm:col-span-2 lg:col-span-4">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Jabatan</label>
                              <input
                                type="text"
                                value={profileDraft.jobTitle}
                                onChange={(e) =>
                                  setProfileDraft({ ...profileDraft, jobTitle: e.target.value })
                                }
                                className={`${INPUT_CLASS} !py-1.5 text-sm`}
                                placeholder="Staff, Manager, Business Development, dll."
                              />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-4">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                User ID (login)
                              </label>
                              <input
                                type="text"
                                value={profileDraft.userId}
                                onChange={(e) =>
                                  setProfileDraft({ ...profileDraft, userId: e.target.value.toLowerCase() })
                                }
                                className={`${INPUT_CLASS} !py-1.5 text-sm font-mono`}
                                placeholder="muhammad.rijal"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Tgl Lahir</label>
                              <input
                                type="date"
                                value={profileDraft.birthDate ?? ""}
                                onChange={(e) =>
                                  setProfileDraft({ ...profileDraft, birthDate: e.target.value || null })
                                }
                                className={`${INPUT_CLASS} !py-1.5 text-sm`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Tgl Masuk</label>
                              <input
                                type="date"
                                value={profileDraft.joinDate ?? ""}
                                onChange={(e) =>
                                  setProfileDraft({ ...profileDraft, joinDate: e.target.value || null })
                                }
                                className={`${INPUT_CLASS} !py-1.5 text-sm`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">No. Rekening</label>
                              <input
                                type="text"
                                value={profileDraft.bankAccount ?? ""}
                                onChange={(e) =>
                                  setProfileDraft({ ...profileDraft, bankAccount: e.target.value || null })
                                }
                                className={`${INPUT_CLASS} !py-1.5 text-sm font-mono`}
                              />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-4">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Alamat Rumah</label>
                              <textarea
                                value={profileDraft.homeAddress ?? ""}
                                onChange={(e) =>
                                  setProfileDraft({ ...profileDraft, homeAddress: e.target.value || null })
                                }
                                className={`${INPUT_CLASS} !py-1.5 text-sm min-h-[64px] resize-y`}
                                rows={2}
                              />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-4 flex items-start gap-2 pt-1">
                              <input
                                id={`flex-${user.nik}`}
                                type="checkbox"
                                checked={profileDraft.flexibleAttendance}
                                onChange={(e) =>
                                  setProfileDraft({ ...profileDraft, flexibleAttendance: e.target.checked })
                                }
                                className="mt-1 rounded border-slate-300"
                              />
                              <label htmlFor={`flex-${user.nik}`} className="text-xs text-slate-600">
                                <span className="font-medium text-slate-800">Presensi lintas kantor</span> — untuk
                                karyawan yang sering pindah antar kantor/PT (mis. BCI ↔ DPI). Tetap wajib selfie +
                                GPS, geofence tidak diblokir.
                              </label>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              type="button"
                              disabled={updatingNik === user.nik}
                              onClick={() => saveProfile(user.nik)}
                              className="btn-primary !py-1.5 !px-4 text-xs"
                            >
                              {updatingNik === user.nik ? "Menyimpan..." : "Simpan Profil"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProfileNik(null)}
                              className="btn-secondary !py-1.5 !px-4 text-xs"
                            >
                              Batal
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
      </div>
    </div>
  );
}
