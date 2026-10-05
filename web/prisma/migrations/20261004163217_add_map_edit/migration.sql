-- CreateTable
CREATE TABLE `MapEdit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `catalogId` INTEGER NOT NULL,
    `actor` VARCHAR(100) NOT NULL,
    `ops` JSON NOT NULL,
    `undo` JSON NOT NULL,
    `snapshotId` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'applied',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `undoneAt` DATETIME(3) NULL,

    INDEX `MapEdit_catalogId_idx`(`catalogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MapEdit` ADD CONSTRAINT `MapEdit_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `Catalog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
