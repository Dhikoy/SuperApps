import { redirect } from "next/navigation";

/** Redirect lama — aset digital sekarang di modul Aset */
export default function AsetDigitalRedirectPage() {
  redirect("/dashboard/aset?tab=digital");
}
