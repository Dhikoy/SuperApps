/** Terbilang Rupiah — spek Detailing Invoice (hindari ketik manual). */

const SATUAN = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
  "Sepuluh",
  "Sebelas",
];

function belowThousand(n: number): string {
  if (n < 12) return SATUAN[n] ?? "";
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rest = n % 10;
    return `${SATUAN[tens]} Puluh${rest ? ` ${SATUAN[rest]}` : ""}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? "Seratus" : `${SATUAN[hundreds]} Ratus`;
  return rest ? `${head} ${belowThousand(rest)}` : head;
}

function sayNumber(n: number): string {
  if (n === 0) return "Nol";
  if (n < 1000) return belowThousand(n);

  const groups: { value: number; label: string; singular: string }[] = [
    { value: 1_000_000_000_000, label: "Triliun", singular: "Satu Triliun" },
    { value: 1_000_000_000, label: "Miliar", singular: "Satu Miliar" },
    { value: 1_000_000, label: "Juta", singular: "Satu Juta" },
    { value: 1_000, label: "Ribu", singular: "Seribu" },
  ];

  for (const g of groups) {
    if (n >= g.value) {
      const count = Math.floor(n / g.value);
      const rest = n % g.value;
      const head =
        count === 1 && (g.value === 1_000 || g.value >= 1_000_000)
          ? g.singular
          : `${belowThousand(count)} ${g.label}`;
      return rest ? `${head} ${sayNumber(rest)}` : head;
    }
  }
  return belowThousand(n);
}

/** Contoh: 5_000_000 → "Lima Juta Rupiah" */
export function terbilangRupiah(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  if (!Number.isFinite(rounded)) return "";
  return `${sayNumber(rounded)} Rupiah`;
}

/** Format kwitansi: "# Lima Juta Rupiah #" */
export function terbilangKwitansi(amount: number): string {
  const words = terbilangRupiah(amount);
  return words ? `# ${words} #` : "";
}
