import Link from "next/link";
import { prisma } from "@/lib/db";
import type { CatalogRules } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RequisitosPage() {
  const catalogs = await prisma.catalog.findMany({
    orderBy: { slug: "asc" },
    include: { _count: { select: { requirementNodes: true } } },
  });

  return (
    <>
      <h1>Requisitos de grado</h1>
      <p className="admin-sub">
        Las atestaciones y gates viven en <code>Catalog.rules</code> de cada plan;
        edítalos en el catálogo correspondiente. El importador aplica la hoja{" "}
        <code>_REQUISITOS_GRADO</code> a todos los planes afectados a la vez.
      </p>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Atestaciones</th>
            <th>Gates</th>
            <th>Nodos de requisito</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {catalogs.map((c) => {
            const rules = (c.rules as CatalogRules | null) ?? {
              gates: [],
              attestations: [],
            };
            return (
              <tr key={c.id}>
                <td>
                  <strong>{c.programName}</strong>
                  {c.variantLabel ? ` · ${c.variantLabel}` : ""}
                  <div className="admin-pair">
                    <code>{c.slug}</code>
                  </div>
                </td>
                <td>
                  {rules.attestations.length}
                  <div className="admin-pair">
                    {rules.attestations.map((a) => a.id).join(", ") || "—"}
                  </div>
                </td>
                <td>
                  {rules.gates.length}
                  <div className="admin-pair">
                    {rules.gates.map((g) => g.id).join(", ") || "—"}
                  </div>
                </td>
                <td>{c._count.requirementNodes}</td>
                <td>
                  <Link
                    className="admin-btn"
                    href={`/administrador/catalogos/${c.slug}#reglas`}
                  >
                    Editar reglas
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
