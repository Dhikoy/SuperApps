import { redirect } from "next/navigation";

export default function AbsensiRedirect() {
  redirect("/dashboard/presensi");
}
