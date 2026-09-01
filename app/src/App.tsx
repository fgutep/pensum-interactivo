import { useEffect, useMemo, useState } from "react";
import raw from "./data/pensum.generated.json";
import type { AvailabilityStatus, CourseType, PensumData } from "./lib/types";
import {
  catalogCodesOf,
  courseAvailability,
  creditsSummary,
  criticalPathLength,
  downstreamOf,
} from "./lib/availability";
import {
  approvedToShareUrl,
  loadApprovedFromHash,
  loadApprovedFromStorage,
  saveApprovedToStorage,
} from "./lib/persistence";
import CurriculumGraph from "./components/CurriculumGraph";
import SidePanel from "./components/SidePanel";
import SummaryBar from "./components/SummaryBar";
import SearchBar from "./components/SearchBar";
import "./App.css";

const data = raw as PensumData;

export default function App() {
  const [mode, setMode] = useState<"explore" | "progress">("explore");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approved, setApproved] = useState<Set<string>>(() => {
    return loadApprovedFromHash() ?? loadApprovedFromStorage();
  });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CourseType | "all">("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    saveApprovedToStorage(approved);
  }, [approved]);

  const courses = data.courses;
  const catalogCodes = useMemo(() => catalogCodesOf(courses), [courses]);
  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedId) ?? null,
    [courses, selectedId]
  );

  const statusById = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>();
    if (mode !== "progress") return map;
    for (const c of courses) {
      map.set(c.id, courseAvailability(c, approved, catalogCodes).status);
    }
    return map;
  }, [courses, approved, mode, catalogCodes]);

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
    return courseAvailability(selectedCourse, approved, catalogCodes);
  }, [selectedCourse, approved, catalogCodes]);

  const dependentsCount = useMemo(() => {
    if (!selectedCourse) return 0;
    return downstreamOf(courses, selectedCourse.id).size;
  }, [courses, selectedCourse]);

  const { done: creditsDone, total: creditsTotal } = useMemo(
    () => creditsSummary(courses, approved),
    [courses, approved]
  );

  const criticalPath = useMemo(
    () => criticalPathLength(courses, approved),
    [courses, approved]
  );

  function handleSelect(id: string) {
    setSelectedId(id === "" ? null : id === selectedId ? null : id);
  }

  function handleToggleApproved(id: string) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleShare() {
    const url = approvedToShareUrl(approved);
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback("¡Enlace copiado!");
    } catch {
      setShareFeedback("No se pudo copiar");
    }
    setTimeout(() => setShareFeedback(null), 2000);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Pensum interactivo — {data.program.name}</h1>
          <span className="catalog-label">{data.program.catalogLabel}</span>
        </div>
      </header>

      <SummaryBar
        mode={mode}
        onModeChange={setMode}
        creditsDone={creditsDone}
        creditsTotal={creditsTotal}
        criticalPath={criticalPath}
        onShare={handleShare}
        shareFeedback={shareFeedback}
      />

      <SearchBar
        query={query}
        onQueryChange={setQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onlyAvailable={onlyAvailable}
        onOnlyAvailableChange={setOnlyAvailable}
        mode={mode}
      />

      <main className="app-main">
        <CurriculumGraph
          courses={courses}
          mode={mode}
          selectedId={selectedId}
          matchedIds={matchedIds}
          statusById={statusById}
          onSelect={handleSelect}
        />
        <SidePanel
          course={selectedCourse}
          allCourses={courses}
          mode={mode}
          status={selectedAvailability?.status ?? null}
          missing={selectedAvailability?.missing ?? []}
          dependentsCount={dependentsCount}
          approved={approved}
          onToggleApproved={handleToggleApproved}
          onClose={() => setSelectedId(null)}
        />
      </main>
    </div>
  );
}
