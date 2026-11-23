export type AssetLabel = {
  name: string;
  serialNumber: string;
  specification?: string | null;
  quantity?: number | null;
  condition?: string | null;
  warehouse?: string | null;
  category?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelCard(item: AssetLabel, code: string) {
  return `<article class="label">
    <p class="brand">BCI · Aset Fisik</p>
    <p class="code">${escapeHtml(code)}</p>
    <p class="name">${escapeHtml(item.name)}</p>
    <p class="meta">${escapeHtml(item.specification || "—")}</p>
    <p class="meta">${escapeHtml(item.warehouse || "—")} · ${escapeHtml(item.condition || "—")}</p>
  </article>`;
}

export function printAssetLabels(items: AssetLabel[]) {
  const cards = items.flatMap((item) => {
    const copies = Math.min(Math.max(Number(item.quantity) || 1, 1), 30);
    if (copies === 1) return [labelCard(item, item.serialNumber)];
    return Array.from({ length: copies }, (_, index) =>
      labelCard(item, `${item.serialNumber}/${index + 1}`)
    );
  });

  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return false;

  popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Label Aset BCI</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #1c1408; }
    .sheet { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; }
    .label {
      width: 70mm;
      height: 36mm;
      border: 1px solid #503200;
      border-radius: 3mm;
      padding: 2.5mm 3mm;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .brand { margin: 0; font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: #503200; }
    .code { margin: 1mm 0 0; font-size: 14px; font-weight: 700; font-family: "Courier New", monospace; }
    .name { margin: 1mm 0 0; font-size: 12px; font-weight: 700; line-height: 1.2; }
    .meta { margin: 0.6mm 0 0; font-size: 9px; color: #3f3424; }
    @media print {
      body { margin: 0; }
      .sheet { gap: 4mm; padding: 4mm; }
    }
  </style>
</head>
<body>
  <div class="sheet">${cards.join("")}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  popup.document.close();
  return true;
}
