"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Attestation, CatalogRules, GateRule } from "@/lib/types";

function reOk(src: string | undefined): boolean {
  if (!src) return true;
  try {
    new RegExp(src);
    return true;
  } catch {
    return false;
  }
}

const csv = (a?: (string | number)[]) => (a ?? []).join(", ");
const parseCsvNums = (s: string) =>
  s.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
const parseCsvStr = (s: string) =>
  s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

export default function RulesEditor({
  slug,
  rules,
}: {
  slug: string;
  rules: CatalogRules;
}) {
  const router = useRouter();
  const [att, setAtt] = useState<Attestation[]>(
    JSON.parse(JSON.stringify(rules.attestations ?? []))
  );
  const [gates, setGates] = useState<GateRule[]>(
    JSON.parse(JSON.stringify(rules.gates ?? []))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const regexErrors =
    att.some((a) => !reOk(a.autoGatePrereqRegex)) ||
    gates.some(
      (g) => !reOk(g.appliesTo?.codeRegex) || !reOk(g.condition?.allApprovedMatching)
    );

  function updAtt(i: number, patch: Partial<Attestation>) {
    setAtt(att.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }
  function updGate(i: number, patch: Partial<GateRule>) {
    setGates(gates.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/catalogs/${slug}/rules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attestations: att, gates }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: d.error ?? "No se pudo guardar." });
        return;
      }
      setMsg({ ok: true, text: "Reglas guardadas." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      <h2>Reglas de progresión</h2>
      <p className="admin-note">
        Atestaciones (requisitos que el estudiante marca) y gates (“no puedes ver X
        hasta cumplir Y”). Se guardan en <code>Catalog.rules</code> de este plan.
      </p>

      <h3 style={{ fontSize: 13, marginTop: 18 }}>Atestaciones</h3>
      {att.map((a, i) => (
        <div key={i} className="course-sem-group">
          <div className="admin-form-grid" style={{ padding: 12 }}>
            <div>
              <label>ID</label>
              <input
                className="admin-input"
                value={a.id}
                onChange={(e) => updAtt(i, { id: e.target.value })}
              />
            </div>
            <div>
              <label>Etiqueta</label>
              <input
                className="admin-input"
                value={a.label}
                onChange={(e) => updAtt(i, { label: e.target.value })}
              />
            </div>
            <div>
              <label>Descripción</label>
              <input
                className="admin-input"
                value={a.description ?? ""}
                onChange={(e) => updAtt(i, { description: e.target.value })}
              />
            </div>
            <div>
              <label>autoGatePrereqRegex</label>
              <input
                className={`admin-input${!reOk(a.autoGatePrereqRegex) ? " dirty" : ""}`}
                value={a.autoGatePrereqRegex ?? ""}
                onChange={(e) => updAtt(i, { autoGatePrereqRegex: e.target.value })}
              />
              {!reOk(a.autoGatePrereqRegex) && (
                <span className="admin-error">regex inválida</span>
              )}
            </div>
          </div>
          <div className="er-actions" style={{ padding: "8px 12px" }}>
            <button
              className="admin-btn danger"
              onClick={() => setAtt(att.filter((_, j) => j !== i))}
            >
              Quitar atestación
            </button>
          </div>
        </div>
      ))}
      <button
        className="admin-btn"
        onClick={() => setAtt([...att, { id: "", label: "" }])}
      >
        + Atestación
      </button>

      <h3 style={{ fontSize: 13, marginTop: 22 }}>Gates</h3>
      {gates.map((g, i) => (
        <div key={i} className="course-sem-group">
          <div className="admin-form-grid" style={{ padding: 12 }}>
            <div>
              <label>ID</label>
              <input
                className="admin-input"
                value={g.id}
                onChange={(e) => updGate(i, { id: e.target.value })}
              />
            </div>
            <div>
              <label>Etiqueta</label>
              <input
                className="admin-input"
                value={g.label}
                onChange={(e) => updGate(i, { label: e.target.value })}
              />
            </div>
            <div>
              <label>appliesTo · codeRegex</label>
              <input
                className={`admin-input${!reOk(g.appliesTo?.codeRegex) ? " dirty" : ""}`}
                value={g.appliesTo?.codeRegex ?? ""}
                onChange={(e) =>
                  updGate(i, { appliesTo: { ...g.appliesTo, codeRegex: e.target.value } })
                }
              />
            </div>
            <div>
              <label>appliesTo · semesters (coma)</label>
              <input
                className="admin-input"
                value={csv(g.appliesTo?.semesters)}
                onChange={(e) =>
                  updGate(i, {
                    appliesTo: { ...g.appliesTo, semesters: parseCsvNums(e.target.value) },
                  })
                }
              />
            </div>
            <div>
              <label>appliesTo · ids (coma)</label>
              <input
                className="admin-input"
                value={csv(g.appliesTo?.ids)}
                onChange={(e) =>
                  updGate(i, {
                    appliesTo: { ...g.appliesTo, ids: parseCsvStr(e.target.value) },
                  })
                }
              />
            </div>
            <div>
              <label>condition · allApprovedMatching</label>
              <input
                className={`admin-input${!reOk(g.condition?.allApprovedMatching) ? " dirty" : ""}`}
                value={g.condition?.allApprovedMatching ?? ""}
                onChange={(e) =>
                  updGate(i, {
                    condition: { ...g.condition, allApprovedMatching: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label>condition · maxApprovedSemester</label>
              <input
                className="admin-input"
                value={g.condition?.maxApprovedSemester ?? ""}
                onChange={(e) =>
                  updGate(i, {
                    condition: {
                      ...g.condition,
                      maxApprovedSemester: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    },
                  })
                }
              />
            </div>
            <div>
              <label>condition · minCredits</label>
              <input
                className="admin-input"
                value={g.condition?.minCredits ?? ""}
                onChange={(e) =>
                  updGate(i, {
                    condition: {
                      ...g.condition,
                      minCredits: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
              />
            </div>
            <div>
              <label>condition · attestationId</label>
              <select
                className="admin-select"
                value={g.condition?.attestationId ?? ""}
                onChange={(e) =>
                  updGate(i, {
                    condition: {
                      ...g.condition,
                      attestationId: e.target.value || undefined,
                    },
                  })
                }
              >
                <option value="">— ninguna —</option>
                {att.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="er-actions" style={{ padding: "8px 12px" }}>
            <button
              className="admin-btn danger"
              onClick={() => setGates(gates.filter((_, j) => j !== i))}
            >
              Quitar gate
            </button>
          </div>
        </div>
      ))}
      <button
        className="admin-btn"
        onClick={() =>
          setGates([...gates, { id: "", label: "", appliesTo: {}, condition: {} }])
        }
      >
        + Gate
      </button>

      <div className="admin-section-actions">
        <button
          className="admin-btn primary"
          disabled={busy || regexErrors}
          onClick={save}
        >
          {busy ? "Guardando…" : "Guardar reglas"}
        </button>
        {regexErrors && (
          <span className="admin-error">Corrige las regex inválidas.</span>
        )}
        {msg && (
          <span className={msg.ok ? "admin-saved" : "admin-error"}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
