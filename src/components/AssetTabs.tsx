"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AssetManager } from "@/components/AssetManager";
import { AssetLoanManager } from "@/components/AssetLoanManager";
import { DigitalAssetManager } from "@/components/DigitalAssetManager";

type AssetTabsProps = {
  canManagePhysical: boolean;
  canManageDigital: boolean;
  currentUserName: string;
};

type Tab = "fisik" | "peminjaman" | "digital";

export function AssetTabs({ canManagePhysical, canManageDigital, currentUserName }: AssetTabsProps) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const initialTab: Tab =
    requested === "digital" && canManageDigital
      ? "digital"
      : requested === "peminjaman" && canManagePhysical
        ? "peminjaman"
        : "fisik";
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "fisik", label: "Aset Fisik", show: true },
    { key: "peminjaman", label: "Peminjaman Barang", show: canManagePhysical },
    { key: "digital", label: "Aset Digital", show: canManageDigital },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "fisik" && <AssetManager canManage={canManagePhysical} />}
      {tab === "peminjaman" && <AssetLoanManager currentUserName={currentUserName} />}
      {tab === "digital" && <DigitalAssetManager embedded />}
    </div>
  );
}
