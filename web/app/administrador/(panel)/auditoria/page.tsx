import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [rows, count] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <>
      <h1>Auditoría</h1>
      <p className="admin-sub">
        {count} eventos · página {page} de {pages}
      </p>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Actor</th>
            <th>Acción</th>
            <th>Entidad</th>
            <th>Cambio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="admin-pair">
                {new Date(r.createdAt).toLocaleString("es-CO")}
              </td>
              <td>{r.actor}</td>
              <td>
                <code>{r.action}</code>
              </td>
              <td className="admin-pair">
                {r.entityType} #{r.entityId}
              </td>
              <td>
                {r.before == null && r.after == null ? (
                  <span className="admin-note">—</span>
                ) : (
                  <details>
                    <summary className="admin-note">ver</summary>
                    <pre
                      style={{
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        margin: "6px 0 0",
                        maxWidth: 520,
                      }}
                    >
                      {JSON.stringify(
                        { before: r.before, after: r.after },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="admin-section-actions">
        {page > 1 && (
          <Link className="admin-btn" href={`/administrador/auditoria?page=${page - 1}`}>
            ← Anterior
          </Link>
        )}
        {page < pages && (
          <Link className="admin-btn" href={`/administrador/auditoria?page=${page + 1}`}>
            Siguiente →
          </Link>
        )}
      </div>
    </>
  );
}
