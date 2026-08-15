-- CreateTable
CREATE TABLE "EstimateField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "EstimateField_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InitiativeEstimateValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "initiativeId" TEXT NOT NULL,
    "estimateFieldId" TEXT NOT NULL,
    "sizeLabelId" TEXT NOT NULL,
    CONSTRAINT "InitiativeEstimateValue_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InitiativeEstimateValue_estimateFieldId_fkey" FOREIGN KEY ("estimateFieldId") REFERENCES "EstimateField" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InitiativeEstimateValue_sizeLabelId_fkey" FOREIGN KEY ("sizeLabelId") REFERENCES "SizeLabel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Data migration: before the old Initiative.policySizeLabelId /
-- implementationSizeLabelId columns are dropped below, preserve every
-- project's existing two-field setup as configurable EstimateFields, and
-- every initiative's existing values as InitiativeEstimateValue rows — so
-- this migration is a pure reshape, not a data loss.
INSERT INTO "EstimateField" ("id", "projectId", "name", "orderIndex")
SELECT 'ef_' || lower(hex(randomblob(12))), "id", 'Policy', 0 FROM "Project";

INSERT INTO "EstimateField" ("id", "projectId", "name", "orderIndex")
SELECT 'ef_' || lower(hex(randomblob(12))), "id", 'Implementation', 1 FROM "Project";

INSERT INTO "InitiativeEstimateValue" ("id", "initiativeId", "estimateFieldId", "sizeLabelId")
SELECT 'iev_' || lower(hex(randomblob(12))), i."id", ef."id", i."policySizeLabelId"
FROM "Initiative" i
JOIN "Increment" inc ON inc."id" = i."incrementId"
JOIN "Milestone" mi ON mi."id" = inc."milestoneId"
JOIN "EstimateField" ef ON ef."projectId" = mi."projectId" AND ef."name" = 'Policy'
WHERE i."policySizeLabelId" IS NOT NULL;

INSERT INTO "InitiativeEstimateValue" ("id", "initiativeId", "estimateFieldId", "sizeLabelId")
SELECT 'iev_' || lower(hex(randomblob(12))), i."id", ef."id", i."implementationSizeLabelId"
FROM "Initiative" i
JOIN "Increment" inc ON inc."id" = i."incrementId"
JOIN "Milestone" mi ON mi."id" = inc."milestoneId"
JOIN "EstimateField" ef ON ef."projectId" = mi."projectId" AND ef."name" = 'Implementation'
WHERE i."implementationSizeLabelId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Initiative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incrementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderKey" TEXT NOT NULL,
    "timeEstimateWeeks" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Initiative_incrementId_fkey" FOREIGN KEY ("incrementId") REFERENCES "Increment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Initiative" ("createdAt", "id", "incrementId", "name", "notes", "orderKey", "timeEstimateWeeks", "updatedAt") SELECT "createdAt", "id", "incrementId", "name", "notes", "orderKey", "timeEstimateWeeks", "updatedAt" FROM "Initiative";
DROP TABLE "Initiative";
ALTER TABLE "new_Initiative" RENAME TO "Initiative";
CREATE INDEX "Initiative_incrementId_idx" ON "Initiative"("incrementId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME,
    "defaultSizingKeyId" TEXT,
    "timelineHeaderScales" TEXT NOT NULL DEFAULT '["month","week"]',
    "sprintLengthBusinessDays" INTEGER,
    "sprintStartWeekday" INTEGER,
    "finalSizeFormula" TEXT NOT NULL DEFAULT 'max',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_defaultSizingKeyId_fkey" FOREIGN KEY ("defaultSizingKeyId") REFERENCES "SizingKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "defaultSizingKeyId", "description", "id", "name", "sprintLengthBusinessDays", "sprintStartWeekday", "startDate", "timelineHeaderScales", "updatedAt") SELECT "createdAt", "defaultSizingKeyId", "description", "id", "name", "sprintLengthBusinessDays", "sprintStartWeekday", "startDate", "timelineHeaderScales", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EstimateField_projectId_name_key" ON "EstimateField"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateField_projectId_orderIndex_key" ON "EstimateField"("projectId", "orderIndex");

-- CreateIndex
CREATE INDEX "InitiativeEstimateValue_sizeLabelId_idx" ON "InitiativeEstimateValue"("sizeLabelId");

-- CreateIndex
CREATE UNIQUE INDEX "InitiativeEstimateValue_initiativeId_estimateFieldId_key" ON "InitiativeEstimateValue"("initiativeId", "estimateFieldId");
