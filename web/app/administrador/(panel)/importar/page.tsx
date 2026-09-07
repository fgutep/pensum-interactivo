import Link from "next/link";
import { prisma } from "@/lib/db";
import ImportUploader from "@/components/admin/ImportUploader";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const jobs = await prisma.importJob.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 15,
  });

  return (
    <>
      <h1>Importar</h1>
      <p className="admin-sub">
        Sube la plantilla <code>PLANES.xlsx</code> para actualizar planes, cursos,
        nodos de requisito y requisitos de grado.
      </p>

      <ImportUploader />

      <h2 style={{ fontSize: 15, margin: "24px 0 10px" }}>Importaciones recientes</h2>
      {jobs.length === 0 ? (
        <p className="admin-note">Ninguna todavía.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.filename}</td>
                <td>{new Date(j.uploadedAt).toLocaleString("es-CO")}</td>
                <td>
                  <span
                    className={`admin-badge ${
                      j.status === "applied"
                        ? "published"
                        : j.status === "discarded"
                          ? "archived"
                          : "draft"
                    }`}
                  >
                    {j.status}
                  </span>
                </td>
                <td>
                  <Link className="admin-btn" href={`/administrador/importar/${j.id}`}>
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
