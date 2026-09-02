import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { maybeAutoBackup } from "@/lib/backup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Facturation & TVA",
  description: "Suivi des factures et de la TVA pour petite entreprise",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Sauvegarde automatique quotidienne (ne bloque pas l'affichage).
  setTimeout(maybeAutoBackup, 0);

  return (
    <html lang="fr" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
