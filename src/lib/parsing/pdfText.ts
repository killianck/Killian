// Lecture du texte d'un PDF (sans service externe).
// S'appuie sur "unpdf" (moteur pdf.js de Mozilla), sans dépendance native.

import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text) ?? "";
}
