-- CreateTable
CREATE TABLE "Catalog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "term" TEXT NOT NULL,
    "sourceFilename" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "normalizedCode" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "defaultCredits" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CatalogCourse" (
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
    CONSTRAINT "CatalogCourse_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "courseId" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "offered" BOOLEAN NOT NULL,
    "canonicalTitle" TEXT,
    "canonicalCredits" REAL,
    "sectionCount" INTEGER NOT NULL DEFAULT 0,
    "seatsAvailableMin" INTEGER,
    "seatsAvailableMax" INTEGER,
    "attrs" JSONB,
    "ptrmSet" JSONB,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncError" TEXT,
    CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualPairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "catalogCourseId" INTEGER NOT NULL,
    "excelCode" TEXT NOT NULL,
    "excelName" TEXT NOT NULL,
    "excelCredits" REAL,
    "excelSemester" INTEGER,
    "excelPrereqText" TEXT,
    "suggestedCode" TEXT,
    "candidateCodes" JSONB,
    "resolvedCode" TEXT,
    "resolvedNote" TEXT,
    "keepAsPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualPairing_catalogCourseId_fkey" FOREIGN KEY ("catalogCourseId") REFERENCES "CatalogCourse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "prereqFilename" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'parsed',
    "scope" TEXT NOT NULL,
    "diff" JSONB,
    "errors" JSONB,
    "warnings" JSONB,
    "parsedPayload" JSONB,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" DATETIME,
    "catalogId" INTEGER,
    CONSTRAINT "ImportJob_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "catalogId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogSnapshot_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_slug_key" ON "Catalog"("slug");

-- CreateIndex
CREATE INDEX "Catalog_status_idx" ON "Catalog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Course_normalizedCode_key" ON "Course"("normalizedCode");

-- CreateIndex
CREATE INDEX "CatalogCourse_catalogId_idx" ON "CatalogCourse"("catalogId");

-- CreateIndex
CREATE INDEX "CatalogCourse_pairingStatus_idx" ON "CatalogCourse"("pairingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCourse_catalogId_sortIndex_key" ON "CatalogCourse"("catalogId", "sortIndex");

-- CreateIndex
CREATE INDEX "CourseOffering_term_idx" ON "CourseOffering"("term");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_term_key" ON "CourseOffering"("courseId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "ManualPairing_catalogCourseId_key" ON "ManualPairing"("catalogCourseId");

-- CreateIndex
CREATE INDEX "CatalogSnapshot_catalogId_idx" ON "CatalogSnapshot"("catalogId");
