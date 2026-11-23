import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { LedgerView } from "@/components/accounting/LedgerView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BukuBesarPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  requirePermission(session.role, "finance:view");
  const sp = await searchParams;

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Buku Besar" subtitle="Mutasi debit/kredit dan saldo berjalan per akun" />
      <LedgerView
        initial={{
          account: first(sp.account),
          from: first(sp.from),
          to: first(sp.to),
          company: first(sp.company),
        }}
      />
    </div>
  );
}
