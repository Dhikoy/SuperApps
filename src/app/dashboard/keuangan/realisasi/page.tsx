import { redirect } from "next/navigation";

export default function RealisasiPage() {
  redirect("/dashboard/keuangan/pengajuan?tab=realisasi");
}
