import { prisma } from "@/lib/db";
import { buildInvoicesWorkbook } from "@/lib/export/excel";
import { getCurrentUser } from "@/lib/auth";
import { DIRECTIONS } from "@/lib/domain/enums";

export const dynamic = "force-dynamic";

// GET /api/export/factures  -> télécharge un fichier Excel des factures.
// Filtres optionnels : ?year=2026&direction=achat
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorisé.", { status: 401 });

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const direction = url.searchParams.get("direction");

  if (direction && !(direction in DIRECTIONS)) {
    return new Response("Filtre « direction » invalide (achat ou vente).", { status: 400 });
  }
  let year: number | null = null;
  if (yearParam) {
    const y = Number(yearParam);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return new Response("Filtre « year » invalide.", { status: 400 });
    }
    year = y;
  }

  const where: Record<string, unknown> = {};
  if (direction) where.direction = direction;
  if (year !== null) {
    where.invoiceDate = { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "asc" },
      include: { vatLines: { select: { rate: true } } },
    });

    const buffer = await buildInvoicesWorkbook(invoices);
    const name = `factures${year !== null ? `-${year}` : ""}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (err) {
    console.error("Export Excel échoué :", err);
    return new Response("Impossible de générer l'export pour le moment.", { status: 500 });
  }
}
