import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";

const TEMPLATE = path.join(process.cwd(), "templates", "asset-loan-form.docx");

export const DEFAULT_IT_DIRECTOR = "Putu Hadi Purnama Jati";

export type AssetLoanDocData = {
  borrowerName: string;
  jobTitle: string | null;
  homeAddress: string | null;
  contact: string | null;
  hrName: string;
  directorName: string;
  items: { assetName: string; serialNumber: string; specification: string | null }[];
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Teks bebas → isi <w:t>, baris baru menjadi <w:br/> di run yang sama. */
function wordText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(escapeXml)
    .join('</w:t><w:br/><w:t xml:space="preserve">');
}

function fill(xml: string, values: Record<string, string | null | undefined>) {
  return xml.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in values ? wordText(values[key]) : match));
}

function expandItemRows(xml: string, items: AssetLoanDocData["items"]) {
  const marker = xml.indexOf("{{barang}}");
  if (marker < 0) throw new Error("Template form peminjaman rusak (baris barang)");
  const start = xml.lastIndexOf("<w:tr ", marker);
  const end = xml.indexOf("</w:tr>", marker) + "</w:tr>".length;
  const row = xml.slice(start, end);
  const rows = (items.length ? items : [{ assetName: "", serialNumber: "", specification: "" }])
    .map((item) =>
      fill(row, {
        barang: item.serialNumber ? `${item.assetName}\nSN: ${item.serialNumber}` : item.assetName,
        spesifikasi: item.specification || "-",
      })
    )
    .join("");
  return xml.slice(0, start) + rows + xml.slice(end);
}

export async function buildAssetLoanDocx(data: AssetLoanDocData) {
  const zip = await JSZip.loadAsync(await fs.readFile(TEMPLATE));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Template form peminjaman tidak valid");
  let xml = await file.async("string");
  xml = expandItemRows(xml, data.items);
  xml = fill(xml, {
    nama: data.borrowerName,
    jabatan: data.jobTitle || "-",
    alamat: data.homeAddress || "-",
    kontak: data.contact || "-",
    pemegang: data.borrowerName,
    hrd: data.hrName,
    direktur: data.directorName || DEFAULT_IT_DIRECTOR,
  });
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
