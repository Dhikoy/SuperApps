import { redirect } from "next/navigation";

export default function ClockRedirect() {
  redirect("/dashboard/presensi/clock-in");
}
