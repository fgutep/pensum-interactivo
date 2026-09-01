import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CatalogPickerPage() {
  const catalogs = await prisma.catalog.findMany({
    where: { status: "published" },
    orderBy: [{ programCode: "asc" }, { slug: "asc" }],
    include: { _count: { select: { courses: true } } },
  });

  const byProgram = new Map<string, typeof catalogs>();
  for (const c of catalogs) {
    if (!byProgram.has(c.programName)) byProgram.set(c.programName, []);
    byProgram.get(c.programName)!.push(c);
  }

  return (
    <div className="picker-page">
      <h1>Pensum Interactivo</h1>
      <p className="picker-sub">
        Elige el plan sugerido que quieres explorar. Cada plan muestra los cursos por
        semestre, sus prerrequisitos y qué se dicta este periodo.
      </p>

      {catalogs.length === 0 && (
        <div className="picker-empty">
          No hay catálogos publicados todavía. Corre <code>npm run seed</code> o súbelos
          desde <code>/administrador</code>.
        </div>
      )}

      {[...byProgram.entries()].map(([programName, list]) => (
        <div className="picker-group" key={programName}>
          <h2>{programName}</h2>
          <div className="picker-cards">
            {list.map((c) => (
              <Link className="picker-card" href={`/p/${c.slug}`} key={c.slug}>
                <div className="pc-name">{c.programName}</div>
                <div className="pc-variant">
                  {c.variantLabel ? c.variantLabel : "Plan estándar"}
                </div>
                <div className="pc-meta">
                  {c._count.courses} cursos · periodo {c.term}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
