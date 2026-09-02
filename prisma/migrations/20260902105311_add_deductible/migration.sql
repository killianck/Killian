-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
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
    "deductible" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'a_analyser',
    "coherence" TEXT NOT NULL DEFAULT 'a_verifier',
    "notes" TEXT,
    "originalFileName" TEXT,
    "originalFilePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Invoice" ("category", "coherence", "createdAt", "currency", "direction", "documentType", "dueDate", "id", "invoiceDate", "notes", "number", "originalFileName", "originalFilePath", "partyAddress", "partyName", "siret", "status", "totalHT", "totalTTC", "totalVAT", "updatedAt", "vatNumber") SELECT "category", "coherence", "createdAt", "currency", "direction", "documentType", "dueDate", "id", "invoiceDate", "notes", "number", "originalFileName", "originalFilePath", "partyAddress", "partyName", "siret", "status", "totalHT", "totalTTC", "totalVAT", "updatedAt", "vatNumber" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_direction_idx" ON "Invoice"("direction");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
