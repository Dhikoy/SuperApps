"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COMPANIES } from "@/lib/companies";
import type { CompanyRow } from "@/lib/companies";

export function useCompanies(activeOnly = true) {
  const [companies, setCompanies] = useState<string[]>([...DEFAULT_COMPANIES]);
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = activeOnly ? "" : "?all=1";
    fetch(`/api/companies${params}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setRows(list);
        setCompanies(list.filter((c: CompanyRow) => c.isActive !== false).map((c: CompanyRow) => c.code));
      })
      .catch(() => {
        setCompanies([...DEFAULT_COMPANIES]);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [activeOnly]);

  return { companies, rows, loading };
}
