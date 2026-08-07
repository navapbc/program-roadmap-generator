# User Guide

This guide covers how to use the Program Roadmap Generator once it is running in your browser. If it
is not running yet, start with the [Quickstart in the README](./README.md#quickstart-for-program-and-project-managers).

Everything here happens on your own laptop, and every change saves immediately to a local file. There
is no "Save" button for most fields, and **no undo** — see [Things that surprise people](#things-that-surprise-people)
before you start deleting things.

## Contents
- [The big picture](#the-big-picture)
- [Your first 15 minutes](#your-first-15-minutes)
- [Getting around](#getting-around)
- [Building your roadmap](#building-your-roadmap)
- [Sizing initiatives](#sizing-initiatives)
- [Sizing keys](#sizing-keys)
- [Project settings](#project-settings)
- [Reading the timeline](#reading-the-timeline)
- [Comparing scenarios](#comparing-scenarios)
- [Things that surprise people](#things-that-surprise-people)
- [Common questions](#common-questions)

---

## The big picture

The tool turns a work breakdown plus a set of estimates into a visual schedule. Three ideas drive
everything:

**1. Work nests four levels deep.**

```
Project  →  Milestone  →  Increment  →  Initiative
```

An **initiative** is the unit that actually takes time. Milestones and increments are grouping
containers that organize initiatives and label the timeline.

**2. You size initiatives with t-shirt sizes, not dates.**

Each project defines its own scale of **size labels** — for example `XS, S, M, L, XL`. You tag each
initiative with a size rather than typing a duration.

**3. A sizing key converts sizes into time.**

A **sizing key** is a reusable lookup table: for each size, how long does each phase take? For
example "an `M` takes 6 days of Discovery, 2 months of Implementation, 2 weeks of Testing."

The payoff is that sizing keys live outside any project. You can build an optimistic key and a
pessimistic key, then switch between them on the timeline and watch the schedule move — without
re-estimating anything.

---

## Your first 15 minutes

If you just ran `npm run setup`, you have a project called **Sample Program** with data already in
it. Poking at that is the fastest way to learn. When you are ready to start real work:

1. **Create a project.** On the **Projects** page, type a name and click **Create**.
2. **Define your size labels.** Click **Settings** next to your project, find **Size labels**, and
   add your scale smallest-to-largest — for example `S`, then `M`, then `L`. Order matters.
3. **Set a start date.** Still in Settings, pick a **Start date**. Without one you get a relative
   timeline ("Week 1", "Week 2") instead of real calendar dates.
4. **Build the outline.** Go back to the project and click **+ Add milestone**, then **+ Add
   increment** inside it, then **+ Add initiative** inside that. Rename each by clicking its title
   and typing.
5. **Size your initiatives.** Use the **Policy** and **Impl.** dropdowns on each initiative row.
6. **Create a sizing key.** Go to **Sizing Keys**, create one, add the same size labels, add phases
   (such as Discovery / Implementation / Testing), then fill in the duration grid.
7. **View the timeline.** Return to your project, click **Timeline**, and pick your sizing key.

Step 6 is the fiddly one. There is a shortcut: from Settings or the Timeline, when no compatible key
exists, click **Create one now** and the new key arrives pre-loaded with your project's size labels.

---

## Getting around

Three links sit in the top bar:

- **Projects** — the list of all projects; your starting point
- **Sizing Keys** — the reusable estimate templates, shared across all projects
- **Combined Timeline** — a scratch view for comparing multiple projects side by side

Each project has three pages, reachable from the project list or the links in the project's top-right
corner:

- **the project page** (click the project name) — the work breakdown where you add and organize work
- **Settings** — size labels, start date, sprint cadence, key dates, default sizing key
- **Timeline** — the generated Gantt chart

---

## Building your roadmap

Open a project to see its milestones, each containing increments, each containing initiatives.

### Adding things

- **+ Add milestone** at the bottom of the project page
- **+ Add increment** in a milestone's top-right corner
- **+ Add initiative** at the bottom of an increment

New items are created immediately with placeholder names like "New milestone."

### Renaming things

Click any name and type. **The change saves when you click away** from the field — there is no Save
button. This applies to milestone, increment, and initiative names, initiative notes, and the project
name and description.

### Reordering

Drag the dotted handle (`⠿`) to reorder:

- **Increments** reorder within their milestone
- **Initiatives** reorder within their increment

Order is what the timeline uses, so this directly controls sequence.

One limitation worth knowing: **you cannot drag an initiative into a different increment.** To move
one, delete it and recreate it in the target increment.

### Deleting

**Delete milestone**, **Delete increment**, and the **✕** on an initiative remove things
*immediately, with no confirmation prompt*. Deleting a container deletes everything inside it.
Deleting a project does ask for confirmation.

---

## Sizing initiatives

Each initiative row offers two mutually exclusive ways to express duration. The link on the right
(**Use estimate** / **Use sizing**) switches between them.

### Option 1: sizing (the default)

Two dropdowns, then a computed result:

- **Policy** — size of the policy work
- **Impl.** — size of the implementation work
- **Final** — computed, not editable

**Final is the larger of the two**, judged by your size label order. Policy `S` with
implementation `L` yields `L`. Set only one and that one wins. Set neither and the initiative reads
**Unsized** in amber.

The reasoning is that policy and implementation work typically overlap rather than queue up, so the
bigger of the two drives the schedule.

### Option 2: a direct time estimate

Click **Use estimate** and enter a number of weeks. This bypasses sizes and sizing keys entirely —
useful for work you already know the duration of, or work that does not fit the scale.

Switching modes clears the other mode's values, so flipping back and forth loses what you had.

---

## Sizing keys

Sizing keys are managed from the **Sizing Keys** tab and shared across every project.

Open one and you get four sections:

**Size labels** — the sizes this key knows how to price. These are separate from any project's
labels; they are matched by their text (`M` matches `M`).

**Phases** — the stages every initiative passes through, in order. Each phase has a unit of **day**,
**week**, or **month**. Reorder with the `↑` / `↓` arrows; phase order is the order segments appear
on the timeline.

**Durations** — the grid where the actual estimating happens: one row per phase, one column per size.
Enter how long that phase takes for that size, in the phase's own unit. Blank cells count as zero and
will flag the initiative on the timeline.

**Timeline preview** — one bar per size showing how the phases stack up. Always relative, since a key
has no start date of its own.

### The compatibility rule

This is the single most common source of confusion:

> A sizing key can only be used by a project if the key has **every size label the project uses**.

The key may have extras — that is fine. But if your project uses `XL` and the key has no `XL`, the
key is unusable for that project. In dropdowns it appears greyed out and annotated
`(missing: XL)`.

Two ways out:

- Add the missing labels to the key and fill in their durations
- Click **Create one now** to generate a fresh key already carrying your project's labels

**Duplicate** on the Sizing Keys page copies a key with all its phases and durations — the easiest way
to build an "optimistic vs. pessimistic" pair.

---

## Project settings

### Name and description
Save when you click away.

### Start date
Optional, and it changes the timeline's character:

- **With a start date** — real calendar dates; month, quarter, and year rulers become available; key
  dates appear
- **Without one** — a relative timeline ("Week 1"), no calendar rulers, no key dates

### Sprint cadence
Optional. Two fields that must be **set together or left blank together**:

- **Length (business days)** — for example 10 for a two-week sprint
- **Starts on** — the weekday sprints begin

Setting these unlocks a **Sprint** ruler row on the timeline, anchored to the project start date.
Sprints run however many calendar days it takes to cover that many business days. Filling in one
field but not the other produces the error "Set both a sprint length and a start weekday, or clear
both." Use **Clear** to remove both.

### Size labels
Your project's scale. Order defines what "bigger" means, which is what makes the Final size
calculation work.

- `←` and `→` move a label smaller or larger
- Click a code to rename it
- `✕` deletes it

You **cannot delete a size label that initiatives are using** — the tool names the offending
initiatives so you can re-tag them first. Renaming a label can break compatibility with a sizing key,
since matching is by text.

### Default sizing key
Pre-selects a key when you open the Timeline. Incompatible keys are disabled here, annotated with
what they are missing.

### Key dates
Named moments — "Target launch," "Legislative deadline" — drawn as labelled vertical lines on the
timeline. Add a label and a date, then **+ Add date**.

These only appear on the timeline **once the project has a start date**, since without one there is
no calendar to place them against.

### Timeline header scales
Checkboxes controlling which ruler rows appear above the chart. Options appear conditionally: month,
quarter, and year require a start date; sprint requires sprint cadence. This setting is saved on the
project.

---

## Reading the timeline

Open a project and click **Timeline**. Pick a **Sizing key** and the chart appears.

### The controls

**Sizing key** — which estimates to apply. Switching is instant and recomputes in your browser
without contacting the server, so comparing keys is fast.

**Start date (preview only, not saved)** — exactly what it says. Try a different start here and the
chart moves, but nothing is written to the project. To change the real start date, use Settings.

**Header scales** — same checkboxes as Settings, and changes here *are* saved to the project.

**Zoom** (`−` `+` `Reset`, above the chart on the right) — widens or narrows the time axis. Useful in
both directions: zoom in to read a dense schedule, zoom out to fit a long program on screen. Zoom is
not saved between visits.

### The chart

Initiatives are grouped under grey milestone header rows, in the order you arranged them. Each
initiative gets a bar split into coloured segments, one per phase, with a legend along the bottom.
Hover a segment for its phase name and duration.

**Everything runs strictly back to back.** No two initiatives overlap; each starts when the previous
one ends. The tool models a single sequential stream of work, not parallel teams, so a "timeline"
here is really "how long this ordered pile of work takes."

### Badges to watch for

- **`unsized`** (amber) — no size and no estimate. Contributes **zero** time. The schedule continues
  past it as if it were not there, so a forgotten initiative quietly shortens your program.
- **`missing data`** (red) — the initiative has a size, but the selected sizing key has no duration
  for it. That phase contributes zero. Usually means a blank cell in the duration grid.

Neither badge blocks the chart from rendering, so it is worth scanning for them before sharing a
roadmap.

### About month-long phases

Phases measured in months follow the real calendar when the project has a start date — February is
shorter than January, and the tool accounts for that rather than using an average. A consequence is
that month boundaries can land mid-week and bars may not line up with week gridlines. That is
correct, not a glitch. Without a start date there is no calendar to consult, so an average month
(about 30.4 days) stands in.

---

## Comparing scenarios

The **Combined Timeline** tab puts several bodies of work on one shared axis.

Click **+ Add project or milestone**, then for each row choose:

- **Project** — which project
- **Sizing key** — each row gets its own, so you can show the same project under two different sets of
  estimates
- **Scope** — the whole project, or a single milestone

Add as many rows as you like, including the same project twice with different keys.

Two things to keep in mind:

- **Nothing here is saved.** Your rows disappear when you navigate away. It is a scratchpad.
- Each row uses its project's **saved** start date. The preview override on the project Timeline page
  does not apply here.

---

## Things that surprise people

**Text fields save when you click away.** Type a new name, then click elsewhere. Navigating away
immediately after typing can lose the edit. Dropdowns and checkboxes save the moment you change them.

**Milestone, increment, and initiative deletion has no confirmation and no undo.** Deleting a
milestone takes its increments and initiatives with it. Only project deletion asks first.

**The Timeline's start date is a preview.** It is labelled, but easy to miss. Real changes go in
Settings.

**Unsized initiatives take zero time.** They do not block the chart or shift anything — they just
silently contribute nothing. Scan for amber `unsized` badges before trusting a total.

**Sizing keys match projects by label text.** Renaming a project's `L` to `Large` breaks
compatibility with every key that still says `L`.

**Initiatives cannot be dragged between increments.** Delete and recreate instead.

**There is one database per copy of the app.** Two checkouts on your machine have entirely separate
data. Nothing is shared with teammates, and nothing is backed up.

---

## Common questions

**Why is my sizing key greyed out?**
It lacks at least one size label your project uses. The dropdown shows which ones after "missing:".
Add them to the key, or click **Create one now** for a pre-populated key.

**Why can't I see the month or quarter rulers?**
They require a project start date. Set one in Settings.

**Why aren't my key dates showing?**
Same reason — key dates are absolute dates and need a start date to anchor against.

**Why is the Sprint ruler missing?**
Sprint cadence needs *both* a length and a start weekday, and the project needs a start date.

**Why did my timeline get shorter after I added work?**
The new initiatives are probably unsized, contributing zero. Look for amber `unsized` badges.

**How do I model two teams working in parallel?**
You cannot within one project — scheduling is strictly sequential. The nearest approach is separate
projects (or separate milestones) shown together on the Combined Timeline.

**How do I share a roadmap?**
There is no export yet. Screenshot the timeline, or have colleagues run their own copy. Note that
their data will be their own; the database does not travel with the code.

**Can I get a deleted item back?**
No. There is no undo and no version history. Your only recovery is a backup of
`apps/server/prisma/dev.db` if you made one.

**How do I start over with clean sample data?**
Run `npm run db:reset`. This erases everything in that copy of the app and reloads the sample
project.
