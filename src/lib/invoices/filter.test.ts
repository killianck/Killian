import { describe, expect, it } from "vitest";
import { buildInvoiceWhere, invoiceOrderBy, type InvoiceFilterParams } from "./filter";

const empty: InvoiceFilterParams = {
  q: "", year: "", month: "", direction: "", type: "", category: "", rate: "", sort: "date_desc",
};

describe("buildInvoiceWhere", () => {
  it("renvoie un objet vide sans filtre", () => {
    expect(buildInvoiceWhere(empty, [2026])).toEqual({});
  });

  it("filtre par sens", () => {
    const w = buildInvoiceWhere({ ...empty, direction: "achat" }, [2026]) as { AND: unknown[] };
    expect(w.AND).toContainEqual({ direction: "achat" });
  });

  it("recherche texte sur plusieurs champs", () => {
    const w = buildInvoiceWhere({ ...empty, q: "  orange " }, [2026]) as { AND: Record<string, unknown>[] };
    expect(w.AND[0]).toEqual({
      OR: [
        { partyName: { contains: "orange" } },
        { number: { contains: "orange" } },
        { notes: { contains: "orange" } },
      ],
    });
  });

  it("année + mois -> plage d'un mois", () => {
    const w = buildInvoiceWhere({ ...empty, year: "2026", month: "3" }, [2026]) as { AND: { invoiceDate: { gte: Date; lt: Date } }[] };
    const cond = w.AND[0].invoiceDate;
    expect(cond.gte).toEqual(new Date(Date.UTC(2026, 2, 1)));
    expect(cond.lt).toEqual(new Date(Date.UTC(2026, 3, 1)));
  });

  it("mois seul -> ce mois sur toutes les années disponibles", () => {
    const w = buildInvoiceWhere({ ...empty, month: "2" }, [2026, 2025]) as { AND: { OR: unknown[] }[] };
    expect(w.AND[0].OR).toHaveLength(2);
  });

  it("année seule -> plage d'un an", () => {
    const w = buildInvoiceWhere({ ...empty, year: "2026" }, [2026]) as { AND: { invoiceDate: { gte: Date; lt: Date } }[] };
    expect(w.AND[0].invoiceDate.gte).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(w.AND[0].invoiceDate.lt).toEqual(new Date(Date.UTC(2027, 0, 1)));
  });

  it("combine plusieurs filtres", () => {
    const w = buildInvoiceWhere(
      { ...empty, direction: "vente", type: "avoir", rate: "20" },
      [2026],
    ) as { AND: unknown[] };
    expect(w.AND).toHaveLength(3);
  });
});

describe("invoiceOrderBy", () => {
  it("tris disponibles", () => {
    expect(invoiceOrderBy("date_desc")).toEqual({ invoiceDate: "desc" });
    expect(invoiceOrderBy("date_asc")).toEqual({ invoiceDate: "asc" });
    expect(invoiceOrderBy("ttc_desc")).toEqual({ totalTTC: "desc" });
    expect(invoiceOrderBy("ttc_asc")).toEqual({ totalTTC: "asc" });
    expect(invoiceOrderBy("inconnu")).toEqual({ invoiceDate: "desc" });
  });
});
