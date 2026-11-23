-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docType" TEXT NOT NULL DEFAULT 'INVOICE',
    "invoiceNumber" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyFullName" TEXT,
    "customerName" TEXT,
    "customerAddress" TEXT,
    "receivedFrom" TEXT,
    "paymentFor" TEXT,
    "subject" TEXT,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "amountInWords" TEXT,
    "notes" TEXT,
    "paymentMethod" TEXT,
    "paymentSource" TEXT,
    "paymentDestination" TEXT,
    "preparedByName" TEXT NOT NULL DEFAULT 'Reyvika',
    "preparedByTitle" TEXT NOT NULL DEFAULT 'Admin Finance',
    "approvedByName" TEXT NOT NULL DEFAULT 'Handayani',
    "approvedByTitle" TEXT NOT NULL DEFAULT 'Head Of Finance',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("nik") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_company_idx" ON "Invoice"("company");

-- CreateIndex
CREATE INDEX "Invoice_docType_idx" ON "Invoice"("docType");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
