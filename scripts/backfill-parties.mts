// Crée les fiches Tiers à partir des factures déjà en base et les rattache.
// À lancer une seule fois (après la migration add_party) :  npm run db:backfill-parties

import { PrismaClient } from "@prisma/client";
import { resolveParty } from "../src/lib/invoices/party";

const prisma = new PrismaClient();

const invoices = await prisma.invoice.findMany({
  where: { partyId: null, partyName: { not: null } },
  orderBy: { createdAt: "asc" },
});

let linked = 0;
for (const inv of invoices) {
  const party = await resolveParty(prisma, {
    name: inv.partyName,
    address: inv.partyAddress,
    siret: inv.siret,
    vatNumber: inv.vatNumber,
    direction: inv.direction,
  });
  if (party.partyId) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { partyId: party.partyId, partyName: party.partyName },
    });
    linked++;
  }
}

const count = await prisma.party.count();
console.log(`✅ ${linked} facture(s) rattachée(s). ${count} fiche(s) Tiers au total.`);
await prisma.$disconnect();
