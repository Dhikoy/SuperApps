"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { hrFetchJson } from "@/lib/hr-fetch";

type OrgUser = {
  nik: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
  role: string;
  supervisorId: string | null;
  department: { name: string } | null;
};

function buildTree(users: OrgUser[]) {
  const byNik = new Map(users.map((u) => [u.nik, u]));
  const children = new Map<string, OrgUser[]>();

  for (const u of users) {
    const parent = u.supervisorId && byNik.has(u.supervisorId) ? u.supervisorId : "__root__";
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(u);
  }

  return children;
}

function OrgBranch({ user, childMap, depth }: { user: OrgUser; childMap: Map<string, OrgUser[]>; depth: number }) {
  const kids = childMap.get(user.nik) ?? [];
  return (
    <div className={depth > 0 ? "ml-6 border-l border-slate-200 pl-4" : ""}>
      <div className="py-2">
        <p className="font-medium text-slate-900">{user.name}</p>
        <p className="text-xs text-slate-500">
          {user.company} · {user.jobTitle ?? user.role}
          {user.department ? ` · ${user.department.name}` : ""}
        </p>
      </div>
      {kids.map((child) => (
        <OrgBranch key={child.nik} user={child} childMap={childMap} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function OrganisasiPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedNik, setSelectedNik] = useState("");
  const [supervisorId, setSupervisorId] = useState("");

  async function load() {
    const res = await hrFetchJson<{ users: OrgUser[] }>("/api/hr/organisasi");
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    setUsers(res.data.users ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSupervisor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNik) return;
    const res = await hrFetchJson("/api/hr/organisasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik: selectedNik, supervisorId: supervisorId || null }),
    });
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Atasan berhasil disimpan", "success");
    load();
  }

  const tree = buildTree(users);
  const roots = tree.get("__root__") ?? [];

  const byCompany = new Map<string, OrgUser[]>();
  for (const u of users) {
    const c = u.company ?? "Lainnya";
    if (!byCompany.has(c)) byCompany.set(c, []);
    byCompany.get(c)!.push(u);
  }

  return (
    <div className="space-y-6 p-8 max-w-4xl">
      <PageHeader
        title="Struktur Organisasi"
        subtitle="Hierarki atasan-bawahan berdasarkan supervisor"
        badge={`${users.length} karyawan`}
      />

      <Link href="/dashboard/hr" className="text-sm text-blue-600 hover:underline">
        ← Kembali ke Dashboard HR
      </Link>

      <form onSubmit={saveSupervisor} className="rounded-xl border bg-white p-5 grid sm:grid-cols-3 gap-3">
        <select value={selectedNik} onChange={(e) => setSelectedNik(e.target.value)} className="input-field" required>
          <option value="">Pilih karyawan</option>
          {users.map((u) => (
            <option key={u.nik} value={u.nik}>
              {u.name} ({u.company})
            </option>
          ))}
        </select>
        <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="input-field">
          <option value="">Tanpa atasan (root)</option>
          {users
            .filter((u) => u.nik !== selectedNik)
            .map((u) => (
              <option key={u.nik} value={u.nik}>
                {u.name}
              </option>
            ))}
        </select>
        <button type="submit" className="btn-primary">
          Simpan Atasan
        </button>
      </form>

      {[...byCompany.entries()].map(([company, companyUsers]) => {
        const companyRoots = companyUsers.filter(
          (u) => !u.supervisorId || !companyUsers.some((x) => x.nik === u.supervisorId)
        );
        const childMap = buildTree(companyUsers);

        return (
          <div key={company} className="rounded-xl border bg-white p-5">
            <h2 className="font-bold text-slate-900 mb-4">{company}</h2>
            {companyRoots.map((root) => (
              <OrgBranch key={root.nik} user={root} childMap={childMap} depth={0} />
            ))}
          </div>
        );
      })}

      {roots.length === 0 && users.length > 0 && (
        <p className="text-sm text-slate-500">Belum ada hierarki — atur atasan di form di atas.</p>
      )}
    </div>
  );
}
