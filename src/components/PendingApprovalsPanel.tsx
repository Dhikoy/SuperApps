"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PendingItem = {
  type: string;
  label: string;
  count: number;
  href: string;
};

export function PendingApprovalsPanel() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/notifications/pending")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {});
  }, []);

  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="font-semibold text-amber-900">
        {total} item menunggu persetujuan Anda
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.type}
            href={item.href}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
          >
            {item.label}
            <span className="rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5">
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
