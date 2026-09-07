import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type {
  CatalogDiff,
  EntityDiff,
  FieldChange,
  PlanesDiff,
} from "@/lib/import/diffPlanes";
import ImportActions from "@/components/admin/ImportActions";

export const dynamic = "force-dynamic";

function val(v: unknown): string {
  if (v == null || v === "") return "∅";
  if (Array.isArray(v)) return v.join(", ") || "∅";
  return String(v);
}

function Change({ c, conflict }: { c: FieldChange; conflict?: boolean }) {
  return (
    <div className={`diff-row${conflict ? " diff-conflict" : ""}`}>
      <span className="diff-field">{c.field}:</span>{" "}
      <span className="diff-before">{val(c.before)}</span> →{" "}
      <span className="diff-after">{val(c.after)}</span>
      {conflict && <span className="tag">🔒 bloqueado</span>}
    </div>
  );
}

function CatalogSection({ cd }: { cd: CatalogDiff }) {
  const added = cd.courses.filter((c) => c.kind === "added");
  const modified = cd.courses.filter((c) => c.kind === "modified");
  const removed = cd.courses.filter((c) => c.kind === "removed");
  if (
    !cd.isNew &&
    !cd.metaChanges.length &&
    !added.length &&
    !modified.length &&
    !removed.length
  ) {
    return (
      <div className="diff-cat">
        <header>
          {cd.programName} <span className="admin-note">— sin cambios ({cd.unchangedCount} cursos)</span>
        </header>
      </div>
    );
  }
  return (
    <div className="diff-cat">
      <header>
        {cd.programName}
        {cd.isNew && <span className="admin-badge draft">NUEVO</span>}
        <span className="admin-note">{cd.unchangedCount} sin cambios</span>
      </header>

      {cd.metaChanges.length > 0 && (
        <div className="diff-group">
          <h4>Identidad del plan</h4>
          {cd.metaChanges.map((c) => (
            <Change key={c.field} c={c} />
          ))}
        </div>
      )}

      {added.length > 0 && (
        <div className="diff-group">
          <h4>Cursos nuevos ({added.length})</h4>
          {added.map((c) => (
            <div key={c.key} className="diff-row added">
              + <code>{c.code}</code> {c.name}
            </div>
          ))}
        </div>
      )}

      {modified.length > 0 && (
        <div className="diff-group">
          <h4>Cursos modificados ({modified.length})</h4>
          {modified.map((c) => (
            <div key={c.key} className="diff-row">
              <code>{c.code}</code> {c.name}
              {c.manuallyEdited && <span className="diff-field">· editado a mano</span>}
              {c.changes.map((ch) => (
                <Change
                  key={ch.field}
                  c={ch}
                  conflict={c.conflictFields.includes(ch.field)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {removed.length > 0 && (
        <div className="diff-group">
          <h4>Cursos eliminados ({removed.length})</h4>
          {removed.map((c) => (
            <div
              key={c.key}
              className={`diff-row removed${c.manuallyEdited ? " diff-conflict" : ""}`}
            >
              − <code>{c.code}</code> {c.name}
              {c.manuallyEdited && <span className="tag">🔒 editado a mano</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EntitySection({ title, rows }: { title: string; rows: EntityDiff[] }) {
  if (!rows.length) return null;
  return (
    <div className="diff-cat">
      <header>{title}</header>
      <div className="diff-group">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`diff-row${r.kind === "added" ? " added" : r.kind === "removed" ? " removed" : ""}`}
          >
            {r.kind === "added" ? "+ " : r.kind === "removed" ? "− " : ""}
            <code>{r.id}</code> {r.label}
            {r.changes.map((ch) => (
              <Change key={ch.field} c={ch} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ImportJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await prisma.importJob.findUnique({ where: { id: Number(jobId) } });
  if (!job) notFound();
  const diff = job.diff as unknown as PlanesDiff | null;

  return (
    <>
      <p className="admin-sub">
        <Link href="/administrador/importar">← Importaciones</Link>
      </p>
      <h1>{job.filename}</h1>
      <p className="admin-sub">
        {new Date(job.uploadedAt).toLocaleString("es-CO")} · estado: {job.status}
      </p>

      {!diff ? (
        <p className="admin-note">Sin diff (el archivo no se pudo procesar).</p>
      ) : (
        <>
          {diff.warnings.length > 0 && (
            <div className="diff-warnings">
              {diff.warnings.length} advertencia(s):
              <ul>
                {diff.warnings.slice(0, 40).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="diff-counts">
            <span className="add">
              <b>{diff.counts.added}</b> nuevos
            </span>
            <span className="mod">
              <b>{diff.counts.modified}</b> modificados
            </span>
            <span className="del">
              <b>{diff.counts.removed}</b> eliminados
            </span>
            <span className="conf">
              <b>{diff.counts.conflicts}</b> conflictos
            </span>
          </div>

          {diff.catalogs.map((cd) => (
            <CatalogSection key={cd.slug} cd={cd} />
          ))}
          <EntitySection title="Nodos de requisito" rows={diff.requirementNodes} />
          <EntitySection title="Requisitos de grado" rows={diff.gradRules} />

          <ImportActions
            jobId={job.id}
            status={job.status}
            removals={diff.counts.removed}
            conflicts={diff.counts.conflicts}
          />
        </>
      )}
    </>
  );
}
