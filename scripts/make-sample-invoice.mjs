// Génère un PDF de facture d'exemple (pour tester l'import et l'analyse).
//   node scripts/make-sample-invoice.mjs [chemin-de-sortie.pdf]

import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";

const out = process.argv[2] ?? "facture-exemple.pdf";
const doc = new PDFDocument({ size: "A4", margin: 50 });
doc.pipe(createWriteStream(out));

doc.fontSize(18).text("STUDIO PIXEL SARL", { continued: false });
doc.fontSize(10).text("12 rue des Arts, 75011 Paris");
doc.text("SIRET : 820 192 837 00025");
doc.text("TVA intracommunautaire : FR55 820 192 837");
doc.moveDown();

doc.fontSize(16).text("FACTURE N° F2026-0142");
doc.moveDown(0.5);
doc.fontSize(10);
doc.text("Date de facture : 15/03/2026");
doc.text("Date d'échéance : 14/04/2026");
doc.moveDown();

doc.text("Client : Boulangerie Martin");
doc.text("5 avenue de la Gare, 69003 Lyon");
doc.moveDown();

doc.text("Désignation                         Qté      P.U. HT        Montant HT");
doc.text("Création site vitrine                 1     2 500,00 €      2 500,00 €");
doc.moveDown();

doc.text("Total HT                                                    2 500,00 €");
doc.text("TVA 20 %                                                      500,00 €");
doc.text("Total TTC                                                   3 000,00 €");
doc.moveDown();
doc.fontSize(12).text("Net à payer : 3 000,00 €");

doc.end();
console.log(`Écrit : ${out}`);
