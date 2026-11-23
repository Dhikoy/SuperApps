"use client";

import { INPUT_CLASS } from "@/components/ui";
import { REPORT_SECTIONS, sectionForCode, type AccountGroupKey } from "@/lib/accounting/constants";
import { useAccounts } from "./useAccounts";

type Props = {
  value: string;
  onChange: (code: string) => void;
  groups?: AccountGroupKey[];
  cashOnly?: boolean;
  /** Label opsi kosong; tanpa ini pilihan wajib */
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
};

export function AccountSelect({
  value,
  onChange,
  groups,
  cashOnly,
  emptyLabel,
  className = INPUT_CLASS,
  disabled,
  required,
  id,
}: Props) {
  const { accounts, loading } = useAccounts();

  const options = accounts.filter(
    (a) =>
      !a.isHeader &&
      (a.active || a.code === value) &&
      (!groups || groups.includes(a.group)) &&
      (!cashOnly || a.isCash)
  );

  const bySection = REPORT_SECTIONS.map((section) => ({
    section,
    items: options.filter((a) => sectionForCode(a.code)?.key === section.key),
  })).filter((g) => g.items.length > 0);
  const other = options.filter((a) => !sectionForCode(a.code));

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled || loading}
      required={required}
    >
      {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : !value && <option value="">Pilih akun…</option>}
      {bySection.map(({ section, items }) => (
        <optgroup key={section.key} label={section.label}>
          {items.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.name}
            </option>
          ))}
        </optgroup>
      ))}
      {other.length > 0 && (
        <optgroup label="Lainnya">
          {other.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
