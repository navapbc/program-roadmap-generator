-- CreateTable
CREATE TABLE "CombinedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timelineHeaderScales" TEXT NOT NULL DEFAULT '["month","week"]',
    "dateRangeStart" DATETIME,
    "dateRangeEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CombinedViewScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "combinedViewId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "incrementId" TEXT,
    "sizingKeyId" TEXT NOT NULL,
    "startDateOverride" DATETIME,
    "orderKey" TEXT NOT NULL,
    CONSTRAINT "CombinedViewScope_combinedViewId_fkey" FOREIGN KEY ("combinedViewId") REFERENCES "CombinedView" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CombinedViewScope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CombinedViewScope_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CombinedViewScope_incrementId_fkey" FOREIGN KEY ("incrementId") REFERENCES "Increment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CombinedViewScope_sizingKeyId_fkey" FOREIGN KEY ("sizingKeyId") REFERENCES "SizingKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CombinedViewScope_combinedViewId_idx" ON "CombinedViewScope"("combinedViewId");

-- CreateIndex
CREATE INDEX "CombinedViewScope_projectId_idx" ON "CombinedViewScope"("projectId");
