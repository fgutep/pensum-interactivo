// First-load bootstrap for RequirementNode rows (non-course graduation
// requirements drawn as 0-credit nodes). The DB rows are the runtime source of
// truth and are fully editable from /administrador; this map is only applied on
// `create` by the seed, never on `update`.

import { ENGLISH_ATTESTATION_ID, ENGLISH_REQ_CODE_RE, ENGLISH_REQ_ID } from "./types";

export interface RequirementNodeSeed {
  key: string;
  label: string;
  description?: string;
  infoUrl?: string;
  credits: number;
  semester: number;
  sortIndex: number;
  attestationId?: string;
  linkedCourseCodes: string[];
  autoLinkRegex?: string;
}

const ENGLISH_READING: RequirementNodeSeed = {
  key: ENGLISH_REQ_ID,
  label: "Requisito de lectura en inglés",
  description:
    "Para grado debes acreditar competencia de lectura en inglés: suficiencia " +
    "por examen de clasificación (LENG / ENGL / RLEC) o exención registrada en " +
    "el Registro Académico.",
  infoUrl:
    "https://cienciassociales.uniandes.edu.co/lenguas-cultura/servicios/requisitos-lenguas-grado/requisitos-de-lectura-en-ingles/",
  credits: 0,
  semester: 5,
  sortIndex: 9999,
  attestationId: ENGLISH_ATTESTATION_ID,
  linkedCourseCodes: [],
  autoLinkRegex: ENGLISH_REQ_CODE_RE.source,
};

/** Bootstrap requirement nodes for a catalog slug. All CBU3 plans get the
 * English-reading requirement. */
export function requirementNodesForSlug(slug: string): RequirementNodeSeed[] {
  if (slug.endsWith("-cbu3") || slug.endsWith("-cbu3-pc")) return [ENGLISH_READING];
  return [ENGLISH_READING];
}
