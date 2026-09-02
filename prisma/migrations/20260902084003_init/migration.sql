-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL DEFAULT 'facture',
    "direction" TEXT NOT NULL DEFAULT 'achat',
    "category" TEXT,
    "number" TEXT,
    "invoiceDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "partyName" TEXT,
    "partyAddress" TEXT,
    "siret" TEXT,
    "vatNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "totalHT" REAL NOT NULL DEFAULT 0,
    "totalVAT" REAL NOT NULL DEFAULT 0,
    "totalTTC" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'a_analyser',
    "coherence" TEXT NOT NULL DEFAULT 'a_verifier',
    "notes" TEXT,
    "originalFileName" TEXT,
    "originalFilePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VatLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "baseHT" REAL NOT NULL,
    "vatAmount" REAL NOT NULL,
    CONSTRAINT "VatLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    CONSTRAINT "InvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_direction_idx" ON "Invoice"("direction");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "VatLine_invoiceId_idx" ON "VatLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceRevision_invoiceId_idx" ON "InvoiceRevision"("invoiceId");
