import { prisma } from "@/lib/db";
import { buildInvoicesWorkbook } from "@/lib/export/excel";

export const dynamic = "force-dynamic";

// GET /api/export/factures  -> télécharge un fichier Excel des factures.
// Filtres optionnels : ?year=2026&direction=achat
export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = url.searchParams.get("year");
  const direction = url.searchParams.get("direction");

  const where: Record<string, unknown> = {};
  if (direction) where.direction = direction;
  if (year) {
    const y = Number(year);
    where.invoiceDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "asc" },
      include: { vatLines: true },
    });

    const buffer = await buildInvoicesWorkbook(invoices);
    const name = `factures${year ? `-${year}` : ""}.xlsx`;

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
