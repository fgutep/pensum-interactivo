"use client";

// "Tu canasta" checkout. The planner panel is the working surface; this is the
// moment of commitment: every course in the basket with its real sections
// (teachers, days, rooms, seats) from the live Uniandes API, a weekly preview
// that flags clashes, and the practical exits — copy the NRCs (that's what
// registration asks for), open Mi Horario, share the plan.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Course } from "@/lib/types";
import {
  DAY_LONG,
  DAY_SHORT,
  fmtMinutes,
  sectionsConflict,
  summarizeMeetings,
  titleCaseName,
  type CourseSections,
  type SectionInfo,
  type SectionsResponse,
} from "@/lib/sections";
import { termLabel } from "@/lib/term";
import { groupColor, groupOf, toSentenceCase } from "./format";
import { TypeGlyph } from "./CourseCard";
import { ArrowRightIcon, BasketIcon, CheckIcon, ChevronDownIcon, CloseIcon, CopyIcon, ShareIcon } from "./icons";
import styles from "./explorer.module.css";

interface Props {
  slug: string;
  courses: Course[];
  planned: Map<string, string>; // courseId -> term
  approved: Set<string>;
  planTermCode: string;
  /** course to open expanded (e.g. the one selected when the modal was opened) */
  focusCourseId: string | null;
  unlockedNextTerm: Course[];
  mihorarioUrl: string;
  onClose: () => void;
  onRemove: (id: string) => void;
  onShare: () => void;
}

type Choice = Record<string, string>; // courseId -> nrc

const HOUR_PX = 42;

function choiceKey(slug: string, term: string) {
  return `pensum:${slug}:sections:${term}`;
}

/** Best default per course: has seats, doesn't clash with what's already chosen. */
function suggest(list: { course: Course; cs: CourseSections | undefined }[], keep: Choice): Choice {
  const out: Choice = {};
  const chosen: SectionInfo[] = [];
  const kept = new Map<string, SectionInfo>();
  for (const { course, cs } of list) {
    const s = cs?.sections.find((x) => x.nrc === keep[course.id]);
    if (s) kept.set(course.id, s);
  }
  for (const { course, cs } of list) {
    const k = kept.get(course.id);
    if (k) {
      out[course.id] = k.nrc;
      chosen.push(k);
    }
  }
  for (const { course, cs } of list) {
    if (out[course.id] || !cs || cs.sections.length === 0) continue;
    const open = cs.sections.filter((s) => s.seatsAvail > 0);
    const pool = open.length > 0 ? open : cs.sections;
    const pick = pool.find((s) => !chosen.some((c) => sectionsConflict(c, s))) ?? pool[0];
    out[course.id] = pick.nrc;
    chosen.push(pick);
  }
  return out;
}

export default function BasketModal({
  slug,
  courses,
  planned,
  approved,
  planTermCode,
  focusCourseId,
  unlockedNextTerm,
  mihorarioUrl,
  onClose,
  onRemove,
  onShare,
}: Props) {
  const items = useMemo(() => courses.filter((c) => planned.has(c.id)), [courses, planned]);
  const credits = items.reduce((s, c) => s + c.credits, 0);
  const codesKey = items.map((c) => c.codeNormalized).sort().join(",");

  const [data, setData] = useState<SectionsResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [choice, setChoice] = useState<Choice>({});
  const [touched, setTouched] = useState<Set<string>>(new Set()); // user-picked (vs suggested)
  const [expanded, setExpanded] = useState<string | null>(focusCourseId);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // --- live sections ---
  useEffect(() => {
    if (!codesKey) {
      setLoadState("ready");
      return;
    }
    const ctrl = new AbortController();
    setLoadState("loading");
    fetch(`/api/sections?codes=${encodeURIComponent(codesKey)}&term=${encodeURIComponent(planTermCode)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<SectionsResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setData(d);
        setLoadState("ready");
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setLoadState("error");
      });
    return () => ctrl.abort();
  }, [codesKey, planTermCode]);

  // --- remembered picks + suggestions, once data is in ---
  useEffect(() => {
    if (!data) return;
    let stored: { choice?: Choice; touched?: string[] } = {};
    try {
      stored = JSON.parse(localStorage.getItem(choiceKey(slug, planTermCode)) ?? "{}");
    } catch {
      /* ignore */
    }
    const list = items.map((course) => ({ course, cs: data.courses[course.codeNormalized] }));
    const keep: Choice = { ...(stored.choice ?? {}) };
    setTouched(new Set(stored.touched ?? []));
    setChoice(suggest(list, keep));
  }, [data, items, slug, planTermCode]);

  useEffect(() => {
    if (!data || Object.keys(choice).length === 0) return;
    try {
      localStorage.setItem(choiceKey(slug, planTermCode), JSON.stringify({ choice, touched: [...touched] }));
    } catch {
      /* ignore */
    }
  }, [choice, touched, data, slug, planTermCode]);

  // --- dialog behaviour: Esc, focus trap, scroll lock ---
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  // --- derived: chosen sections, clashes ---
  const picked = useMemo(
    () =>
      items.map((course) => {
        const cs = data?.courses[course.codeNormalized];
        const section = cs?.sections.find((s) => s.nrc === choice[course.id]) ?? null;
        return { course, cs, section };
      }),
    [items, data, choice]
  );
  const clashIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        const a = picked[i].section;
        const b = picked[j].section;
        if (a && b && sectionsConflict(a, b)) {
          ids.add(picked[i].course.id);
          ids.add(picked[j].course.id);
        }
      }
    }
    return ids;
  }, [picked]);
  const referenceTerm = useMemo(() => {
    if (!data) return null;
    const ref = Object.values(data.courses).find((c) => c.isReference);
    return ref ? ref.term : null;
  }, [data]);
  const missingSections = picked.filter((p) => loadState === "ready" && !p.section).length;
  const allSet = loadState === "ready" && items.length > 0 && missingSections === 0 && clashIds.size === 0;

  const pick = (courseId: string, nrc: string) => {
    setChoice((c) => ({ ...c, [courseId]: nrc }));
    setTouched((t) => new Set(t).add(courseId));
  };

  const copyNrcs = async () => {
    const lines = picked.map(({ course, section }) =>
      section
        ? `${course.code} · Sec ${section.section} · NRC ${section.nrc}${section.instructors.length ? ` · ${section.instructors.map(titleCaseName).join(", ")}` : ""}`
        : `${course.code} · (sin sección elegida)`
    );
    const header = `Mi plan ${termLabel(planTermCode)} — ${credits} créditos${referenceTerm ? ` (secciones de ${termLabel(referenceTerm)} como referencia)` : ""}`;
    try {
      await navigator.clipboard.writeText([header, ...lines].join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — nothing to do */
    }
  };

  const planLabel = termLabel(planTermCode);

  return (
    <div className={styles.bkOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={styles.bkDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bk-title"
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        {/* ---------- header: the "you're nearly done" moment ---------- */}
        <header className={`${styles.bkHeader} ${allSet ? styles.bkHeaderDone : ""}`}>
          <span className={styles.bkSeal} aria-hidden>
            {allSet ? (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path className={styles.bkSealCheck} d="M5 12.5 10 17.5 19 7" />
              </svg>
            ) : (
              <BasketIcon size={22} />
            )}
          </span>
          <div className={styles.bkHeadText}>
            <h2 id="bk-title" className={styles.bkTitle}>
              {allSet ? `Tu canasta para ${planLabel} está lista` : `Tu canasta · ${planLabel}`}
            </h2>
            <p className={styles.bkSub}>
              {items.length} curso{items.length === 1 ? "" : "s"} · {credits} créditos
              {loadState === "ready" && clashIds.size > 0 && ` · ${clashIds.size} con cruce de horario`}
              {loadState === "ready" && clashIds.size === 0 && missingSections > 0 && ` · ${missingSections} sin sección publicada`}
              {allSet && (referenceTerm ? " · sin cruces en los horarios de referencia" : " · sin cruces")}
            </p>
          </div>
          <button ref={closeRef} type="button" className={styles.bkClose} onClick={onClose} aria-label="Cerrar">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className={styles.bkBody}>
          {/* ---------- left: the courses ---------- */}
          <div className={styles.bkList}>
            {referenceTerm && (
              <div className={styles.bkNotice} role="note">
                <strong>Horarios de {termLabel(referenceTerm)} como referencia.</strong> La oferta de {planLabel} se
                publica más cerca del semestre; las secciones, profesores y cupos pueden cambiar.
              </div>
            )}
            {loadState === "error" && (
              <div className={styles.bkNotice} role="alert">
                No pudimos traer los horarios en este momento. Tu canasta sigue guardada; intenta de nuevo en un momento o
                consulta Mi Horario.
              </div>
            )}

            {items.length === 0 && (
              <div className={styles.bkEmpty}>
                <BasketIcon size={30} />
                <strong>Tu canasta está vacía</strong>
                <span>Agrega cursos desde el mapa o desde “Disponibles para agregar”.</span>
              </div>
            )}

            {picked.map(({ course, cs, section }) => {
              const open = expanded === course.id;
              const clash = clashIds.has(course.id);
              const group = groupOf(course);
              return (
                <article key={course.id} className={`${styles.bkCourse} ${open ? styles.bkCourseOpen : ""} ${clash ? styles.bkCourseClash : ""}`}>
                  <div className={styles.bkCourseHead}>
                    <button
                      type="button"
                      className={styles.bkCourseToggle}
                      aria-expanded={open}
                      aria-controls={`bk-${course.id}`}
                      onClick={() => setExpanded(open ? null : course.id)}
                    >
                      <span className={styles.bkGlyph} style={{ background: groupColor(group) }}>
                        <TypeGlyph group={group} />
                      </span>
                      <span className={styles.bkCourseMain}>
                        <span className={styles.bkCourseTitle}>{toSentenceCase(course.name)}</span>
                        <span className={styles.bkCourseMeta}>
                          <span className={styles.bkCode}>{course.code}</span>
                          <span>{course.credits} cr</span>
                          {section && (
                            <span className={styles.bkPicked}>
                              Sec {section.section} · {section.instructors.length > 0 ? titleCaseName(section.instructors[0]) : "Profesor por definir"}
                              {section.instructors.length > 1 ? ` +${section.instructors.length - 1}` : ""}
                            </span>
                          )}
                          {loadState === "loading" && <span className={styles.bkSkeleton} aria-hidden />}
                          {loadState === "ready" && !section && <span className={styles.bkMuted}>Sin secciones publicadas</span>}
                        </span>
                      </span>
                      {clash && <span className={styles.bkBadgeWarn}>Cruce</span>}
                      <span className={`${styles.bkChevron} ${open ? styles.bkChevronOpen : ""}`} aria-hidden>
                        <ChevronDownIcon size={14} />
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.bkRemove}
                      onClick={() => onRemove(course.id)}
                      aria-label={`Quitar ${course.code} de la canasta`}
                      title="Quitar de la canasta"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>

                  {open && (
                    <div className={styles.bkCourseBody} id={`bk-${course.id}`}>
                      {course.description ? (
                        <Description text={course.description} />
                      ) : (
                        <p className={`${styles.bkDesc} ${styles.bkMuted}`}>Aún no tenemos la descripción de este curso.</p>
                      )}

                      <PrereqLine course={course} courses={courses} approved={approved} planned={planned} />

                      <h3 className={styles.bkH3}>
                        Secciones{cs ? ` · ${termLabel(cs.term)}` : ""}
                        {cs?.isReference && <span className={styles.bkRefTag}>referencia</span>}
                      </h3>
                      {loadState === "loading" && <div className={styles.bkSkeletonRow} aria-hidden />}
                      {loadState === "ready" && (!cs || cs.sections.length === 0) && (
                        <p className={styles.bkMuted}>
                          No hay secciones publicadas para este curso todavía. Revisa Mi Horario más cerca del semestre.
                        </p>
                      )}
                      <div className={styles.bkSections} role="radiogroup" aria-label={`Secciones de ${course.code}`}>
                        {cs?.sections.map((s) => (
                          <SectionRow
                            key={s.nrc}
                            s={s}
                            selected={choice[course.id] === s.nrc}
                            suggested={choice[course.id] === s.nrc && !touched.has(course.id)}
                            onPick={() => pick(course.id, s.nrc)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* ---------- right: the week + the exits ---------- */}
          <aside className={styles.bkSide}>
            <h3 className={styles.bkH3}>Tu semana</h3>
            <WeekGrid picked={picked} clashIds={clashIds} loading={loadState === "loading"} />

            {unlockedNextTerm.length > 0 && (
              <div className={styles.unlockInsight}>
                <span>
                  Con esta canasta se desbloquean <strong>{unlockedNextTerm.length} curso(s)</strong> para más adelante:{" "}
                  {unlockedNextTerm.map((c) => c.code).join(", ")}.
                </span>
              </div>
            )}

            <div className={styles.bkActions}>
              {mihorarioUrl && (
                <a href={mihorarioUrl} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
                  Armar horario en Mi Horario <ArrowRightIcon size={14} />
                </a>
              )}
              <button type="button" className={styles.btnGhostFooter} onClick={copyNrcs} disabled={picked.every((p) => !p.section)}>
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                {copied ? "NRC copiados" : "Copiar mis NRC"}
              </button>
              <div className={styles.bkActionsRow}>
                <button type="button" className={styles.btnGhostFooter} onClick={onShare}>
                  <ShareIcon size={14} /> Compartir plan
                </button>
                <button type="button" className={styles.btnGhostFooter} onClick={onClose}>
                  Seguir editando
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Description({ text }: { text: string }) {
  const [more, setMore] = useState(false);
  const long = text.length > 260;
  return (
    <div>
      <p className={`${styles.bkDesc} ${long && !more ? styles.bkDescClamp : ""}`}>{text}</p>
      {long && (
        <button type="button" className={styles.bkLink} onClick={() => setMore((m) => !m)}>
          {more ? "Leer menos" : "Leer más"}
        </button>
      )}
    </div>
  );
}

function SeatsPill({ s }: { s: SectionInfo }) {
  if (s.seatsAvail <= 0) return <span className={`${styles.bkSeats} ${styles.bkSeatsFull}`}>Sin cupos</span>;
  if (s.seatsAvail <= 5) return <span className={`${styles.bkSeats} ${styles.bkSeatsLow}`}>{s.seatsAvail} cupo{s.seatsAvail === 1 ? "" : "s"}</span>;
  return <span className={`${styles.bkSeats} ${styles.bkSeatsOk}`}>{s.seatsAvail} cupos</span>;
}

function SectionRow({ s, selected, suggested, onPick }: { s: SectionInfo; selected: boolean; suggested: boolean; onPick: () => void }) {
  const groups = summarizeMeetings(s.meetings);
  return (
    <button type="button" role="radio" aria-checked={selected} className={`${styles.bkSection} ${selected ? styles.bkSectionOn : ""}`} onClick={onPick}>
      <span className={styles.bkRadio} aria-hidden>{selected && <CheckIcon size={10} />}</span>
      <span className={styles.bkSectionMain}>
        <span className={styles.bkSectionTop}>
          <strong>Sección {s.section}</strong>
          <span className={styles.bkNrc}>NRC {s.nrc}</span>
          {suggested && <span className={styles.bkSuggested}>sugerida</span>}
        </span>
        <span className={styles.bkTeacher}>
          {s.instructors.length > 0 ? s.instructors.map(titleCaseName).join(" · ") : "Profesor por definir"}
        </span>
        {groups.map((g, i) => (
          <span key={i} className={styles.bkMeeting}>
            <span className={styles.bkDays}>{g.days.map((d) => DAY_SHORT[d]).join(" · ")}</span>
            <span className={styles.bkTime}>{fmtMinutes(g.start)}–{fmtMinutes(g.end)}</span>
            {g.room && <span className={styles.bkRoom}>{g.room}</span>}
          </span>
        ))}
        {groups.length === 0 && <span className={styles.bkMuted}>Horario por definir</span>}
      </span>
      <SeatsPill s={s} />
    </button>
  );
}

function PrereqLine({ course, courses, approved, planned }: { course: Course; courses: Course[]; approved: Set<string>; planned: Map<string, string> }) {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const pre = course.prereqCourseIds.map((id) => byId.get(id)).filter((c): c is Course => !!c);
  if (pre.length === 0 && !course.coreqText) return null;
  return (
    <div className={styles.bkReqs}>
      {pre.length > 0 && (
        <div className={styles.bkReqRow}>
          <span className={styles.bkReqLabel}>Requisitos</span>
          <span className={styles.bkReqChips}>
            {pre.map((p) => {
              const done = approved.has(p.id);
              const inBasket = planned.has(p.id);
              return (
                <span key={p.id} className={`${styles.bkReqChip} ${done ? styles.bkReqDone : ""}`} title={toSentenceCase(p.name)}>
                  {done && <CheckIcon size={10} />}
                  {p.code}
                  {!done && inBasket && <em> · en tu canasta</em>}
                </span>
              );
            })}
          </span>
        </div>
      )}
      {course.coreqText && (
        <div className={styles.bkReqRow}>
          <span className={styles.bkReqLabel}>Correquisito</span>
          <span className={styles.bkReqChips}>
            <span className={styles.bkReqChip}>{course.coreqText}</span>
            <span className={styles.bkMuted}>se inscribe al tiempo</span>
          </span>
        </div>
      )}
    </div>
  );
}

function WeekGrid({
  picked,
  clashIds,
  loading,
}: {
  picked: { course: Course; section: SectionInfo | null }[];
  clashIds: Set<string>;
  loading: boolean;
}) {
  const blocks = picked.flatMap(({ course, section }) =>
    section ? section.meetings.map((m) => ({ course, m })) : []
  );
  if (blocks.length === 0) {
    return (
      <div className={styles.bkWeekEmpty}>
        {loading ? "Armando tu semana…" : "Elige una sección para ver tu semana."}
      </div>
    );
  }
  const minH = Math.max(6, Math.floor(Math.min(...blocks.map((b) => b.m.start)) / 60) - 0);
  const maxH = Math.min(22, Math.ceil(Math.max(...blocks.map((b) => b.m.end)) / 60));
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
  const hasSun = blocks.some((b) => b.m.day === 6);
  const days = hasSun ? 7 : 6;

  return (
    <div className={styles.bkWeek} role="img" aria-label="Vista semanal de tus secciones elegidas">
      <div className={styles.bkWeekHead} style={{ gridTemplateColumns: `28px repeat(${days}, 1fr)` }}>
        <span />
        {DAY_SHORT.slice(0, days).map((d, i) => (
          <span key={d} title={DAY_LONG[i]}>{d}</span>
        ))}
      </div>
      <div className={styles.bkWeekBody} style={{ height: hours.length * HOUR_PX, gridTemplateColumns: `28px repeat(${days}, 1fr)` }}>
        <div className={styles.bkHours}>
          {hours.map((h) => (
            <span key={h} style={{ top: (h - minH) * HOUR_PX }}>{h}</span>
          ))}
        </div>
        {Array.from({ length: days }, (_, d) => (
          <div key={d} className={styles.bkDayCol}>
            {hours.map((h) => (
              <i key={h} style={{ top: (h - minH) * HOUR_PX }} />
            ))}
            {blocks
              .filter((b) => b.m.day === d)
              .map((b, i) => (
                <div
                  key={i}
                  className={`${styles.bkBlock} ${clashIds.has(b.course.id) ? styles.bkBlockClash : ""}`}
                  style={{
                    top: ((b.m.start - minH * 60) / 60) * HOUR_PX,
                    height: Math.max(16, ((b.m.end - b.m.start) / 60) * HOUR_PX - 2),
                    background: groupColor(groupOf(b.course)),
                  }}
                  title={`${b.course.code} · ${fmtMinutes(b.m.start)}–${fmtMinutes(b.m.end)}${b.m.room ? ` · ${b.m.room}` : ""}`}
                >
                  <span>{b.course.code.split(/\s+/)[0]}</span>
                  <span>{b.course.code.split(/\s+/).slice(1).join("")}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
