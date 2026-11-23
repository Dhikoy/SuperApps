import { redirect } from "next/navigation";

export default function PembayaranPage() {
  redirect("/dashboard/keuangan/pengajuan?tab=pembayaran");
}
