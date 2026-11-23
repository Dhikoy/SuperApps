import { redirect } from "next/navigation";

export default function HrStockRedirect() {
  redirect("/dashboard/stock-opname");
}
