-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outlet" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT 'LBB',
    "invoiceNo" TEXT NOT NULL,
    "saleDate" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMethod" TEXT,
    "qrisAmount" REAL NOT NULL DEFAULT 0,
    "orderType" TEXT,
    "onlinePlatform" TEXT,
    "cashier" TEXT,
    "items" TEXT,
    "posStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "voidedAt" DATETIME,
    "voidReason" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_outlet_invoiceNo_key" ON "PosSale"("outlet", "invoiceNo");

-- CreateIndex
CREATE INDEX "PosSale_outlet_saleDate_idx" ON "PosSale"("outlet", "saleDate");

-- CreateIndex
CREATE INDEX "PosSale_saleDate_idx" ON "PosSale"("saleDate");
