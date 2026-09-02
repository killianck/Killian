import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
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
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <MobileNav />
          <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:py-8 lg:px-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
