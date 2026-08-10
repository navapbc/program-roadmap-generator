# Manual test checklist

Automated coverage is limited to `packages/shared` (see `packages/shared/src/__tests__/` —
`sizing.test.ts`, `timeline.test.ts`, `ganttHeader.test.ts`, run via `npm test`). Nothing in
`apps/server` or `apps/web` has automated tests, so every scenario below has to be re-checked by
hand after a change to that code. Run `npm run dev` first, then work through the relevant sections.

Checkboxes are unchecked on purpose — this is a checklist to run, not a log of what already
passed once.

## Projects

- [ ] Create a project from the project list; it appears in the list immediately.
- [ ] Open **Settings**, edit Name and Description (blur to save); confirm the new values persist
      after a page reload.
- [ ] From the project view, the **← Back to \<project name\>** link on Settings returns to that
      project.
- [ ] Set a Start date, then clear it; the Timeline's relative/absolute labeling should follow
      (see Timeline section).
- [ ] Delete a project from the list (with confirmation); it disappears and its data is gone
      (milestones/increments/initiatives/labels cascade-deleted).

## Hierarchy (Milestones → Increments → Initiatives)

- [ ] Add a Milestone, then an Increment inside it, then an Initiative inside that. Each appears
      immediately without a page reload.
- [ ] Rename a Milestone/Increment/Initiative inline (blur to save); reload and confirm it stuck.
- [ ] Delete an Initiative, an Increment, and a Milestone; each removal cascades correctly (deleting
      an Increment also removes its Initiatives).

## Sizing an Initiative

- [ ] With at least one size label defined (see Project Settings below), set Policy and
      Implementation sizes on an Initiative via the two dropdowns.
- [ ] Confirm **Final** updates live with no explicit save action, and equals
      `MAX(policy, implementation)` per the project's label order (e.g. Policy=S, Impl=L → Final=L).
- [ ] Click **Use estimate**; confirm the Policy/Implementation dropdowns are replaced by a single
      "Time estimate (weeks)" field, and reload to confirm Policy/Implementation were cleared
      server-side (mutual exclusivity), not just hidden in the UI.
- [ ] Click **Use sizing** to switch back; confirm the estimate was cleared.
- [ ] Try (via direct API call, not the UI, since the UI never allows it) setting both a size and a
      time estimate in the same `initiative.update` call — should be rejected with "An initiative
      can use a size or a time estimate, not both."
- [ ] Leave an Initiative with neither a size nor an estimate; it should render as "Unsized" (final
      size column) without breaking anything else.

## Drag-and-drop reordering

- [ ] Drag an Initiative to a new position within its Increment; reload and confirm the new order
      persisted.
- [ ] Drag an Increment to a new position within its Milestone; reload and confirm:
  - [ ] The Increment order changed.
  - [ ] **Each Increment's internal Initiative order is unchanged** — this is the scenario most
        likely to regress if the drag-and-drop or ordering logic is touched.
- [ ] Confirm dragging an Initiative never lets it drop into a different Increment (out of scope
      for this app — dragging across Increments should have no effect).

## Project Settings — size labels

- [ ] Add a size label (e.g. "XL"); it appears in the ordered list and becomes selectable on
      Initiatives.
- [ ] Reorder labels with the ← / → controls; confirm the new order affects which size "wins" in
      the Final-size MAX computation (drag M above L, then Policy=M/Impl=L should now show
      Final=M).
- [ ] Rename a label; existing Initiatives using it should show the new code.
- [ ] Try to delete a label that's in use by an Initiative — should be rejected with a message
      listing which Initiative(s) use it.
- [ ] Delete an unused label — should succeed and the remaining labels stay contiguously ordered.

## Sizing Keys

- [ ] Create a new Sizing Key from the Sizing Keys list.
- [ ] Add labels to it, add phases (each phase picks a unit: Day / Week / Month), and fill in the
      duration grid (one cell per phase × label).
- [ ] Reorder phases with ↑ / ↓; confirm the duration grid and the timeline preview reorder to
      match.
- [ ] Duplicate a key; confirm the copy has its own independent labels/phases/durations (editing
      the copy doesn't affect the original).
- [ ] On a Project's Settings page, with a Sizing Key that does **not** cover every label the
      project uses: confirm it's shown disabled in the dropdown with "(missing: ...)", and that the
      **"No sizing key currently covers every size label above"** banner appears with a working
      **Create one now** link that creates a new key pre-populated with the project's current
      labels and navigates straight to its editor.
- [ ] Confirm the same disabled/"Create one" behavior appears in the Timeline page's sizing-key
      selector.

## Real-calendar month math (packages/shared has unit tests for this — this is the UI-level check)

- [ ] Give a Sizing Key phase a **Month** unit, size it, and select that key on a Project with a
      Start date set.
- [ ] On the Timeline, hover/inspect a Month-unit segment starting in a 31-day month (e.g.
      January) vs. one starting in a 28/29-day month (e.g. February) — the segment widths should
      differ (not be uniform), because months use their real length, not an average.
- [ ] Clear the project's Start date; a Month-unit phase should still compute a duration (falling
      back to a labeled average, ~30.44 days) rather than breaking.

## Sprint cadence

- [ ] On Project Settings, set a sprint Length (business days) and Starts-on weekday, then Save.
- [ ] Confirm the **Sprint** checkbox appears (hidden entirely, not just disabled, until both
      fields are set) under Timeline header scales, on both Settings and the Timeline page.
- [ ] Enable the Sprint row on the Timeline; confirm sprint boundaries land on the configured
      weekday (e.g. a 10-business-day sprint starting Monday should span exactly 2 calendar weeks).
- [ ] Try saving only one of the two fields — should be rejected with "Set both a sprint length and
      a start weekday, or clear both."
- [ ] Use **Clear** to remove the cadence; the Sprint checkbox should disappear again.

## Timeline view

- [ ] Select a compatible Sizing Key; the Gantt renders with one row per Initiative, grouped under
      Milestone dividers, sequential and non-overlapping.
- [ ] Switch to a different compatible Sizing Key and confirm the chart updates **instantly with no
      network request** (check the browser's Network tab — after the first load of each key,
      switching back and forth should show zero new `sizingKey.getFull` calls).
- [ ] Set/clear the Start date override (this is a local preview override, not saved) and confirm
      the header switches between real calendar dates and relative "Week N" labels.
- [ ] Toggle each header-scale checkbox (Year/Quarter/Month/Sprint/Week/Day); confirm:
  - [ ] Calendar scales (Year/Quarter/Month) and Sprint are hidden entirely when there's no start
        date (or no sprint cadence), not just disabled.
  - [ ] The header rows always stack coarsest-to-finest (Year → Quarter → Month → Sprint → Week →
        Day) regardless of the order you checked them in — check this by unchecking Month and
        re-checking it last; it should still render above Week.
- [ ] Confirm a time-estimate Initiative renders as a single unphased block, and an unsized
      Initiative is flagged without breaking the sequencing of the initiatives after it.
- [ ] Give an Initiative a long name (long enough to need 2-3 lines at the label column's width);
      confirm it wraps in full within the label column (row grows taller to fit) rather than being
      cut off with an ellipsis, and its phase bar stays vertically centered in the taller row. Check
      this on both the Timeline page and Combined Timeline.

## Zoom & readability

- [ ] Use the +/− zoom controls; bars and header labels should get wider/narrower together, and
      labels that were truncated at low zoom should become fully readable at higher zoom.
- [ ] Click **Reset**; zoom returns to the default level.
- [ ] Scroll the chart horizontally; the Milestone/Initiative name column on the left should stay
      pinned (sticky) while the chart content scrolls underneath it.

## Timeline header labels

- [ ] Confirm compact label formats: Day → `D01`, `D02`, ...; Week → `W01`, `W02`, ... . Sprint/Year
      labels are unchanged.
- [ ] With a project Start date set, confirm Month labels show the real calendar month name (`Jan`,
      `Feb`, ...) with no year suffix — never the old `M01`-style numeric code.
- [ ] With both **Quarter** and **Year** checked, confirm Quarter labels drop the year (`Q1`, not
      `Q1 2027`). Uncheck Year (Quarter still checked): confirm Quarter labels now include the year
      again (`Q1 2027`) so the date context isn't lost.
- [ ] Confirm Day tick labels are right-aligned within their column (flush to the right border), not
      left-aligned like the other scales.
- [ ] Zoom out (or shrink the browser window — see "Responsive timeline width" below) until Day, then
      Week, then Month would each render too narrow for their own label: confirm each becomes
      unchecked and disabled (greyed out) in turn, coarsest-surviving-longest (Day disables first,
      then Week, Month holds out the longest), with a "Zoom in to display \<scale\>[ and \<scale\>]
      labels" note listing every currently-unreadable scale — on both the Timeline page and Combined
      Timeline.
- [ ] Zoom back in past each threshold: confirm the checkbox re-enables and returns to whatever
      checked/unchecked state it had before (it should not have lost the underlying preference while
      disabled).
- [ ] At intermediate zoom levels, confirm the Day tick's `D` prefix can drop before the day number
      does — e.g. a tick might show `01` without the `D` when there's only just enough room, rather
      than truncating the number itself.

## Responsive timeline width

- [ ] Load a Timeline (or Combined Timeline) whose project has a moderate number of weeks. Confirm
      the chart fills the available width edge-to-edge with no manual zooming and no scrollbar.
- [ ] Resize the browser window narrower and wider (while below the app's ~1280px content cap):
      confirm the chart continuously re-fits to the new width live, without needing a page reload.
- [ ] Load a Timeline for a very long project (spanning several years). Confirm the chart holds at a
      legible minimum scale rather than compressing bars/labels into illegible slivers, and that when
      it can't fit, the **whole page** scrolls horizontally (not just a small box around the chart) —
      check that the chart's white background and border extend across its *entire* width, with no
      point where the background reverts to the page's own background color mid-chart.
- [ ] Use the +/− zoom controls on a comfortably-fitting timeline: confirm zooming in intentionally
      produces the same page-level horizontal scroll (rather than a locally-scrolling box), and Reset
      returns to the auto-fit width.

## Point-in-time date markers

- [ ] On Project Settings, add a Key date (label + date) with the project's Start date set.
- [ ] On the Timeline, confirm a labeled vertical line appears at the correct x-position, spanning
      the full height of the chart (through the header and every row).
- [ ] Clear the project's Start date; markers should disappear from the Timeline (there's no
      calendar to place them against) rather than rendering at a wrong position.
- [ ] Delete a marker; it disappears from the Timeline immediately after reload.

## Combined Timeline

- [ ] Add two or more scopes (different Projects, and/or a specific Milestone within a Project),
      each with its own Sizing Key selection.
- [ ] Confirm each scope renders as its own labeled group, all sharing one time axis.
- [ ] Confirm a scope with no Start date is visibly flagged "relative" rather than silently
      misaligned against an anchored scope.
- [ ] Confirm markers and sprint cadence (when present on the relevant scope's project) render
      correctly offset within the shared axis.

## Import

- [ ] From the Projects list, click **Import…**, choose a previously-exported roadmap **CSV** file;
      confirm it parses and shows an editable project-name field pre-filled from the file, plus a
      row/milestone-count summary.
- [ ] Repeat with a previously-exported roadmap **JSON** file; same result.
- [ ] Import with the name field left as a name that **already exists**: confirm the import is
      rejected with a message naming the collision, the parsed file/rows are **not** lost, and you
      can edit the name field and resubmit without re-choosing the file.
- [ ] Import with a new, unused name: confirm a **brand-new** project is created (the file's source
      project, if it still exists, is untouched) and you're navigated to it.
- [ ] Confirm the imported project's size labels, Milestones/Increments/Initiatives, and
      Policy/Implementation sizes match the source file, in the same order.
- [ ] Import a file where one row has both a size and a time-estimate value: confirm the import
      still succeeds, the initiative keeps its size (not the estimate), and a warning is shown
      listing that initiative by name.
- [ ] Try a malformed file (e.g. missing a required column, or invalid JSON): confirm a clear error
      is shown instead of a crash, and the file input can be retried.

## Sizing Key timeline preview

- [ ] Open a Sizing Key's editor page and confirm the "Timeline preview" section shows one row per
      size label, each split into its phase segments — matching the shape of the original
      spreadsheet's size-key tab.
- [ ] Confirm it has its own zoom controls and behaves the same way as the Timeline's zoom.

## Exports

- [ ] **Roadmap CSV** (project page → Export CSV): downloads a CSV with columns `project, milestone,
      increment, initiative, policySize, implementationSize, finalSize, timeEstimateWeeks, notes`;
      spot-check a few rows against what's shown on screen.
- [ ] **Roadmap JSON** (project page → Export JSON): downloads the same data as a JSON array.
- [ ] **Timeline CSV** (Timeline page → Export CSV): downloads one row per phase segment with
      `project, milestone, increment, initiative, phase, startDate, endDate`; confirm dates are real
      calendar dates when the project is anchored, or `Week N` when it isn't.
  - [ ] **No overlap**: for a multi-phase Initiative, confirm each phase's `endDate` is the day
        *before* the next phase's `startDate` (e.g. Discovery ends 9/2, Implementation starts 9/3) —
        never the same calendar day.
- [ ] **Timeline PDF** (Timeline page → Export PDF): downloads a PDF containing a snapshot of the
      Gantt chart (zoom controls should **not** appear in the image). Open the PDF and confirm it's
      legible.
- [ ] **Workbook XLSX** (project page → Export XLSX): downloads a workbook with:
  - [ ] A **Project** tab containing the same rows as the Roadmap CSV/JSON export.
  - [ ] One tab per **compatible** Sizing Key only — an incompatible key (missing a label the
        project uses) should **not** get a tab.
  - [ ] Each key's tab has its name/description, its label × phase duration matrix, and an embedded
        image of that key's Timeline near the bottom of the tab.
  - [ ] Open the workbook in Excel/Numbers/Google Sheets and confirm the embedded image actually
        renders (not a broken/missing image).
