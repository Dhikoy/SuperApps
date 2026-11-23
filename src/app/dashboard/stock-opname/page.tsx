import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";
import { redirect } from "next/navigation";
import { StockOpnamePanel } from "@/components/StockOpnamePanel";

export default async function StockOpnamePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isKeuangan = hasPermission(session.role, "finance:view");
  const canSuggestFund = hasPermission(session.role, "finance:submit");

  return (
    <div className="p-8">
      <StockOpnamePanel
        title="Stock Opname"
        subtitle={
          isKeuangan
            ? "Input stok fisik — auto-suggest pengajuan dana jika stok kurang"
            : "Input stok fisik barang operasional"
        }
        allowFundSuggest={canSuggestFund}
      />
    </div>
  );
}
