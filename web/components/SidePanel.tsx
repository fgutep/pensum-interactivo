"use client";

import type { Course, AvailabilityStatus, OfferingBadge } from "@/lib/types";
import { renderRequirement } from "@/lib/requirementText";

const TYPE_LABEL: Record<Course["type"], string> = {
  nucleo: "Núcleo",
  electiva: "Electiva",
  cbu: "Ciclo Básico Uniandino",
  complementaria: "Curso de libre elección",
  proyecto: "Proyecto",
};

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  approved: "Aprobada",
  available: "Disponible ahora",
  "one-away": "A un curso de distancia",
  blocked: "Bloqueada",
};

interface Props {
  course: Course | null;
  allCourses: Course[];
  mode: "explore" | "progress";
  status: AvailabilityStatus | null;
  missing: string[];
  dependentsCount: number;
  approved: Set<string>;
  offering: OfferingBadge | undefined;
  term: string;
  mihorarioUrl: string;
  onToggleApproved: (id: string) => void;
  onClose: () => void;
}

function seatsText(seats: [number, number] | undefined): string {
  if (!seats) return "";
  const [min, max] = seats;
  if (max <= 0) return " · sin cupos libres";
  const lo = Math.max(0, min);
  return lo === max ? ` · ${max} cupos libres` : ` · ${lo}–${max} cupos libres`;
}

function OfferingSection({
  offering,
  term,
  code,
  mihorarioUrl,
}: {
  offering: OfferingBadge | undefined;
  term: string;
  code: string;
  mihorarioUrl: string;
}) {
  const link = mihorarioUrl
    ? `${mihorarioUrl}${mihorarioUrl.includes("?") ? "&" : "?"}nameInput=${encodeURIComponent(code)}`
    : null;

  let dotClass = "off";
  let line = "No se ofrece este periodo";
  if (offering?.syncFailed) {
    dotClass = "stale";
    line = "Sin datos de oferta (revisar sincronización)";
  } else if (offering?.offered) {
    dotClass = "on";
    line = "Se dicta este periodo";
  }

  return (
    <section className="offering-block">
      <div className="offering-line">
        <span className={`offering-dot ${dotClass}`} />
        {line} <span style={{ color: "#9ca3af", fontWeight: 400 }}>· {term}</span>
      </div>

      {offering?.offered && (
        <>
          <div className="offering-detail">
            {offering.sectionCount} sección(es)
            {seatsText(offering.seatsAvailable)}
          </div>
          {(offering.attrs.length > 0 || offering.ptrm.length > 0) && (
            <div className="chip-row">
              {offering.ptrm.map((p) => (
                <span className="chip ptrm" key={`p-${p}`}>
                  {p === "16" ? "16 sem" : p}
                </span>
              ))}
              {offering.attrs.map((a) => (
                <span className="chip" key={`a-${a}`}>
                  {a}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {link && (
        <a className="mihorario-link" href={link} target="_blank" rel="noopener noreferrer">
          Ver secciones y armar horario en Mi Horario →
        </a>
      )}
    </section>
  );
}

export default function SidePanel({
  course,
  allCourses,
  mode,
  status,
  missing,
  dependentsCount,
  approved,
  offering,
  term,
  mihorarioUrl,
  onToggleApproved,
  onClose,
}: Props) {
  if (!course) {
    return (
      <aside className="side-panel side-panel-empty">
        <p>Selecciona un curso en el mapa para ver sus detalles.</p>
      </aside>
    );
  }

  const byNormalized = new Map(allCourses.map((c) => [c.codeNormalized, c]));
  const missingLabels = missing.map((code) => {
    const c = byNormalized.get(code);
    return c ? `${c.code} — ${c.name}` : `${code} (fuera de este pensum)`;
  });

  return (
    <aside className="side-panel">
      <button className="side-panel-close" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
      <div className="side-panel-code">{course.code}</div>
      <h2>{course.name}</h2>
      <div className="side-panel-meta">
        <span>{course.credits} créditos</span>
        <span>Semestre sugerido: {course.semester}</span>
        <span>{TYPE_LABEL[course.type]}</span>
      </div>

      {mode === "progress" && status && (
        <div className={`status-banner status-banner-${status}`}>
          {STATUS_LABEL[status]}
        </div>
      )}

      <section>
        <h3>Prerrequisitos</h3>
        <p className="requirement-text">
          {renderRequirement(course.prereqTree, allCourses)}
        </p>
        {course.prereqExternal.length > 0 && (
          <p className="requirement-note">
            También exige requisitos fuera de este pensum (idiomas, exámenes de
            clasificación, etc.) no representados en el grafo.
          </p>
        )}
      </section>

      {mode === "progress" && status !== "approved" && missingLabels.length > 0 && (
        <section>
          <h3>Te falta</h3>
          <ul className="missing-list">
            {missingLabels.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Impacto</h3>
        <p>
          {dependentsCount === 0
            ? "Ningún otro curso del pensum lo requiere directa o indirectamente."
            : `${dependentsCount} curso(s) del pensum dependen de este, directa o indirectamente.`}
        </p>
      </section>

      {!course.isPlaceholder && (
        <OfferingSection
          offering={offering}
          term={term}
          code={course.codeNormalized}
          mihorarioUrl={mihorarioUrl}
        />
      )}

      {mode === "progress" && !course.isPlaceholder && (
        <button
          className={`approve-toggle ${approved.has(course.id) ? "is-approved" : ""}`}
          onClick={() => onToggleApproved(course.id)}
        >
          {approved.has(course.id) ? "Desmarcar como vista" : "Marcar como vista"}
        </button>
      )}
    </aside>
  );
}
