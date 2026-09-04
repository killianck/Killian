-- Relevés de factures : marquage + cumul imprimé (colonnes additives).
ALTER TABLE "Invoice" ADD COLUMN "isStatement" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN "statementGrossHT" REAL;
ALTER TABLE "Invoice" ADD COLUMN "statementGrossVAT" REAL;
ALTER TABLE "Invoice" ADD COLUMN "statementGrossTTC" REAL;

-- CreateIndex
CREATE INDEX "Invoice_isStatement_idx" ON "Invoice"("isStatement");

-- CreateTable
CREATE TABLE "StatementLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "label" TEXT,
    "lineDate" DATETIME,
    "dueDate" DATETIME,
    "amountHT" REAL,
    "amountVAT" REAL,
    "amountTTC" REAL,
    "matchedInvoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatementLine_matchedInvoiceId_fkey" FOREIGN KEY ("matchedInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StatementLine_statementId_idx" ON "StatementLine"("statementId");

-- CreateIndex
CREATE INDEX "StatementLine_matchedInvoiceId_idx" ON "StatementLine"("matchedInvoiceId");

-- CreateIndex
CREATE INDEX "StatementLine_reference_idx" ON "StatementLine"("reference");
