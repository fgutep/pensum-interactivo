-- CreateTable
CREATE TABLE `Catalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `programCode` VARCHAR(191) NOT NULL,
    `programName` VARCHAR(191) NOT NULL,
    `variantLabel` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `term` VARCHAR(191) NOT NULL,
    `sourceFilename` VARCHAR(191) NULL,
    `accentColor` VARCHAR(191) NULL,
    `tagline` VARCHAR(191) NULL,
    `subtitle` VARCHAR(191) NULL,
    `imagePath` VARCHAR(191) NULL,
    `rules` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Catalog_slug_key`(`slug`),
    INDEX `Catalog_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RequirementNode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `catalogId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `infoUrl` VARCHAR(191) NULL,
    `credits` DOUBLE NOT NULL DEFAULT 0,
    `semester` INTEGER NOT NULL,
    `sortIndex` INTEGER NOT NULL DEFAULT 9999,
    `attestationId` VARCHAR(191) NULL,
    `linkedCourseCodes` JSON NULL,
    `autoLinkRegex` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RequirementNode_catalogId_idx`(`catalogId`),
    UNIQUE INDEX `RequirementNode_catalogId_key_key`(`catalogId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `normalizedCode` VARCHAR(191) NOT NULL,
    `nameEs` VARCHAR(500) NOT NULL,
    `nameEn` VARCHAR(500) NULL,
    `defaultCredits` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `description` TEXT NULL,
    `descriptionUrl` VARCHAR(191) NULL,
    `descriptionSyncedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Course_normalizedCode_key`(`normalizedCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogCourse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `catalogId` INTEGER NOT NULL,
    `courseId` INTEGER NULL,
    `displayCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(500) NOT NULL,
    `credits` DOUBLE NOT NULL,
    `suggestedSemester` INTEGER NOT NULL,
    `courseType` VARCHAR(191) NOT NULL,
    `isPlaceholder` BOOLEAN NOT NULL DEFAULT false,
    `placeholderKind` VARCHAR(191) NULL,
    `placeholderLabel` VARCHAR(191) NULL,
    `sortIndex` INTEGER NOT NULL,
    `prereqText` TEXT NULL,
    `coreqText` TEXT NULL,
    `prereqTree` JSON NULL,
    `coreqTree` JSON NULL,
    `pairingStatus` VARCHAR(191) NOT NULL DEFAULT 'needs_manual',
    `manuallyEdited` BOOLEAN NOT NULL DEFAULT false,
    `lockedFields` JSON NULL,

    INDEX `CatalogCourse_catalogId_idx`(`catalogId`),
    INDEX `CatalogCourse_pairingStatus_idx`(`pairingStatus`),
    UNIQUE INDEX `CatalogCourse_catalogId_sortIndex_key`(`catalogId`, `sortIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseOffering` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `courseId` INTEGER NOT NULL,
    `term` VARCHAR(191) NOT NULL,
    `offered` BOOLEAN NOT NULL,
    `canonicalTitle` VARCHAR(500) NULL,
    `canonicalCredits` DOUBLE NULL,
    `sectionCount` INTEGER NOT NULL DEFAULT 0,
    `seatsAvailableMin` INTEGER NULL,
    `seatsAvailableMax` INTEGER NULL,
    `attrs` JSON NULL,
    `ptrmSet` JSON NULL,
    `lastSyncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `syncError` VARCHAR(191) NULL,
    `detailsNrc` VARCHAR(191) NULL,
    `apiPrereqText` TEXT NULL,
    `apiPrereqTree` JSON NULL,
    `apiCoreq` JSON NULL,
    `apiCoreqTree` JSON NULL,
    `restrictions` JSON NULL,
    `detailsCompl` JSON NULL,
    `detailsMaster` JSON NULL,
    `detailsError` TEXT NULL,
    `detailsSyncedAt` DATETIME(3) NULL,

    INDEX `CourseOffering_term_idx`(`term`),
    UNIQUE INDEX `CourseOffering_courseId_term_key`(`courseId`, `term`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManualPairing` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `catalogCourseId` INTEGER NOT NULL,
    `excelCode` VARCHAR(191) NOT NULL,
    `excelName` VARCHAR(500) NOT NULL,
    `excelCredits` DOUBLE NULL,
    `excelSemester` INTEGER NULL,
    `excelPrereqText` TEXT NULL,
    `suggestedCode` VARCHAR(191) NULL,
    `candidateCodes` JSON NULL,
    `resolvedCode` VARCHAR(191) NULL,
    `resolvedNote` TEXT NULL,
    `keepAsPlaceholder` BOOLEAN NOT NULL DEFAULT false,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ManualPairing_catalogCourseId_key`(`catalogCourseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(191) NOT NULL,
    `prereqFilename` VARCHAR(191) NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'parsed',
    `scope` VARCHAR(191) NOT NULL,
    `diff` JSON NULL,
    `errors` JSON NULL,
    `warnings` JSON NULL,
    `parsedPayload` JSON NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `appliedAt` DATETIME(3) NULL,
    `catalogId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogSnapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `catalogId` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CatalogSnapshot_catalogId_idx`(`catalogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Elective` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(500) NOT NULL,
    `normalizedName` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `level` VARCHAR(191) NOT NULL,
    `ciclo` VARCHAR(191) NULL,
    `roles` JSON NOT NULL,
    `isCursoIntegrador` BOOLEAN NOT NULL DEFAULT false,
    `offeredTerms` JSON NOT NULL,
    `sourceFiles` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Elective_normalizedName_key`(`normalizedName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actor` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RequirementNode` ADD CONSTRAINT `RequirementNode_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `Catalog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogCourse` ADD CONSTRAINT `CatalogCourse_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `Catalog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogCourse` ADD CONSTRAINT `CatalogCourse_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseOffering` ADD CONSTRAINT `CourseOffering_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManualPairing` ADD CONSTRAINT `ManualPairing_catalogCourseId_fkey` FOREIGN KEY (`catalogCourseId`) REFERENCES `CatalogCourse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `Catalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogSnapshot` ADD CONSTRAINT `CatalogSnapshot_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `Catalog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
