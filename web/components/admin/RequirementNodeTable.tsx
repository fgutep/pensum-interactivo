"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditorRequirementNode } from "./editorTypes";

interface Props {
  slug: string;
  nodes: EditorRequirementNode[];
  attestationIds: string[];
}

const BLANK = {
  key: "",
  label: "",
  description: "",
  infoUrl: "",
  semester: "5",
  sortIndex: "9999",
  attestationId: "",
  autoLinkRegex: "",
  linkedCourseCodes: "",
};

export default function RequirementNodeTable({ slug, nodes, attestationIds }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/catalogs/${slug}/requirement-nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          semester: Number(draft.semester),
          sortIndex: Number(draft.sortIndex),
        }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(d.error ?? "No se pudo crear.");
        return;
      }
      setDraft(BLANK);
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      <h2>Nodos de requisito</h2>
      <p className="admin-note">
        Nodos de 0 créditos que aparecen en el mapa (p. ej. lectura en inglés). Se
        enlazan a materias por “Cursos que lo exigen” o por “Auto-enlace (regex)”.
      </p>

      {nodes.length === 0 && <p className="admin-note">Ninguno todavía.</p>}
      {nodes.map((n) => (
        <NodeRow key={n.id} slug={slug} node={n} attestationIds={attestationIds} />
      ))}

      {adding ? (
        <div className="course-sem-group">
          <header>
            <span>Nuevo nodo</span>
          </header>
          <div className="admin-form-grid" style={{ padding: 12 }}>
            {(
              [
                ["key", "Key (slug estable)"],
                ["label", "Etiqueta"],
                ["semester", "Semestre"],
                ["sortIndex", "Orden en la columna"],
                ["autoLinkRegex", "Auto-enlace (regex)"],
                ["linkedCourseCodes", "Cursos que lo exigen (coma)"],
                ["infoUrl", "URL info"],
                ["description", "Descripción"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label>{label}</label>
                <input
                  className="admin-input"
                  value={(draft as Record<string, string>)[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label>Atestación asociada</label>
              <select
                className="admin-select"
                value={draft.attestationId}
                onChange={(e) => setDraft({ ...draft, attestationId: e.target.value })}
              >
                <option value="">— ninguna —</option>
                {attestationIds.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="er-actions" style={{ padding: "8px 12px" }}>
            <button className="admin-btn primary" disabled={busy} onClick={create}>
              {busy ? "…" : "Crear"}
            </button>
            <button className="admin-btn" onClick={() => setAdding(false)}>
              Cancelar
            </button>
            {err && <span className="admin-error">{err}</span>}
          </div>
        </div>
      ) : (
        <button className="admin-btn" onClick={() => setAdding(true)}>
          + Nuevo nodo de requisito
        </button>
      )}
    </div>
  );
}

function NodeRow({
  slug,
  node,
  attestationIds,
}: {
  slug: string;
  node: EditorRequirementNode;
  attestationIds: string[];
}) {
  const router = useRouter();
  const [f, setF] = useState({
    label: node.label,
    description: node.description,
    infoUrl: node.infoUrl,
    semester: String(node.semester),
    sortIndex: String(node.sortIndex),
    attestationId: node.attestationId,
    autoLinkRegex: node.autoLinkRegex,
    linkedCourseCodes: node.linkedCourseCodes,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const orig = {
    label: node.label,
    description: node.description,
    infoUrl: node.infoUrl,
    semester: String(node.semester),
    sortIndex: String(node.sortIndex),
    attestationId: node.attestationId,
    autoLinkRegex: node.autoLinkRegex,
    linkedCourseCodes: node.linkedCourseCodes,
  };
  const dirty = (Object.keys(orig) as (keyof typeof orig)[]).some(
    (k) => f[k] !== orig[k]
  );

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/catalogs/${slug}/requirement-nodes/${node.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...f,
            semester: Number(f.semester),
            sortIndex: Number(f.sortIndex),
          }),
        }
      );
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: d.error ?? "No se pudo guardar." });
        return;
      }
      setMsg({ ok: true, text: "Guardado." });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar el nodo "${node.key}"?`)) return;
    setBusy("del");
    const res = await fetch(
      `/api/admin/catalogs/${slug}/requirement-nodes/${node.id}`,
      { method: "DELETE" }
    );
    if (res.ok) router.refresh();
    setBusy(null);
  }

  return (
    <div className={`course-sem-group${dirty ? " is-dirty" : ""}`}>
      <header>
        <span>
          <code>{node.key}</code>
        </span>
      </header>
      <div className="admin-form-grid" style={{ padding: 12 }}>
        {(
          [
            ["label", "Etiqueta"],
            ["semester", "Semestre"],
            ["sortIndex", "Orden en la columna"],
            ["autoLinkRegex", "Auto-enlace (regex)"],
            ["linkedCourseCodes", "Cursos que lo exigen (coma)"],
            ["infoUrl", "URL info"],
            ["description", "Descripción"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <label>{label}</label>
            <input
              className={`admin-input${f[k] !== orig[k] ? " dirty" : ""}`}
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <label>Atestación asociada</label>
          <select
            className="admin-select"
            value={f.attestationId}
            onChange={(e) => setF({ ...f, attestationId: e.target.value })}
          >
            <option value="">— ninguna —</option>
            {attestationIds.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="er-actions" style={{ padding: "8px 12px" }}>
        <button
          className="admin-btn primary"
          disabled={!dirty || busy != null}
          onClick={save}
        >
          {busy === "save" ? "…" : "Guardar"}
        </button>
        {dirty && (
          <button className="admin-btn" onClick={() => setF(orig)}>
            Deshacer
          </button>
        )}
        <button className="admin-btn danger" disabled={busy != null} onClick={remove}>
          Eliminar
        </button>
        {msg && (
          <span className={msg.ok ? "admin-saved" : "admin-error"}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
