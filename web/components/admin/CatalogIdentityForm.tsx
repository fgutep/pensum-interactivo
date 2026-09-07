"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditorIdentity } from "./editorTypes";

const FIELDS: {
  key: keyof EditorIdentity;
  label: string;
  type?: "text" | "select" | "color";
  options?: string[];
}[] = [
  { key: "programName", label: "Programa" },
  { key: "programCode", label: "Código de programa" },
  { key: "variantLabel", label: "Variante" },
  { key: "term", label: "Término objetivo" },
  { key: "status", label: "Estado", type: "select", options: ["draft", "published", "archived"] },
  { key: "accentColor", label: "Color de acento", type: "color" },
  { key: "tagline", label: "Tagline" },
  { key: "subtitle", label: "Subtítulo" },
  { key: "imagePath", label: "Ruta de imagen" },
];

export default function CatalogIdentityForm({
  slug,
  identity,
}: {
  slug: string;
  identity: EditorIdentity;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EditorIdentity>(identity);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = (Object.keys(form) as (keyof EditorIdentity)[]).some(
    (k) => form[k] !== identity[k]
  );

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/catalogs/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "No se pudo guardar." });
        return;
      }
      setMsg({ ok: true, text: "Guardado." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      <h2>Identidad del plan</h2>
      <div className="admin-form-grid">
        {FIELDS.map((f) => {
          const val = form[f.key];
          const changed = val !== identity[f.key];
          return (
            <div key={f.key}>
              <label>{f.label}</label>
              {f.type === "select" ? (
                <select
                  className={`admin-select${changed ? " dirty" : ""}`}
                  value={val}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                >
                  {f.options!.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "color" ? (
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(val) ? val : "#1f6fc4"}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                  <input
                    className={`admin-input${changed ? " dirty" : ""}`}
                    value={val}
                    placeholder="#1f6fc4"
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </span>
              ) : (
                <input
                  className={`admin-input${changed ? " dirty" : ""}`}
                  value={val}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="admin-section-actions">
        <button
          className="admin-btn primary"
          disabled={!dirty || busy}
          onClick={save}
        >
          {busy ? "Guardando…" : "Guardar identidad"}
        </button>
        {dirty && (
          <button className="admin-btn" disabled={busy} onClick={() => setForm(identity)}>
            Deshacer
          </button>
        )}
        {msg && (
          <span className={msg.ok ? "admin-saved" : "admin-error"}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
