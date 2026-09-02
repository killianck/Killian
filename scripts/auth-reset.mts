// Réinitialise le mot de passe d'un compte (dépannage).
//
//   npm run auth:reset                      -> liste les comptes
//   npm run auth:reset -- <nom>             -> nouveau mot de passe aléatoire
//   npm run auth:reset -- <nom> <mot-de-passe>
//
// Agit sur la base pointée par DATABASE_URL (base de développement par défaut).
// Pour l'application installée : la base est dans %APPDATA%\facturation-tva et,
// si le chiffrement est activé, elle n'est lisible que par l'application.

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();
const [name, password] = process.argv.slice(2);

if (!name) {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  if (users.length === 0) {
    console.log("Aucun compte. Le premier se crée au démarrage de l'application.");
  } else {
    console.log("Comptes :");
    for (const u of users) console.log(`  - ${u.name} (${u.role})`);
    console.log("\nUsage : npm run auth:reset -- <nom> [nouveau-mot-de-passe]");
  }
} else {
  const user = await prisma.user.findUnique({ where: { name } });
  if (!user) {
    console.error(`Compte « ${name} » introuvable.`);
    process.exitCode = 1;
  } else {
    const pw = password || randomBytes(6).toString("base64url");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(pw) } });
    console.log(`✅ Mot de passe de « ${name} » réinitialisé.`);
    console.log(`   Nouveau mot de passe : ${pw}`);
    console.log("   Changez-le après connexion (Paramètres → Utilisateurs).");
  }
}

await prisma.$disconnect();
