"use client";

import { Handle, Position } from "reactflow";
import type { Course, AvailabilityStatus } from "@/lib/types";

export interface CourseNodeData {
  course: Course;
  mode: "explore" | "progress";
  status: AvailabilityStatus | null; // null when mode === "explore"
  isSelected: boolean;
  isUpstream: boolean;
  isDownstream: boolean;
  isDimmed: boolean;
  onClick: (id: string) => void;
}

const TYPE_LABEL: Record<Course["type"], string> = {
  nucleo: "Núcleo",
  electiva: "Electiva",
  cbu: "CBU",
  complementaria: "Libre elección",
  proyecto: "Proyecto",
};

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  approved: "Aprobada",
  available: "Disponible",
  "one-away": "A un curso",
  blocked: "Bloqueada",
};

export default function CourseNode({ data }: { data: CourseNodeData }) {
  const { course, mode, status, isSelected, isUpstream, isDownstream, isDimmed, onClick } =
    data;

  const classNames = [
    "course-node",
    `type-${course.type}`,
    course.isPlaceholder ? "is-placeholder" : "",
    status ? `status-${status}` : "",
    isSelected ? "is-selected" : "",
    isUpstream ? "is-upstream" : "",
    isDownstream ? "is-downstream" : "",
    isDimmed ? "is-dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} onClick={() => onClick(course.id)}>
      <Handle type="target" position={Position.Left} />
      <div className="course-node-top">
        <span className="course-code">{course.code}</span>
        <span className="course-credits">{course.credits} cr</span>
      </div>
      <div className="course-name">{course.name}</div>
      <div className="course-node-bottom">
        <span className="course-type-tag">{TYPE_LABEL[course.type]}</span>
        {mode === "progress" && status && (
          <span className={`status-tag status-tag-${status}`}>
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
