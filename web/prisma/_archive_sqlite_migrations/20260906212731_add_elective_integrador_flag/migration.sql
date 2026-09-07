-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Elective" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "code" TEXT,
    "level" TEXT NOT NULL,
    "ciclo" TEXT,
    "roles" JSONB NOT NULL,
    "isCursoIntegrador" BOOLEAN NOT NULL DEFAULT false,
    "offeredTerms" JSONB NOT NULL,
    "sourceFiles" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Elective" ("ciclo", "code", "createdAt", "id", "level", "name", "normalizedName", "offeredTerms", "roles", "sourceFiles", "updatedAt") SELECT "ciclo", "code", "createdAt", "id", "level", "name", "normalizedName", "offeredTerms", "roles", "sourceFiles", "updatedAt" FROM "Elective";
DROP TABLE "Elective";
ALTER TABLE "new_Elective" RENAME TO "Elective";
CREATE UNIQUE INDEX "Elective_normalizedName_key" ON "Elective"("normalizedName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
