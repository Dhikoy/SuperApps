-- CreateTable
CREATE TABLE "AssetTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signedPath" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AssetTransfer_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("nik") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssetTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssetTransfer_assetId_idx" ON "AssetTransfer"("assetId");

-- CreateIndex
CREATE INDEX "AssetTransfer_status_idx" ON "AssetTransfer"("status");
