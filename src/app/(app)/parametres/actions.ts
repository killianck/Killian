"use server";

import { revalidatePath } from "next/cache";
import { runBackup } from "@/lib/backup";
import { requireUser } from "@/lib/auth";

export async function backupNow(): Promise<void> {
  await requireUser();
  try {
    runBackup();
  } catch (e) {
    console.error("Sauvegarde manuelle impossible :", e);
  }
  revalidatePath("/parametres");
}
