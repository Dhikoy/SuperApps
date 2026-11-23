export type OfficeInventoryRow = {
  no: number;
  name: string;
  specification: string;
  quantity: number;
  category: string;
  condition: string;
  location: string;
  usageNote: string;
  holderHint: string | null;
};

/** Daftar Inventaris Kantor — PT Brown Cinnamons International. */
export const OFFICE_INVENTORY: OfficeInventoryRow[] = [
  { no: 1, name: "Laptop Advan", specification: "Soulmate 1405", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Mas Ryan, Dibawa", holderHint: "Ryan" },
  { no: 2, name: "Adapter Charger", specification: "Plug type", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Mas Ryan, Dibawa", holderHint: "Ryan" },
  { no: 3, name: "Mousepad pink", specification: "MO01", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Rifky", usageNote: "Digunakan Rifky, dibawa", holderHint: "Rifky" },
  { no: 4, name: "Laptop Axioo", specification: "Hype 5 AMD X3", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Novi", holderHint: "Novi" },
  { no: 5, name: "Adaptor Charger", specification: "Plug type", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Novi", holderHint: "Novi" },
  { no: 6, name: "Projector", specification: "Sonny WXGA VPL-EW276", quantity: 1, category: "Asset Kantor", condition: "Belum pernah di coba, kondisi baik", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 7, name: "IPHONE", specification: "14", quantity: 1, category: "Asset Kantor", condition: "Kaca kamera belakang pecah / retak", location: "Kantor", usageNote: "Digunakan Daffa, dibawa", holderHint: "Daffa" },
  { no: 8, name: "IPHONE", specification: "13", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Daffa, dibawa", holderHint: "Daffa" },
  { no: 9, name: "Laptop Lenovo", specification: "ThinkPad Ryzen Pro 7", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Daffa, dibawa", holderHint: "Daffa" },
  { no: 10, name: "Adapter Charger", specification: "Lenovo AC Adapter", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Daffa, dibawa", holderHint: "Daffa" },
  { no: 11, name: "Laptop Dell", specification: "Dell Latitude core i5", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Silfi", holderHint: "Silfi" },
  { no: 12, name: "Adapter charger", specification: "Dell Latitude Adapter", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Silfi", holderHint: "Silfi" },
  { no: 13, name: "Dispenser", specification: "Miyako", quantity: 1, category: "Asset Kantor", condition: "Tidak bisa dingin dan panasnya kurang", location: "Kantor", usageNote: "Tidak dicolokkan ke listrik", holderHint: null },
  { no: 14, name: "Meja Coklat muda baru", specification: "Meja", quantity: 9, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 15, name: "Meja Coklat tua lama", specification: "Meja", quantity: 5, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan 4", holderHint: null },
  { no: 16, name: "Meja coklat tua besar lama", specification: "Meja", quantity: 5, category: "Asset Ruko", condition: "Baik", location: "Kantor", usageNote: "Tidak di gunakan", holderHint: null },
  { no: 17, name: "Sound Kaki Tiga", specification: "Sound", quantity: 2, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak di gunakan", holderHint: null },
  { no: 18, name: "Lemari Es mini, pintu 1", specification: "Changchong", quantity: 1, category: "Asset Kantor", condition: "Belum dicoba", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 19, name: "Lemari Pajangan putih panjang", specification: "Lemari", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak di gunakan", holderHint: null },
  { no: 20, name: "Whiteboard", specification: "Papan belajar ada kaki", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 21, name: "Rak Pajangan besar putih", specification: "Rak", quantity: 1, category: "Asset Kantor", condition: "Sedikit agak rusak", location: "Kantor", usageNote: "Digunakan", holderHint: null },
  { no: 22, name: "Lemari Besi tertutup, kunci lengkap", specification: "Lemari besi", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan", holderHint: null },
  { no: 23, name: "PC dan keyboard Hp Intel core i3", specification: "Hp Intel core i3", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 24, name: "TV LCD", specification: "Sharp", quantity: 1, category: "Asset Kantor", condition: "Tidak berfungsi", location: "Kantor", usageNote: "Tidak di gunakan", holderHint: null },
  { no: 25, name: "AC Portable", specification: "Midea", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan", holderHint: null },
  { no: 26, name: "Meja Bulat", specification: "Meja", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan", holderHint: null },
  { no: 27, name: "TV LCD & Rak, camera lengkap", specification: "TV LCD & Rak nya", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 28, name: "Kipas Angin Dinding", specification: "Kipas Angin hitam", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan", holderHint: null },
  { no: 29, name: "PC dan keyboard", specification: "VA2223H", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Sephia", holderHint: "Sephia" },
  { no: 30, name: "Printer dan Scan", specification: "Epson L3210", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan Team", holderHint: null },
  { no: 31, name: "Magic com", specification: "Soseki", quantity: 1, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 32, name: "Kursi Coklat kecil", specification: "Kursi", quantity: 3, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "2 digunakan, 2 tidak", holderHint: null },
  { no: 33, name: "Kursi Hitam", specification: "Kursi", quantity: 2, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
  { no: 34, name: "Kursi Hitam 360", specification: "Kursi", quantity: 5, category: "Asset Kantor", condition: "Baik", location: "Kantor", usageNote: "Digunakan", holderHint: null },
  { no: 35, name: "Kursi abu-abu 360", specification: "Kursi", quantity: 2, category: "Asset Kantor", condition: "Rusak", location: "Kantor", usageNote: "Tidak digunakan", holderHint: null },
];

export function inventoryCode(no: number) {
  return `BCI-INV-${String(no).padStart(3, "0")}`;
}
