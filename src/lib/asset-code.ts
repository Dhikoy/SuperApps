/** Kode inventaris: {PREFIX}-INV-{NNN}, prefix mengikuti lokasi kantor / perusahaan pemegang. */
export const DEFAULT_ASSET_PREFIX = "BCI";

const PREFIX_RE = /^[A-Z0-9]{2,10}$/;

export function isValidAssetPrefix(prefix: string) {
  return PREFIX_RE.test(prefix);
}

function sanitize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

/** "PT BCI" → BCI, "LBB - Bakso Cak Gembul" → LBB, "Kantor"/lokasi lain → BCI. */
export function officePrefix(name: string) {
  if (name.trim().toLowerCase() === "kantor") return DEFAULT_ASSET_PREFIX;
  const head = name.split(/\s+-\s+/)[0].replace(/^(PT|CV)\.?\s+/i, "").trim();
  const prefix = sanitize(head.split(/\s+/)[0] ?? "");
  return isValidAssetPrefix(prefix) ? prefix : DEFAULT_ASSET_PREFIX;
}

export function assetCodePrefix(input: {
  location: string;
  offices: string[];
  employeeCompany?: string | null;
  isEmployee?: boolean;
}) {
  if (input.isEmployee) {
    const company = sanitize(input.employeeCompany ?? "");
    return isValidAssetPrefix(company) ? company : DEFAULT_ASSET_PREFIX;
  }
  if (input.offices.includes(input.location)) return officePrefix(input.location);
  return DEFAULT_ASSET_PREFIX;
}

export function formatAssetCode(prefix: string, seq: number) {
  return `${prefix}-INV-${String(seq).padStart(3, "0")}`;
}

export function nextAssetSeq(codes: string[], prefix: string) {
  const re = new RegExp(`^${prefix}-INV-(\\d+)$`);
  let max = 0;
  for (const code of codes) {
    const match = re.exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}
