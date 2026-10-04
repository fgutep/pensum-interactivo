-- CreateTable
CREATE TABLE `RegistroImport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(191) NOT NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'parsed',
    `fileBytes` LONGBLOB NULL,
    `scope` JSON NOT NULL,
    `termWindow` JSON NULL,
    `parseStats` JSON NULL,
    `reduceStats` JSON NULL,
    `resolutions` JSON NULL,
    `applyResult` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `appliedAt` DATETIME(3) NULL,

    INDEX `RegistroImport_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistroCourse` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `importId` INTEGER NOT NULL,
    `normalizedCode` VARCHAR(32) NOT NULL,
    `displayCode` VARCHAR(64) NOT NULL,
    `nameEs` VARCHAR(500) NOT NULL,
    `credits` DOUBLE NULL,
    `departamento` VARCHAR(200) NOT NULL,
    `nivel` VARCHAR(16) NOT NULL,
    `period` VARCHAR(6) NOT NULL,
    `prereqText` TEXT NULL,
    `coreqText` TEXT NULL,
    `restrictions` JSON NULL,
    `isCore` BOOLEAN NOT NULL DEFAULT false,

    INDEX `RegistroCourse_normalizedCode_idx`(`normalizedCode`),
    UNIQUE INDEX `RegistroCourse_importId_normalizedCode_key`(`importId`, `normalizedCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RegistroCourse` ADD CONSTRAINT `RegistroCourse_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `RegistroImport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
