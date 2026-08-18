import { router } from '../trpc.js';
import { projectRouter } from './project.js';
import { sizeLabelRouter } from './sizeLabel.js';
import { estimateFieldRouter } from './estimateField.js';
import { milestoneRouter } from './milestone.js';
import { incrementRouter } from './increment.js';
import { initiativeRouter } from './initiative.js';
import { sizingKeyRouter } from './sizingKey.js';
import { timelineRouter } from './timeline.js';
import { markerRouter } from './marker.js';
import { combinedViewRouter } from './combinedView.js';

export const appRouter = router({
  project: projectRouter,
  sizeLabel: sizeLabelRouter,
  estimateField: estimateFieldRouter,
  milestone: milestoneRouter,
  increment: incrementRouter,
  initiative: initiativeRouter,
  sizingKey: sizingKeyRouter,
  timeline: timelineRouter,
  marker: markerRouter,
  combinedView: combinedViewRouter,
});

export type AppRouter = typeof appRouter;
