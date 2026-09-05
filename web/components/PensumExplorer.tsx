"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  AvailabilityStatus,
  CatalogPayload,
  CourseType,
  ElectiveAssignment,
} from "@/lib/types";
import {
  catalogCodesOf,
  courseAvailability,
  creditsSummary,
  criticalPathLength,
  downstreamOf,
} from "@/lib/availability";
import {
  buildShareUrl,
  loadApprovedFromHash,
  loadApprovedFromStorage,
  loadAttestationsFromHash,
  loadAttestationsFromStorage,
  loadElectivesFromHash,
  loadElectivesFromStorage,
  resetProgress,
  saveApprovedToStorage,
  saveAttestationsToStorage,
  saveElectivesToStorage,
  type ElectiveAssignments,
} from "@/lib/persistence";
import CurriculumGraph from "./CurriculumGraph";
import SidePanel from "./SidePanel";
import SummaryBar from "./SummaryBar";
import SearchBar from "./SearchBar";
import PlanSwitcher from "./PlanSwitcher";

interface Props {
  data: CatalogPayload;
  mihorarioUrl: string;
}

const REGISTRO_URL = "https://registrasistemas.uniandes.edu.co/";

export default function PensumExplorer({ data, mihorarioUrl }: Props) {
  const slug = data.catalog.slug;
  const rules = data.rules;

  const [mode, setMode] = useState<"explore" | "progress">("explore");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<ElectiveAssignments>({});
  const [attestationsMet, setAttestationsMet] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CourseType | "all">("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // hydrate progress from URL hash / localStorage after mount (no SSR access)
  useEffect(() => {
    setApproved(loadApprovedFromHash() ?? loadApprovedFromStorage(slug));
    setAssignments(loadElectivesFromHash() ?? loadElectivesFromStorage(slug));
    setAttestationsMet(
      loadAttestationsFromHash() ?? loadAttestationsFromStorage(slug)
    );
    setHydrated(true);
  }, [slug]);

  useEffect(() => {
    if (hydrated) saveApprovedToStorage(slug, approved);
  }, [approved, hydrated, slug]);

  useEffect(() => {
    if (hydrated) saveElectivesToStorage(slug, assignments);
  }, [assignments, hydrated, slug]);

  useEffect(() => {
    if (hydrated) saveAttestationsToStorage(slug, attestationsMet);
  }, [attestationsMet, hydrated, slug]);

  // apply elective assignments: an assigned slot shows the real course's
  // name + credits (its display code / kicker stays the pensum slot's).
  const courses = useMemo(
    () =>
      data.courses.map((c) => {
        const a = assignments[c.id];
        if (!a) return c;
        return { ...c, name: a.title, credits: a.credits ?? c.credits };
      }),
    [data.courses, assignments]
  );

  const catalogCodes = useMemo(() => catalogCodesOf(courses), [courses]);
  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedId) ?? null,
    [courses, selectedId]
  );

  const { done: creditsDone, total: creditsTotal } = useMemo(
    () => creditsSummary(courses, approved),
    [courses, approved]
  );

  const ruleCtx = useMemo(
    () => ({ rules, attestationsMet, approvedCredits: creditsDone }),
    [rules, attestationsMet, creditsDone]
  );

  // status + "locked by an admin rule" flag, per course (progress mode only)
  const { statusById, lockedIds } = useMemo(() => {
    const statusById = new Map<string, AvailabilityStatus>();
    const lockedIds = new Set<string>();
    if (mode !== "progress") return { statusById, lockedIds };
    for (const c of courses) {
      const a = courseAvailability(c, approved, catalogCodes, courses, ruleCtx);
      statusById.set(c.id, a.status);
      if (a.gateReasons.length > 0) lockedIds.add(c.id);
    }
    return { statusById, lockedIds };
  }, [courses, approved, mode, catalogCodes, ruleCtx]);

  const matchedIds = useMemo(() => {
    const hasQuery = query.trim().length > 0;
    const hasTypeFilter = typeFilter !== "all";
    const hasAvailFilter = mode === "progress" && onlyAvailable;
    if (!hasQuery && !hasTypeFilter && !hasAvailFilter) return null;

    const q = query.trim().toLowerCase();
    const set = new Set<string>();
    for (const c of courses) {
      if (hasQuery) {
        const hit =
          c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
        if (!hit) continue;
      }
      if (hasTypeFilter && c.type !== typeFilter) continue;
      if (hasAvailFilter) {
        const status = statusById.get(c.id);
        if (status !== "available") continue;
      }
      set.add(c.id);
    }
    return set;
  }, [courses, query, typeFilter, onlyAvailable, mode, statusById]);

  const selectedAvailability = useMemo(() => {
    if (!selectedCourse) return null;
    return courseAvailability(
      selectedCourse,
      approved,
      catalogCodes,
      courses,
      ruleCtx
    );
  }, [selectedCourse, approved, catalogCodes, courses, ruleCtx]);

  const dependentsCount = useMemo(() => {
    if (!selectedCourse) return 0;
    return downstreamOf(courses, selectedCourse.id).size;
  }, [courses, selectedCourse]);

  const criticalPath = useMemo(
    () => criticalPathLength(courses, approved),
    [courses, approved]
  );

  const handleSelect = useCallback((id: string) => {
    if (id === "") {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev === id ? null : id));
    setPanelOpen(true);
  }, []);

  function handleToggleApproved(id: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleAssignElective = useCallback(
    (slotId: string, assignment: ElectiveAssignment | null) => {
      setAssignments((prev) => {
        const next = { ...prev };
        if (assignment) next[slotId] = assignment;
        else delete next[slotId];
        return next;
      });
    },
    []
  );

  const handleToggleAttestation = useCallback((id: string) => {
    setAttestationsMet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function handleReset() {
    const ok = window.confirm(
      "¿Reiniciar todo tu avance en este plan? Se borran las materias marcadas, " +
        "las electivas asignadas y los requisitos marcados. No afecta otros planes."
    );
    if (!ok) return;
    setApproved(new Set());
    setAssignments({});
    setAttestationsMet(new Set());
    resetProgress(slug);
    setSelectedId(null);
    setPanelOpen(false);
  }

  async function handleShare() {
    const url = buildShareUrl(approved, assignments, attestationsMet);
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback("¡Enlace copiado!");
    } catch {
      setShareFeedback("No se pudo copiar");
    }
    setTimeout(() => setShareFeedback(null), 2000);
  }

  const planOptions = useMemo(
    () => [
      {
        slug,
        programName: data.catalog.programName,
        variantLabel: data.catalog.variantLabel,
      },
      ...data.siblings.map((s) => ({
        slug: s.slug,
        programName: s.programName,
        variantLabel: s.variantLabel,
      })),
    ],
    [slug, data.catalog.programName, data.catalog.variantLabel, data.siblings]
  );

  const accent = data.catalog.accentColor ?? "#1f6fc4";
  const filterActive = query.trim().length > 0 || typeFilter !== "all";
  const showPanel = !!selectedCourse && panelOpen;

  return (
    <div className="app-shell">
      <header className="app-header" style={{ ["--accent" as string]: accent }}>
        <div className="app-header-title">
          <Link className="back-link" href="/">
            ← Planes
          </Link>
          <h1>
            <span className="app-header-kicker">Pensum</span>
            {data.catalog.programName}
            {data.catalog.variantLabel ? (
              <span className="app-header-variant"> · {data.catalog.variantLabel}</span>
            ) : null}
          </h1>
        </div>
        <PlanSwitcher current={slug} options={planOptions} />
      </header>

      <div className="disclaimer">
        Herramienta informativa. El pensum y los requisitos oficiales son los que publica
        el{" "}
        <a href={REGISTRO_URL} target="_blank" rel="noopener noreferrer">
          Registro Académico
        </a>
        ; confirma siempre con tu consejero. Los datos de oferta provienen de la API de la
        Universidad y pueden cambiar.
      </div>

      <SummaryBar
        mode={mode}
        onModeChange={setMode}
        creditsDone={creditsDone}
        creditsTotal={creditsTotal}
        criticalPath={criticalPath}
        onShare={handleShare}
        shareFeedback={shareFeedback}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        filterActive={filterActive}
        attestations={rules.attestations}
        attestationsMet={attestationsMet}
        onToggleAttestation={handleToggleAttestation}
        onReset={handleReset}
      />

      {searchOpen && (
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onlyAvailable={onlyAvailable}
          onOnlyAvailableChange={setOnlyAvailable}
          mode={mode}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <main className="app-main">
        <CurriculumGraph
          courses={courses}
          mode={mode}
          selectedId={selectedId}
          matchedIds={matchedIds}
          statusById={statusById}
          lockedIds={lockedIds}
          panelOpen={showPanel}
          onSelect={handleSelect}
        />

        {selectedCourse && !panelOpen && (
          <button
            className="panel-reopen"
            onClick={() => setPanelOpen(true)}
            aria-label="Mostrar detalles"
            title="Mostrar detalles"
          >
            ‹
          </button>
        )}

        {showPanel && (
          <SidePanel
            course={selectedCourse}
            allCourses={courses}
            mode={mode}
            status={selectedAvailability?.status ?? null}
            missing={selectedAvailability?.missing ?? []}
            coreqBlockers={selectedAvailability?.coreqBlockers ?? []}
            gateReasons={selectedAvailability?.gateReasons ?? []}
            dependentsCount={dependentsCount}
            approved={approved}
            offering={
              selectedCourse ? data.offerings[selectedCourse.codeNormalized] : undefined
            }
            term={data.catalog.term}
            mihorarioUrl={mihorarioUrl}
            electives={data.electives}
            programCode={data.catalog.programCode}
            assignment={selectedCourse ? assignments[selectedCourse.id] : undefined}
            onAssignElective={handleAssignElective}
            onToggleApproved={handleToggleApproved}
            onCollapse={() => setPanelOpen(false)}
            onClose={() => {
              setSelectedId(null);
              setPanelOpen(false);
            }}
          />
        )}
      </main>
    </div>
  );
}
