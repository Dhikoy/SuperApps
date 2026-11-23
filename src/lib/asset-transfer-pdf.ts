import { jsPDF } from "jspdf";

export type AssetTransferPdf = {
  id: string;
  assetName: string;
  serialNumber: string;
  condition: string;
  fromLocation: string;
  toLocation: string;
  createdAt: Date | string;
};

function dateId(value: Date | string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function field(doc: jsPDF, label: string, value: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.text(label, 18, y);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(value || "-", 118);
  doc.text(lines, 68, y);
  return y + Math.max(8, lines.length * 5);
}

export function buildAssetTransferPdf(data: AssetTransferPdf) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PT BROWN CINNAMONS INTERNATIONAL", 105, 18, { align: "center" });
  doc.setFontSize(14);
  doc.text("BERITA ACARA SERAH TERIMA BARANG", 105, 28, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`No. ${data.id.slice(-8).toUpperCase()}`, 18, 40);
  doc.text(`Tanggal: ${dateId(data.createdAt)}`, 18, 46);

  let y = 58;
  y = field(doc, "Nama barang", data.assetName, y);
  y = field(doc, "Kode barang", data.serialNumber, y);
  y = field(doc, "Kondisi barang", data.condition, y);
  y = field(doc, "Dari", data.fromLocation, y);
  y = field(doc, "Tujuan", data.toLocation, y);

  y += 6;
  doc.setFontSize(10);
  const note = doc.splitTextToSize(
    "Barang tersebut dipindahkan dari lokasi sebelumnya ke tujuan di atas. Form ini ditandatangani basah oleh penyerah dan penerima.",
    174
  );
  doc.text(note, 18, y);
  y += note.length * 5 + 14;

  const boxes = [
    { title: "Penyerah", name: data.fromLocation },
    { title: "Penerima", name: data.toLocation },
    { title: "Mengetahui", name: "" },
  ];
  boxes.forEach((box, index) => {
    const x = 18 + index * 62;
    doc.rect(x, y, 54, 28);
    doc.setFont("helvetica", "bold");
    doc.text(box.title, x + 27, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const caption = doc.splitTextToSize(box.name || " ", 48);
    doc.text(caption, x + 27, y + 36, { align: "center" });
    doc.setFontSize(10);
  });

  return doc;
}
