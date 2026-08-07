import { router } from '../trpc.js';
import { projectRouter } from './project.js';
import { sizeLabelRouter } from './sizeLabel.js';
import { milestoneRouter } from './milestone.js';
import { incrementRouter } from './increment.js';
import { initiativeRouter } from './initiative.js';
import { sizingKeyRouter } from './sizingKey.js';
import { timelineRouter } from './timeline.js';
import { markerRouter } from './marker.js';

export const appRouter = router({
  project: projectRouter,
  sizeLabel: sizeLabelRouter,
  milestone: milestoneRouter,
  increment: incrementRouter,
  initiative: initiativeRouter,
  sizingKey: sizingKeyRouter,
  timeline: timelineRouter,
  marker: markerRouter,
});

export type AppRouter = typeof appRouter;
