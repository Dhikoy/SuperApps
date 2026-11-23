"use client";

import { useCompanies } from "@/hooks/useCompanies";
import { INPUT_CLASS } from "@/components/ui";

type CompanySelectProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  includeAll?: boolean;
  allLabel?: string;
};

export function CompanySelect({
  value,
  onChange,
  className = INPUT_CLASS,
  id,
  disabled,
  includeAll,
  allLabel = "Semua PT",
}: CompanySelectProps) {
  const { companies, loading } = useCompanies();

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled || loading}
    >
      {includeAll && <option value="">{allLabel}</option>}
      {companies.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
