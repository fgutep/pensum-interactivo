"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { Course, AvailabilityStatus } from "@/lib/types";
import { upstreamOf, downstreamOf } from "@/lib/availability";
import CourseNode from "./CourseNode";

const nodeTypes = { courseNode: CourseNode };

const COL_WIDTH = 260;
const ROW_HEIGHT = 130;

interface Props {
  courses: Course[];
  mode: "explore" | "progress";
  selectedId: string | null;
  matchedIds: Set<string> | null; // from search/filter; null = no filter active
  statusById: Map<string, AvailabilityStatus>;
  onSelect: (id: string) => void;
}

export default function CurriculumGraph({
  courses,
  mode,
  selectedId,
  matchedIds,
  statusById,
  onSelect,
}: Props) {
  const upstream = useMemo(
    () => (selectedId ? upstreamOf(courses, selectedId) : new Set<string>()),
    [courses, selectedId]
  );
  const downstream = useMemo(
    () => (selectedId ? downstreamOf(courses, selectedId) : new Set<string>()),
    [courses, selectedId]
  );

  const nodes: Node[] = useMemo(() => {
    const bySemester = new Map<number, Course[]>();
    for (const c of courses) {
      if (!bySemester.has(c.semester)) bySemester.set(c.semester, []);
      bySemester.get(c.semester)!.push(c);
    }
    const out: Node[] = [];
    for (const [semester, list] of bySemester) {
      list.forEach((course, row) => {
        const isDimmed =
          (selectedId !== null &&
            course.id !== selectedId &&
            !upstream.has(course.id) &&
            !downstream.has(course.id)) ||
          (matchedIds !== null && !matchedIds.has(course.id));
        out.push({
          id: course.id,
          type: "courseNode",
          position: { x: (semester - 1) * COL_WIDTH, y: row * ROW_HEIGHT },
          data: {
            course,
            mode,
            status: statusById.get(course.id) ?? null,
            isSelected: course.id === selectedId,
            isUpstream: upstream.has(course.id),
            isDownstream: downstream.has(course.id),
            isDimmed,
            onClick: onSelect,
          },
          draggable: false,
        });
      });
    }
    return out;
  }, [courses, selectedId, upstream, downstream, matchedIds, mode, statusById, onSelect]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const c of courses) {
      for (const prereqId of c.prereqCourseIds) {
        const isActive =
          selectedId !== null &&
          (c.id === selectedId || upstream.has(c.id)) &&
          (prereqId === selectedId || upstream.has(prereqId));
        out.push({
          id: `${prereqId}->${c.id}`,
          source: prereqId,
          target: c.id,
          type: "smoothstep",
          animated: false,
          style: {
            stroke: isActive ? "#2563eb" : "#c7ccd4",
            strokeWidth: isActive ? 2.5 : 1,
            opacity: selectedId && !isActive ? 0.25 : 1,
          },
        });
      }
      for (const coreqId of c.coreqCourseIds) {
        out.push({
          id: `coreq-${coreqId}--${c.id}`,
          source: coreqId,
          target: c.id,
          type: "straight",
          style: { stroke: "#a855f7", strokeDasharray: "4 3", strokeWidth: 1.5 },
        });
      }
    }
    return out;
  }, [courses, selectedId, upstream]);

  return (
    <div className="graph-wrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        onPaneClick={() => onSelect("")}
      >
        <Background gap={24} color="#e5e7eb" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
