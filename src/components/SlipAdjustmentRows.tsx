import { formatRupiah } from "@/lib/payroll-policy";

type Props = {
  adjustment?: { allowance: number; mealAllowance: number; deduction: number; note: string | null } | null;
  penaltyAmount?: number;
};

export function SlipAdjustmentRows({ adjustment, penaltyAmount = 0 }: Props) {
  const rows: [string, number, string][] = [
    ["Insentif / Tunjangan", adjustment?.allowance ?? 0, ""],
    ["Uang Makan", adjustment?.mealAllowance ?? 0, ""],
    ["Potongan Penalti", -penaltyAmount, "text-red-700"],
    ["Potongan Lain", -(adjustment?.deduction ?? 0), "text-red-700"],
  ];
  return (
    <>
      {rows
        .filter(([, amount]) => amount !== 0)
        .map(([label, amount, cls]) => (
          <div key={label} className={`flex justify-between ${cls}`}>
            <span>{label}</span>
            <span>{amount < 0 ? `−${formatRupiah(-amount)}` : formatRupiah(amount)}</span>
          </div>
        ))}
      {adjustment?.note && <p className="text-xs text-slate-500">Ket: {adjustment.note}</p>}
    </>
  );
}
