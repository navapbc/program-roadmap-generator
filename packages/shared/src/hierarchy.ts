export interface HierarchyInitiative {
  id: string;
}
export interface HierarchyIncrement {
  id: string;
  name: string;
  initiatives: HierarchyInitiative[];
}
export interface HierarchyMilestone {
  id: string;
  name: string;
  increments: HierarchyIncrement[];
}

export interface IncrementBoundary {
  incrementId: string;
  name: string;
  initiativeIds: string[];
}
export interface MilestoneBoundary {
  milestoneId: string;
  name: string;
  increments: IncrementBoundary[];
}

/**
 * Builds the Milestone -> Increment -> initiativeIds grouping used to
 * render a Gantt with dividers at both levels, from a project's (or a
 * filtered subset of a project's) raw hierarchy. Pure reshaping — doesn't
 * care whether an increment ended up with zero initiatives (a milestone
 * that's been scoped down elsewhere); callers decide whether to skip
 * rendering an empty group.
 */
export function buildMilestoneBoundaries(milestones: HierarchyMilestone[]): MilestoneBoundary[] {
  return milestones.map((m) => ({
    milestoneId: m.id,
    name: m.name,
    increments: m.increments.map((inc) => ({
      incrementId: inc.id,
      name: inc.name,
      initiativeIds: inc.initiatives.map((i) => i.id),
    })),
  }));
}
