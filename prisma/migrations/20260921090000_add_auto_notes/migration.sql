-- Explications générées automatiquement (rapprochement des relevés).
-- Séparées de `notes`, qui appartient à l'utilisateur : le rapprochement
-- écrasait sa saisie à chaque recalcul.
ALTER TABLE "Invoice" ADD COLUMN "autoNotes" TEXT;

-- Reprise : les notes des relevés existants sont, elles, générées — on les
-- déplace vers la nouvelle colonne pour ne rien perdre à l'affichage.
UPDATE "Invoice" SET "autoNotes" = "notes", "notes" = NULL
WHERE "isStatement" = true AND "notes" IS NOT NULL;
