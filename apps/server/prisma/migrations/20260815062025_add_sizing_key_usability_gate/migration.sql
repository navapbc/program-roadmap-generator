-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SizingKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxOverlap" INTEGER NOT NULL DEFAULT 2,
    "usabilityGateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SizingKey" ("createdAt", "description", "id", "maxOverlap", "name", "updatedAt") SELECT "createdAt", "description", "id", "maxOverlap", "name", "updatedAt" FROM "SizingKey";
DROP TABLE "SizingKey";
ALTER TABLE "new_SizingKey" RENAME TO "SizingKey";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
