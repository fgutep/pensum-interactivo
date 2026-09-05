"use client";

import type {
  Course,
  AvailabilityStatus,
  ElectiveAssignment,
  ElectiveDTO,
  OfferingBadge,
} from "@/lib/types";
import { renderRequirement } from "@/lib/requirementText";
import ElectivePicker from "./ElectivePicker";

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
  coreqBlockers: string[];
  gateReasons: string[];
  dependentsCount: number;
  approved: Set<string>;
  offering: OfferingBadge | undefined;
  term: string;
  mihorarioUrl: string;
  electives: ElectiveDTO[];
  programCode: string;
  assignment: ElectiveAssignment | undefined;
  onAssignElective: (slotId: string, a: ElectiveAssignment | null) => void;
  onToggleApproved: (id: string) => void;
  onCollapse: () => void;
  onClose: () => void;
}

const ELECTIVE_SLOT_KINDS = new Set(["ELECTIVA", "EFI", "CLE"]);

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
  coreqBlockers,
  gateReasons,
  dependentsCount,
  approved,
  offering,
  term,
  mihorarioUrl,
  electives,
  programCode,
  assignment,
  onAssignElective,
  onToggleApproved,
  onCollapse,
  onClose,
}: Props) {
  if (!course) {
    return (
      <aside className="side-panel side-panel-empty">
        <p>Selecciona un curso en el mapa para ver sus detalles.</p>
      </aside>
    );
  }

  const isElectiveSlot =
    course.isPlaceholder &&
    (course.type === "electiva" ||
      ELECTIVE_SLOT_KINDS.has(course.placeholderKind ?? ""));

  const byNormalized = new Map(allCourses.map((c) => [c.codeNormalized, c]));
  const label = (code: string) => {
    const c = byNormalized.get(code);
    return c ? `${c.code} — ${c.name}` : `${code} (fuera de este pensum)`;
  };
  const missingLabels = missing.map(label);
  const coreqBlockerLabels = coreqBlockers.map(label);

  return (
    <aside className="side-panel">
      <button
        className="side-panel-collapse"
        onClick={onCollapse}
        aria-label="Ocultar panel"
        title="Ocultar panel"
      >
        ›
      </button>
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
          {gateReasons.length > 0 ? "🔒 Bloqueada por una regla del plan" : STATUS_LABEL[status]}
        </div>
      )}

      {mode === "progress" && gateReasons.length > 0 && (
        <section className="gate-section">
          <h3>Reglas del plan por cumplir</h3>
          <ul className="gate-list">
            {gateReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="gate-note">
            Marca los requisitos cumplidos en <strong>Requisitos</strong> (barra
            superior) o aprueba los cursos indicados.
          </p>
        </section>
      )}

      <section className="req-section req-prereq">
        <h3>
          Prerrequisitos <span className="req-hint">deben estar aprobados antes</span>
        </h3>
        <p className="requirement-text">
          {course.prereqTree
            ? renderRequirement(course.prereqTree, allCourses)
            : "Sin prerrequisitos."}
        </p>
        {course.prereqExternal.length > 0 && (
          <p className="requirement-note">
            También exige requisitos fuera de este pensum (idiomas, exámenes de
            clasificación, etc.) no representados en el grafo.
          </p>
        )}
      </section>

      <section className="req-section req-coreq">
        <h3>
          Correquisitos <span className="req-hint">se ven al tiempo (o antes)</span>
        </h3>
        <p className="requirement-text">
          {course.coreqTree
            ? renderRequirement(course.coreqTree, allCourses)
            : "Sin correquisitos."}
        </p>
      </section>

      {mode === "progress" &&
        status !== "approved" &&
        (missingLabels.length > 0 || coreqBlockerLabels.length > 0) && (
          <section>
            <h3>Te falta</h3>
            {missingLabels.length > 0 && (
              <>
                <p className="missing-kind">Aprobar antes:</p>
                <ul className="missing-list">
                  {missingLabels.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )}
            {coreqBlockerLabels.length > 0 && (
              <>
                <p className="missing-kind">
                  Poder inscribir al tiempo (correquisito bloqueado):
                </p>
                <ul className="missing-list missing-list-coreq">
                  {coreqBlockerLabels.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )}
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

      {isElectiveSlot && (
        <ElectivePicker
          electives={electives}
          programCode={programCode}
          slotLabel={course.placeholderLabel || course.code}
          term={term}
          mihorarioUrl={mihorarioUrl}
          mode={mode}
          assignment={assignment}
          slotCredits={course.credits}
          onAssign={(a) => onAssignElective(course.id, a)}
        />
      )}

      {mode === "progress" && !course.isPlaceholder && (
        <button
          className={`approve-toggle ${approved.has(course.id) ? "is-approved" : ""}`}
          onClick={() => onToggleApproved(course.id)}
          disabled={gateReasons.length > 0 && !approved.has(course.id)}
          title={
            gateReasons.length > 0 && !approved.has(course.id)
              ? "No puedes marcarla mientras una regla del plan la bloquee"
              : undefined
          }
        >
          {approved.has(course.id) ? "Desmarcar como vista" : "Marcar como vista"}
        </button>
      )}
    </aside>
  );
}
