import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { getCurrentUser } from "@/lib/auth";
import { resumeStuckAnalyses } from "@/lib/invoices/analysisQueue";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  // Reprend une analyse restée en plan (ex. app fermée en cours d'OCR). Peu coûteux
  // (au plus une fois toutes les 30 s, requête indexée).
  void resumeStuckAnalyses();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar user={user} />
      <MobileNav user={user} />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:py-8 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
