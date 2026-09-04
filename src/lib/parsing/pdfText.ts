// Lecture du texte d'un PDF (sans service externe).
// S'appuie sur "unpdf" (moteur pdf.js de Mozilla), sans dépendance native.

import { extractText, getDocumentProxy } from "unpdf";

/** On ne lit le texte que des premières pages (une facture est courte). */
const MAX_TEXT_PAGES = 6;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);

  const total = pdf.numPages ?? 1;
  if (total <= MAX_TEXT_PAGES) {
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text) ?? "";
  }

  // Document long : on lit les premières pages + les 2 dernières (totaux).
  const wanted = [...Array(MAX_TEXT_PAGES).keys(), total - 2, total - 1].filter(
    (n, i, a) => n >= 0 && n < total && a.indexOf(n) === i,
  );
  const { text } = await extractText(pdf, { mergePages: false });
  const perPage = Array.isArray(text) ? text : [String(text ?? "")];
  return wanted.map((i) => perPage[i] ?? "").join("\n");
}
