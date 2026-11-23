-- Outlet asal transaksi POS (mis. BMCG, PETIK) di bawah satu PT
ALTER TABLE "PosTransaction" ADD COLUMN "outlet" TEXT;
CREATE INDEX "PosTransaction_outlet_idx" ON "PosTransaction"("outlet");
