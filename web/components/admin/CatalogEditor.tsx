"use client";

import { useEffect, useState } from "react";
import type { EditorData } from "./editorTypes";
import CatalogIdentityForm from "./CatalogIdentityForm";
import CourseTable from "./CourseTable";
import RequirementNodeTable from "./RequirementNodeTable";
import RulesEditor from "./RulesEditor";

const SECTIONS = [
  { id: "identidad", label: "Identidad" },
  { id: "cursos", label: "Cursos" },
  { id: "nodos", label: "Nodos de requisito" },
  { id: "reglas", label: "Reglas" },
  { id: "preview", label: "Vista previa" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function CatalogEditor({ data }: { data: EditorData }) {
  const [section, setSection] = useState<SectionId>("identidad");

  // honour a #hash deep-link (e.g. from /administrador/requisitos) after mount
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (SECTIONS.some((s) => s.id === h)) setSection(h as SectionId);
  }, []);

  const attestationIds = data.rules.attestations.map((a) => a.id);

  return (
    <>
      <nav className="admin-editor-nav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={section === s.id ? "active" : ""}
            onClick={() => {
              setSection(s.id);
              history.replaceState(null, "", `#${s.id}`);
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === "identidad" && (
        <CatalogIdentityForm slug={data.slug} identity={data.identity} />
      )}
      {section === "cursos" && (
        <CourseTable slug={data.slug} courses={data.courses} />
      )}
      {section === "nodos" && (
        <RequirementNodeTable
          slug={data.slug}
          nodes={data.requirementNodes}
          attestationIds={attestationIds}
        />
      )}
      {section === "reglas" && <RulesEditor slug={data.slug} rules={data.rules} />}
      {section === "preview" && (
        <div className="admin-section">
          <h2>Vista previa</h2>
          <p className="admin-note">
            Los cambios guardados aquí se ven al recargar la vista de estudiante.
          </p>
          <p style={{ marginTop: 12 }}>
            <a
              className="admin-btn primary"
              href={`/p/${data.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir /p/{data.slug} ↗
            </a>
          </p>
        </div>
      )}
    </>
  );
}
