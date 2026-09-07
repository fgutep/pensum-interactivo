import { prisma } from "@/lib/db";
import DescriptionSync from "@/components/admin/DescriptionSync";

export const dynamic = "force-dynamic";

export default async function DescripcionesPage() {
  const courses = await prisma.course.findMany({
    select: { normalizedCode: true, description: true, descriptionSyncedAt: true },
    orderBy: { normalizedCode: "asc" },
  });
  const withDesc = courses.filter((c) => c.description).length;
  const missing = courses.filter((c) => !c.description).map((c) => c.normalizedCode);

  return (
    <>
      <h1>Descripciones</h1>
      <p className="admin-sub">
        Texto de catálogo por curso (fuente: smartcatalogiq). El seed nunca las
        toca; una edición manual o esta sincronización sobreviven a un re-seed.
      </p>

      <DescriptionSync
        total={courses.length}
        withDescription={withDesc}
        missing={missing}
      />

      <h2 style={{ fontSize: 15, margin: "24px 0 10px" }}>
        Sin descripción ({missing.length})
      </h2>
      {missing.length === 0 ? (
        <p className="admin-note">Todas las materias tienen descripción.</p>
      ) : (
        <p className="admin-note" style={{ lineHeight: 1.8 }}>
          {missing.map((c) => (
            <code key={c} style={{ marginRight: 8 }}>
              {c}
            </code>
          ))}
        </p>
      )}
    </>
  );
}
