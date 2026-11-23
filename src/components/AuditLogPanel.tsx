"use client";

import { useEffect, useState } from "react";

type AuditEntry = {
  id: string;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
};

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetch("/api/audit?limit=50")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .catch(() => {});
  }, []);

  if (logs.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada log audit</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b">
            <th className="py-2 pr-4">Waktu</th>
            <th className="py-2 pr-4">Actor</th>
            <th className="py-2 pr-4">Aksi</th>
            <th className="py-2 pr-4">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString("id-ID")}
              </td>
              <td className="py-2 pr-4">{log.actorName ?? "-"}</td>
              <td className="py-2 pr-4 font-mono text-xs">{log.action}</td>
              <td className="py-2 pr-4 text-slate-600">{log.details ?? `${log.entity} ${log.entityId ?? ""}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
