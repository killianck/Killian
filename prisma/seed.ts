// Données fictives pour tester rapidement l'application.
// Lancer : npm run db:seed   (ou automatiquement via npm run db:reset)

import { PrismaClient } from "@prisma/client";
import { checkCoherence } from "../src/lib/tva/coherence";
import { resolveParty } from "../src/lib/invoices/party";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

type SeedLine = { rate: number; baseHT: number; vatAmount: number };
type SeedInvoice = {
  documentType: "facture" | "avoir";
  direction: "achat" | "vente";
  category?: string;
  number: string;
  invoiceDate: string;
  dueDate?: string;
  partyName: string;
  partyAddress?: string;
  siret?: string;
  vatNumber?: string;
  status: string;
  notes?: string;
  lines: SeedLine[];
};

const line = (rate: number, baseHT: number): SeedLine => ({
  rate,
  baseHT,
  vatAmount: Math.round(((baseHT * rate) / 100) * 100) / 100,
});

const DATA: SeedInvoice[] = [
  // --- Ventes (clients) ---
  {
    documentType: "facture", direction: "vente", category: "services",
    number: "F2026-001", invoiceDate: "2026-01-12", dueDate: "2026-02-11",
    partyName: "Boulangerie Martin", partyAddress: "12 rue des Lilas, 69003 Lyon",
    siret: "12345678900012", vatNumber: "FR12123456789",
    status: "validee", lines: [line(20, 2500)],
  },
  {
    documentType: "facture", direction: "vente", category: "services",
    number: "F2026-002", invoiceDate: "2026-01-28", dueDate: "2026-02-27",
    partyName: "Cabinet Dupont & Associés", partyAddress: "5 avenue Foch, 75116 Paris",
    status: "validee", lines: [line(20, 1800), line(10, 400)],
  },
  {
    documentType: "facture", direction: "vente", category: "services",
    number: "F2026-003", invoiceDate: "2026-02-09", dueDate: "2026-03-11",
    partyName: "Boulangerie Martin", status: "validee", lines: [line(20, 3200)],
  },
  {
    documentType: "avoir", direction: "vente", category: "services",
    number: "AV2026-001", invoiceDate: "2026-02-18",
    partyName: "Cabinet Dupont & Associés",
    status: "validee", notes: "Remise commerciale sur F2026-002", lines: [line(20, 200)],
  },
  {
    documentType: "facture", direction: "vente", category: "services",
    number: "F2026-004", invoiceDate: "2026-03-05", dueDate: "2026-04-04",
    partyName: "Mairie de Villeurbanne", vatNumber: "FR40987654321",
    status: "validee", lines: [line(20, 5400)],
  },
  {
    documentType: "facture", direction: "vente", category: "services",
    number: "F2026-005", invoiceDate: "2026-04-14", dueDate: "2026-05-14",
    partyName: "Boulangerie Martin", status: "a_verifier", lines: [line(20, 2750)],
  },
  {
    documentType: "facture", direction: "vente",
    number: "F2026-006", invoiceDate: "2026-05-06", dueDate: "2026-06-05",
    partyName: "Association Sportive du Rhône",
    status: "validee", notes: "Prestation exonérée", lines: [line(0, 900)],
  },

  // --- Achats (fournisseurs) ---
  {
    documentType: "facture", direction: "achat", category: "fournitures",
    number: "FA-7781", invoiceDate: "2026-01-08", dueDate: "2026-01-08",
    partyName: "Bureau Vallée", partyAddress: "ZAC des Portes, 69800 Saint-Priest",
    siret: "55210055500018",
    status: "validee", lines: [line(20, 340.5)],
  },
  {
    documentType: "facture", direction: "achat", category: "transport",
    number: "SNCF-2026-0455", invoiceDate: "2026-01-22",
    partyName: "SNCF Voyageurs",
    status: "validee", lines: [line(10, 128.2)],
  },
  {
    documentType: "facture", direction: "achat", category: "materiel",
    number: "LDLC-99120", invoiceDate: "2026-02-03", dueDate: "2026-03-05",
    partyName: "LDLC.com", siret: "40397339400047",
    status: "validee", lines: [line(20, 1499)],
  },
  {
    documentType: "facture", direction: "achat", category: "sous_traitance",
    number: "STP-0012", invoiceDate: "2026-02-27", dueDate: "2026-03-29",
    partyName: "Studio Pixel (sous-traitant)", siret: "82019283700025", vatNumber: "FR55820192837",
    status: "validee", lines: [line(20, 2200)],
  },
  {
    documentType: "facture", direction: "achat", category: "services",
    number: "OVH-558712", invoiceDate: "2026-03-01", dueDate: "2026-03-01",
    partyName: "OVH SAS", siret: "42476141900045", vatNumber: "FR22424761419",
    status: "validee", notes: "Hébergement mensuel", lines: [line(20, 79.9)],
  },
  {
    documentType: "facture", direction: "achat", category: "fournitures",
    number: "AMZ-2026-33417", invoiceDate: "2026-03-19", dueDate: "2026-03-19",
    partyName: "Amazon EU",
    status: "a_verifier", notes: "Plusieurs taux sur la facture", lines: [line(20, 210), line(5.5, 60)],
  },
  {
    documentType: "facture", direction: "achat", category: "transport",
    number: "TOTAL-4471", invoiceDate: "2026-04-02", dueDate: "2026-04-30",
    partyName: "TotalEnergies", status: "validee", lines: [line(20, 92.3)],
  },
  {
    documentType: "avoir", direction: "achat", category: "materiel",
    number: "LDLC-AV-201", invoiceDate: "2026-04-10",
    partyName: "LDLC.com", status: "validee", notes: "Retour d'un article", lines: [line(20, 149)],
  },
  {
    documentType: "facture", direction: "achat", category: "autre",
    number: "URSSAF-INFO", invoiceDate: "2026-05-15",
    partyName: "Expert-comptable Ludo",
    status: "a_analyser", notes: "À classer", lines: [line(20, 450)],
  },
  {
    documentType: "facture", direction: "achat", category: "services",
    number: "OVH-561238", invoiceDate: "2026-05-01", dueDate: "2026-06-01",
    partyName: "OVH SAS", status: "validee", lines: [line(20, 79.9)],
  },
];

function totals(lines: SeedLine[]) {
  const totalHT = Math.round(lines.reduce((s, l) => s + l.baseHT, 0) * 100) / 100;
  const totalVAT = Math.round(lines.reduce((s, l) => s + l.vatAmount, 0) * 100) / 100;
  const totalTTC = Math.round((totalHT + totalVAT) * 100) / 100;
  return { totalHT, totalVAT, totalTTC };
}

async function main() {
  // GARDE-FOU : ce script EFFACE toutes les données. Il refuse de s'exécuter en
  // production ou sur une base qui contient déjà des factures, sauf FORCE_SEED=1.
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:seed est interdit en production.");
  }
  const existing = await prisma.invoice.count();
  if (existing > 0 && process.env.FORCE_SEED !== "1") {
    throw new Error(
      `La base contient déjà ${existing} facture(s). db:seed les EFFACERAIT. ` +
        "Utilisez une base de développement séparée, ou relancez avec FORCE_SEED=1 si vous êtes sûr.",
    );
  }

  console.log("Nettoyage des tables...");
  await prisma.invoiceRevision.deleteMany();
  await prisma.vatLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.party.deleteMany();

  // Compte de démonstration (développement uniquement) : admin / motdepasse
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: { name: "admin", passwordHash: hashPassword("motdepasse"), role: "admin" },
  });
  console.log("Compte de démonstration : admin / motdepasse");

  console.log(`Insertion de ${DATA.length} factures fictives...`);
  for (const d of DATA) {
    const t = totals(d.lines);
    const coherence = checkCoherence({ ...t, vatLines: d.lines }).level;

    const party = await resolveParty(prisma, {
      name: d.partyName,
      address: d.partyAddress ?? null,
      siret: d.siret ?? null,
      vatNumber: d.vatNumber ?? null,
      direction: d.direction,
    });

    await prisma.invoice.create({
      data: {
        documentType: d.documentType,
        direction: d.direction,
        category: d.category ?? null,
        number: d.number,
        invoiceDate: new Date(d.invoiceDate),
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        partyId: party.partyId,
        partyName: party.partyName,
        partyAddress: party.partyAddress,
        siret: party.siret,
        vatNumber: party.vatNumber,
        currency: "EUR",
        totalHT: t.totalHT,
        totalVAT: t.totalVAT,
        totalTTC: t.totalTTC,
        status: d.status,
        coherence,
        notes: d.notes ?? null,
        vatLines: {
          create: d.lines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })),
        },
      },
    });
  }

  const count = await prisma.invoice.count();
  const parties = await prisma.party.count();
  console.log(`✅ Terminé : ${count} factures et ${parties} tiers en base.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
