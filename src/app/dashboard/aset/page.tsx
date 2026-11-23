import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { PageHeader, requirePermission } from "@/components/ui";
import { hasPermission } from "@/lib/roles";
import { canManageDigitalAssets } from "@/lib/digital-asset-auth";
import { AssetTabs } from "@/components/AssetTabs";

export default async function AsetPage() {
  const session = await getSession();
  if (!session) return null;
  requirePermission(session.role, "assets:view");

  const canManagePhysical = hasPermission(session.role, "assets:manage");
  const canManageDigital = canManageDigitalAssets(session.role);

  const subtitle = canManagePhysical || canManageDigital
    ? "Kelola aset fisik (perangkat) dan aset digital (langganan/lisensi)"
    : "Aset fisik yang ditugaskan kepada Anda";

  return (
    <div className="space-y-6">
      <PageHeader title="Aset" subtitle={subtitle} />
      <Suspense fallback={<div className="text-sm text-slate-500">Memuat...</div>}>
        <AssetTabs
          canManagePhysical={canManagePhysical}
          canManageDigital={canManageDigital}
          currentUserName={session.name}
        />
      </Suspense>
    </div>
  );
}
