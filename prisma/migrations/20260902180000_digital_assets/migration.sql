-- CreateTable
CREATE TABLE "DigitalAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceName" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "activeFrom" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
