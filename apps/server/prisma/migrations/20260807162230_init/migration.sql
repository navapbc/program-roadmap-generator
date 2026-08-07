-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME,
    "defaultSizingKeyId" TEXT,
    "timelineHeaderScales" TEXT NOT NULL DEFAULT '["month","week"]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_defaultSizingKeyId_fkey" FOREIGN KEY ("defaultSizingKeyId") REFERENCES "SizingKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SizeLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "SizeLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Increment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "milestoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Increment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incrementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderKey" TEXT NOT NULL,
    "policySizeLabelId" TEXT,
    "implementationSizeLabelId" TEXT,
    "timeEstimateWeeks" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Initiative_incrementId_fkey" FOREIGN KEY ("incrementId") REFERENCES "Increment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Initiative_policySizeLabelId_fkey" FOREIGN KEY ("policySizeLabelId") REFERENCES "SizeLabel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Initiative_implementationSizeLabelId_fkey" FOREIGN KEY ("implementationSizeLabelId") REFERENCES "SizeLabel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    -- Safety net behind the Zod refine in updateInitiativeSchema: sizing (policy/implementation) and a raw time estimate are mutually exclusive.
    CONSTRAINT "Initiative_sizing_xor_estimate" CHECK (
        NOT (
            (policySizeLabelId IS NOT NULL OR implementationSizeLabelId IS NOT NULL)
            AND timeEstimateWeeks IS NOT NULL
        )
    )
);

-- CreateTable
CREATE TABLE "SizingKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SizingKeyLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sizingKeyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "SizingKeyLabel_sizingKeyId_fkey" FOREIGN KEY ("sizingKeyId") REFERENCES "SizingKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SizingPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sizingKeyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "SizingPhase_sizingKeyId_fkey" FOREIGN KEY ("sizingKeyId") REFERENCES "SizingKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- Safety net behind phaseUnitSchema (packages/shared/schemas.ts).
    CONSTRAINT "SizingPhase_unit_check" CHECK ("unit" IN ('day', 'week', 'month'))
);

-- CreateTable
CREATE TABLE "SizingDuration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sizingPhaseId" TEXT NOT NULL,
    "labelCode" TEXT NOT NULL,
    "durationValue" REAL NOT NULL,
    CONSTRAINT "SizingDuration_sizingPhaseId_fkey" FOREIGN KEY ("sizingPhaseId") REFERENCES "SizingPhase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SizeLabel_projectId_code_key" ON "SizeLabel"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SizeLabel_projectId_orderIndex_key" ON "SizeLabel"("projectId", "orderIndex");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Increment_milestoneId_idx" ON "Increment"("milestoneId");

-- CreateIndex
CREATE INDEX "Initiative_incrementId_idx" ON "Initiative"("incrementId");

-- CreateIndex
CREATE UNIQUE INDEX "SizingKeyLabel_sizingKeyId_code_key" ON "SizingKeyLabel"("sizingKeyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SizingKeyLabel_sizingKeyId_orderIndex_key" ON "SizingKeyLabel"("sizingKeyId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "SizingPhase_sizingKeyId_orderIndex_key" ON "SizingPhase"("sizingKeyId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "SizingDuration_sizingPhaseId_labelCode_key" ON "SizingDuration"("sizingPhaseId", "labelCode");
