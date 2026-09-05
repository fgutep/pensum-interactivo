// Admin-authored progression rules per catalog. The seed writes these into the
// `Catalog.rules` JSON column; the student panel reads them from the payload and
// enforces them client-side (see lib/availability.ts `evaluateGates`).
//
// A future /administrador screen will edit the same column — this file is just
// the current authoring surface. Edit + `npm run seed` to apply.
//
//   attestations: self-checked, non-course requirements. `autoGatePrereqRegex`
//     locks any course whose prereq tree mentions a matching code until checked.
//   gates: "you can't take course X until <condition>". Every sub-condition
//     present in `condition` must hold (AND). `appliesTo` selects the locked
//     courses by code regex, suggested semester, or explicit Course.id.

import type { CatalogRules } from "./types";

const LANGUAGE_ATTESTATION = {
  id: "idioma",
  label: "Requisito de inglés cumplido",
  description:
    "Suficiencia por examen de clasificación (LENG / ENGL / RLEC) o exención registrada en el Registro Académico.",
  autoGatePrereqRegex: "^(LENG|ENGL|RLEC|IDIO)",
};

/** Common baseline for the CBU3 plans. */
function cbu3Rules(programPrefixes: string[]): CatalogRules {
  const p = `(${programPrefixes.join("|")})`;
  return {
    attestations: [LANGUAGE_ATTESTATION],
    gates: [
      {
        id: "fundamentos-nivel-2",
        label:
          "Haber aprobado todos los cursos de nivel 2 del programa (código " +
          programPrefixes.join(" / ") +
          " 2xxx) antes de inscribir cursos de nivel 3.",
        appliesTo: { codeRegex: `^${p}3\\d{3}$` },
        condition: { allApprovedMatching: `^${p}2\\d{3}$` },
      },
    ],
  };
}

export const CATALOG_RULES: Record<string, CatalogRules> = {
  "iele-cbu3": cbu3Rules(["IELE"]),
  "iele-cbu3-pc": cbu3Rules(["IELE"]),
  "ielc-cbu3": cbu3Rules(["IELE", "IELC"]),
  "ielc-cbu3-pc": cbu3Rules(["IELE", "IELC"]),
  "doble-cbu3": cbu3Rules(["IELE", "IELC"]),
};

export function rulesForSlug(slug: string): CatalogRules {
  return CATALOG_RULES[slug] ?? { gates: [], attestations: [] };
}
