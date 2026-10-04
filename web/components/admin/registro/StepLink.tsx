"use client";

import { useMemo, useState } from "react";
import type { CourseLinkPlan, LinkChange } from "@/lib/registro/analyze";
import type { StepProps } from "./RegistroWizard";

export const FIELD_LABEL: Record<LinkChange["field"], string> = {
  prereqText: "Prerrequisitos",
  coreqText: "Correquisitos",
  name: "Nombre",
  credits: "Créditos",
  binding: "Código del curso",
};

const show = (v: string | number | null) => (v === null || v === "" ? "— (ninguno)" : String(v));

export function SelectedSlugs({
  view, slugs, setSlugs,
}: { view: StepProps["view"]; slugs: string[]; setSlugs: (s: string[]) => void }) {
  const all = Object.keys(view.plan.perCatalog);
  return (
    <fieldset className="wiz-fieldset">
      <legend className="admin-note">Catálogos a actualizar</legend>
      {all.map((s) => {
        const sum = view.plan.perCatalog[s];
        return (
          <label key={s} className="wiz-check">
            <input
              type="checkbox"
              checked={slugs.includes(s)}
              onChange={() => setSlugs(slugs.includes(s) ? slugs.filter((x) => x !== s) : [...slugs, s])}
            />
            <code>{s}</code>
            <span className="admin-pair">
              {sum.changed} cambian · {sum.unchanged} sin cambio
              {sum.skipped > 0 && ` · ${sum.skipped} protegidos`}
              {sum.noRegistro > 0 && ` · ${sum.noRegistro} sin registro`}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export default function StepLink({ view, go, sel }: StepProps) {
  const { slugs, setSlugs, force, setForce } = sel;

  const byCat = useMemo(() => {
    const m = new Map<string, CourseLinkPlan[]>();
    for (const c of view.plan.courses) {
      if (!slugs.includes(c.slug)) continue;
      (m.get(c.slug) ?? m.set(c.slug, []).get(c.slug)!).push(c);
    }
    return m;
  }, [view.plan.courses, slugs]);

  const totals = useMemo(() => {
    let changed = 0, skipped = 0;
    for (const list of byCat.values()) {
      for (const c of list) {
        if (c.changes.length) changed++;
        if (c.skipped) skipped++;
      }
    }
    return { changed, skipped };
  }, [byCat]);

  return (
    <>
      <div className="admin-card">
        <h2>Qué cambiaría en los planes</h2>
        <p className="admin-note">
          Solo se comparan cursos con código real. Las casillas comodín nunca se tocan. Las filas editadas a mano o con
          campos fijados (🔒) se saltan y se listan abajo.
        </p>
        <SelectedSlugs view={view} slugs={slugs} setSlugs={setSlugs} />
        <label className="wiz-check">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Forzar: sobrescribir también filas editadas a mano y campos fijados
        </label>
        {force && (
          <p className="admin-error" role="status">
            Con “forzar” se pisan ediciones manuales. El resultado se puede deshacer en el último paso.
          </p>
        )}
      </div>

      {[...byCat.entries()].map(([slug, list]) => {
        const withChanges = list.filter((c) => c.changes.length);
        const skipped = list.filter((c) => c.skipped);
        const nothing = list.filter((c) => c.noRegistro);
        return (
          <details key={slug} className="review-cat" open={withChanges.length > 0 || skipped.length > 0}>
            <summary>
              <code>{slug}</code>
              <span className="admin-pair">
                {withChanges.length} con cambios · {skipped.length} protegidos · {nothing.length} sin registro
              </span>
            </summary>
            <div className="review-body">
              {withChanges.length === 0 && skipped.length === 0 && (
                <p className="admin-note">Sin diferencias: este plan ya coincide con el registro.</p>
              )}
              {withChanges.map((c) => (
                <div key={c.catalogCourseId} className="review-course">
                  <div className="review-course-body">
                    <strong>{c.displayCode}</strong>
                    {c.targetCode !== c.code && <span className="admin-pair"> → se vincula a {c.targetCode}</span>}
                    {c.changes.map((ch) => (
                      <div key={ch.field} className="diff-row">
                        <span className="diff-field">{FIELD_LABEL[ch.field]}</span>{" "}
                        <span className="diff-before">{show(ch.before)}</span> → <span className="diff-after">{show(ch.after)}</span>
                        {ch.override && <span className="er-tag manual" title="Se fijará para que una importación futura no lo deshaga"> decisión tuya 🔒</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {skipped.length > 0 && (
                <>
                  <h4 className="admin-pair" style={{ margin: "10px 0 4px" }}>Protegidos (no se tocan)</h4>
                  {skipped.map((c) => (
                    <div key={c.catalogCourseId} className="diff-row diff-conflict">
                      <strong>{c.displayCode}</strong>
                      <span className="tag">
                        {c.skipped!.reason === "manuallyEdited" ? "editado a mano" : "campo fijado"}: {c.skipped!.fields.map((f) => FIELD_LABEL[f]).join(", ")}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </details>
        );
      })}

      <div className="import-actions">
        <button type="button" className="admin-btn primary" onClick={() => go("aplicar")} disabled={slugs.length === 0}>
          Continuar → Aplicar ({totals.changed} cambio{totals.changed === 1 ? "" : "s"})
        </button>
        <button type="button" className="admin-btn" onClick={() => go("resolver")}>
          ← Resolver
        </button>
      </div>
    </>
  );
}
