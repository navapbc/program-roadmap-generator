-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SizingKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxOverlap" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SizingKey" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "SizingKey";
DROP TABLE "SizingKey";
ALTER TABLE "new_SizingKey" RENAME TO "SizingKey";
CREATE TABLE "new_SizingPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sizingKeyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "canOverlap" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SizingPhase_sizingKeyId_fkey" FOREIGN KEY ("sizingKeyId") REFERENCES "SizingKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SizingPhase" ("id", "name", "orderIndex", "sizingKeyId", "unit") SELECT "id", "name", "orderIndex", "sizingKeyId", "unit" FROM "SizingPhase";
DROP TABLE "SizingPhase";
ALTER TABLE "new_SizingPhase" RENAME TO "SizingPhase";
CREATE UNIQUE INDEX "SizingPhase_sizingKeyId_orderIndex_key" ON "SizingPhase"("sizingKeyId", "orderIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
