"use server";

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { runBackup } from "@/lib/backup";
import { requireAdmin, requireUser } from "@/lib/auth";
import { dataDir } from "@/lib/paths";
import { ENCRYPTION_MARKER } from "@/lib/encryption";

export async function backupNow(): Promise<void> {
  await requireUser();
  try {
    runBackup();
  } catch (e) {
    // L'échec est persisté par runBackup ; la page Paramètres l'affiche en rouge.
    console.error("Sauvegarde manuelle impossible :", e);
  }
  revalidatePath("/parametres");
}

/**
 * Active ou désactive le chiffrement des données. Ne fait que poser/retirer un
 * marqueur : le (dé)chiffrement réel a lieu au prochain démarrage de l'app.
 */
export async function setEncryption(enable: boolean): Promise<void> {
  await requireAdmin();
  const marker = path.join(dataDir(), ENCRYPTION_MARKER);
  if (enable) {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(marker, "actif\n");
  } else {
    rmSync(marker, { force: true });
  }
  revalidatePath("/parametres");
}
