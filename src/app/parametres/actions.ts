"use server";

import { revalidatePath } from "next/cache";
import { runBackup } from "@/lib/backup";

export async function backupNow(): Promise<void> {
  try {
    runBackup();
  } catch (e) {
    console.error("Sauvegarde manuelle impossible :", e);
  }
  revalidatePath("/parametres");
}
