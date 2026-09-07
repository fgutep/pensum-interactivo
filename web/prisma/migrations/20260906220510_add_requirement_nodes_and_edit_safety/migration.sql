-- CreateTable
CREATE TABLE "RequirementNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "catalogId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "infoUrl" TEXT,
    "credits" REAL NOT NULL DEFAULT 0,
    "semester" INTEGER NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 9999,
    "attestationId" TEXT,
    "linkedCourseCodes" JSONB,
    "autoLinkRegex" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RequirementNode_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogCourse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "catalogId" INTEGER NOT NULL,
    "courseId" INTEGER,
    "displayCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" REAL NOT NULL,
    "suggestedSemester" INTEGER NOT NULL,
    "courseType" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "placeholderKind" TEXT,
    "placeholderLabel" TEXT,
    "sortIndex" INTEGER NOT NULL,
    "prereqText" TEXT,
    "coreqText" TEXT,
    "prereqTree" JSONB,
    "coreqTree" JSONB,
    "pairingStatus" TEXT NOT NULL DEFAULT 'needs_manual',
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "lockedFields" JSONB,
    CONSTRAINT "CatalogCourse_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CatalogCourse" ("catalogId", "coreqText", "coreqTree", "courseId", "courseType", "credits", "displayCode", "id", "isPlaceholder", "name", "pairingStatus", "placeholderKind", "placeholderLabel", "prereqText", "prereqTree", "sortIndex", "suggestedSemester") SELECT "catalogId", "coreqText", "coreqTree", "courseId", "courseType", "credits", "displayCode", "id", "isPlaceholder", "name", "pairingStatus", "placeholderKind", "placeholderLabel", "prereqText", "prereqTree", "sortIndex", "suggestedSemester" FROM "CatalogCourse";
DROP TABLE "CatalogCourse";
ALTER TABLE "new_CatalogCourse" RENAME TO "CatalogCourse";
CREATE INDEX "CatalogCourse_catalogId_idx" ON "CatalogCourse"("catalogId");
CREATE INDEX "CatalogCourse_pairingStatus_idx" ON "CatalogCourse"("pairingStatus");
CREATE UNIQUE INDEX "CatalogCourse_catalogId_sortIndex_key" ON "CatalogCourse"("catalogId", "sortIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RequirementNode_catalogId_idx" ON "RequirementNode"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementNode_catalogId_key_key" ON "RequirementNode"("catalogId", "key");
