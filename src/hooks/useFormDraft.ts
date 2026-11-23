"use client";

import { useEffect, useState } from "react";

/** Simpan draft form ke localStorage agar tidak hilang saat pindah tab/halaman. */
export function useFormDraft<T extends Record<string, unknown>>(storageKey: string, initial: T) {
  const [form, setForm] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<T>;
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* abaikan draft rusak */
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify(form));
  }, [form, ready, storageKey]);

  function clearDraft() {
    localStorage.removeItem(storageKey);
    setForm(initial);
  }

  return { form, setForm, clearDraft, ready };
}
