import type { Course, AvailabilityStatus } from "../lib/types";
import { renderRequirement } from "../lib/requirementText";

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
  onToggleApproved: (id: string) => void;
  onClose: () => void;
}

export default function SidePanel({
  course,
  allCourses,
  mode,
  status,
  missing,
  dependentsCount,
  approved,
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
