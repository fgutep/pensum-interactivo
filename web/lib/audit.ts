// Append-only audit trail for admin mutations. Call after a successful write.

import { prisma } from "./db";

export async function writeAudit(entry: {
  actor?: string;
  action: string; // "catalog.update" | "course.update" | "import.apply" | ...
  entityType: string; // "Catalog" | "CatalogCourse" | "RequirementNode" | ...
  entityId: string | number;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actor: entry.actor ?? "admin",
        action: entry.action,
        entityType: entry.entityType,
        entityId: String(entry.entityId),
        before: (entry.before ?? undefined) as object | undefined,
        after: (entry.after ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    // never let audit failure break the mutation it records
    console.error("writeAudit failed", err);
  }
}
