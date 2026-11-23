import { redirect } from "next/navigation";

export default function PersetujuanDanaPage() {
  redirect("/dashboard/keuangan/pengajuan?tab=approval");
}
