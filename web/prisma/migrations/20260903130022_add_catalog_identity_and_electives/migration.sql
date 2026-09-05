-- AlterTable
ALTER TABLE "Catalog" ADD COLUMN "accentColor" TEXT;
ALTER TABLE "Catalog" ADD COLUMN "imagePath" TEXT;
ALTER TABLE "Catalog" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "Catalog" ADD COLUMN "tagline" TEXT;

-- CreateTable
CREATE TABLE "Elective" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "code" TEXT,
    "level" TEXT NOT NULL,
    "ciclo" TEXT,
    "roles" JSONB NOT NULL,
    "offeredTerms" JSONB NOT NULL,
    "sourceFiles" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Elective_normalizedName_key" ON "Elective"("normalizedName");
