-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Catalog" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "term" TEXT NOT NULL,
    "sourceFilename" TEXT,
    "accentColor" TEXT,
    "tagline" TEXT,
    "subtitle" TEXT,
    "imagePath" TEXT,
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementNode" (
    "id" SERIAL NOT NULL,
    "catalogId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "infoUrl" TEXT,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "semester" INTEGER NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 9999,
    "attestationId" TEXT,
    "linkedCourseCodes" JSONB,
    "autoLinkRegex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "defaultCredits" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "descriptionUrl" TEXT,
    "descriptionSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCourse" (
    "id" SERIAL NOT NULL,
    "catalogId" INTEGER NOT NULL,
    "courseId" INTEGER,
    "displayCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
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

    CONSTRAINT "CatalogCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "offered" BOOLEAN NOT NULL,
    "canonicalTitle" TEXT,
    "canonicalCredits" DOUBLE PRECISION,
    "sectionCount" INTEGER NOT NULL DEFAULT 0,
    "seatsAvailableMin" INTEGER,
    "seatsAvailableMax" INTEGER,
    "attrs" JSONB,
    "ptrmSet" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncError" TEXT,
    "detailsNrc" TEXT,
    "apiPrereqText" TEXT,
    "apiPrereqTree" JSONB,
    "apiCoreq" JSONB,
    "apiCoreqTree" JSONB,
    "restrictions" JSONB,
    "detailsCompl" JSONB,
    "detailsMaster" JSONB,
    "detailsError" TEXT,
    "detailsSyncedAt" TIMESTAMP(3),

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualPairing" (
    "id" SERIAL NOT NULL,
    "catalogCourseId" INTEGER NOT NULL,
    "excelCode" TEXT NOT NULL,
    "excelName" TEXT NOT NULL,
    "excelCredits" DOUBLE PRECISION,
    "excelSemester" INTEGER,
    "excelPrereqText" TEXT,
    "suggestedCode" TEXT,
    "candidateCodes" JSONB,
    "resolvedCode" TEXT,
    "resolvedNote" TEXT,
    "keepAsPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "prereqFilename" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'parsed',
    "scope" TEXT NOT NULL,
    "diff" JSONB,
    "errors" JSONB,
    "warnings" JSONB,
    "parsedPayload" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "catalogId" INTEGER,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSnapshot" (
    "id" SERIAL NOT NULL,
    "catalogId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Elective" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "code" TEXT,
    "level" TEXT NOT NULL,
    "ciclo" TEXT,
    "roles" JSONB NOT NULL,
    "isCursoIntegrador" BOOLEAN NOT NULL DEFAULT false,
    "offeredTerms" JSONB NOT NULL,
    "sourceFiles" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Elective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_slug_key" ON "Catalog"("slug");

-- CreateIndex
CREATE INDEX "Catalog_status_idx" ON "Catalog"("status");

-- CreateIndex
CREATE INDEX "RequirementNode_catalogId_idx" ON "RequirementNode"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementNode_catalogId_key_key" ON "RequirementNode"("catalogId", "key");

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

-- CreateIndex
CREATE UNIQUE INDEX "Elective_normalizedName_key" ON "Elective"("normalizedName");

-- AddForeignKey
ALTER TABLE "RequirementNode" ADD CONSTRAINT "RequirementNode_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCourse" ADD CONSTRAINT "CatalogCourse_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCourse" ADD CONSTRAINT "CatalogCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPairing" ADD CONSTRAINT "ManualPairing_catalogCourseId_fkey" FOREIGN KEY ("catalogCourseId") REFERENCES "CatalogCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSnapshot" ADD CONSTRAINT "CatalogSnapshot_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

