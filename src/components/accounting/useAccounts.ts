"use client";

import { useEffect, useState } from "react";
import type { AccountGroupKey } from "@/lib/accounting/constants";

export type AccountOption = {
  code: string;
  name: string;
  group: AccountGroupKey;
  isHeader: boolean;
  normalBalance: "DEBIT" | "CREDIT";
  isCash: boolean;
  active: boolean;
  lineCount: number;
};

let cache: Promise<AccountOption[]> | null = null;

function fetchAccounts(): Promise<AccountOption[]> {
  if (!cache) {
    cache = fetch("/api/finance/accounting/accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => {
        cache = null;
        return [];
      });
  }
  return cache;
}

/** Buang cache setelah COA diubah. */
export function invalidateAccounts() {
  cache = null;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchAccounts().then((list) => {
      if (!alive) return;
      setAccounts(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  return {
    accounts,
    loading,
    reload: () => {
      invalidateAccounts();
      setVersion((v) => v + 1);
    },
  };
}
