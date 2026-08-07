# Program Roadmap Generator

A tool for building and visualizing program roadmaps. You break a program down into
**projects → milestones → increments → initiatives**, apply reusable **sizing keys** (for example
S/M/L mapped to a number of weeks per phase), and the tool generates a Gantt-style timeline.

It runs entirely on your own laptop. Your data is stored in a local file on your machine and is
never uploaded anywhere.

## What you can do with it

- Organize a program into projects, milestones, increments, and initiatives
- Drag and drop to reorder work
- Define reusable **sizing keys** so estimates stay consistent across projects
- Size initiatives separately for policy work and implementation work
- Generate a visual timeline (Gantt chart) with configurable units
- Set a program start date and sprint cadence
- Add named date markers (such as a target launch) as vertical lines on the timeline
- Zoom in and out to change how much of the timeline is visible at once
- View a combined timeline across multiple projects

---

# Quickstart (for program and project managers)

**No coding required.** You will copy and paste a few commands into an app called Terminal.
Total time is about 10 minutes the first time, and about 10 seconds every time after that.

## Before you start

You need access to this private repository. If you cannot open
https://github.com/navapbc/program-roadmap-generator in your browser, sign up for a GitHub account
and submit an Eden ticket to get added to the NavaPBC GitHub organization first. Everything below
will fail without that access.

## Step 1: Open Terminal

On your Mac, press `Cmd + Space`, type `Terminal`, and press Enter. A window with a text prompt
will open.This is where you will paste the commands below.

For each step: copy the command, paste it into Terminal, press Enter, and **wait for it to finish**
before moving to the next one. A step is finished when you see the prompt (a line ending in `%` or `$`)
appear again.

## Step 2: Install the tools you need

This installs Homebrew (a software installer for Mac), then Node.js (which runs the app) and the
GitHub command line tool (which downloads the code).

Install Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

You will be asked for your Mac password. As you type it, **nothing will appear on screen** — that is
normal. Type it and press Enter. At the end, Homebrew may print two extra commands starting with
`echo` and ask you to run them. If it does, copy and run them.

Then install Node.js and the GitHub tool:

```bash
brew install node@22 gh
```

Verify it worked:

```bash
node --version
```

You should see a version number starting with `v22` (for example `v22.23.2`). If you see
"command not found", close Terminal, open it again, and re-run the command.

## Step 3: Sign in to GitHub

```bash
gh auth login
```

Answer the prompts with the arrow keys and Enter:

- **What account do you want to log into?** → `GitHub.com`
- **What is your preferred protocol?** → `HTTPS`
- **Authenticate Git with your GitHub credentials?** → `Yes`
- **How would you like to authenticate?** → `Login with a web browser`

Terminal will show a one-time code such as `A1B2-C3D4`. **Copy that code**, press Enter to open your
browser, paste the code, and approve access. When your browser says you are done, return to Terminal
and wait for `✓ Logged in as ...`.

Then run this once so downloads work:

```bash
gh auth setup-git
```

## Step 4: Download the app

```bash
cd ~ && gh repo clone navapbc/program-roadmap-generator && cd program-roadmap-generator
```

This puts the app in a folder called `program-roadmap-generator` in your home directory.

## Step 5: Set it up

```bash
npm run setup
```

This installs everything, creates your local database, and loads sample data. It takes a few
minutes and prints a lot of text — that is expected. You are done when you see `Seed complete.`

You only ever need to run this once.

## Step 6: Start the app

```bash
npm run dev
```

Wait until you see a line like:

```
[web]   ➜  Local:   http://localhost:5173/
```

Now open **http://localhost:5173** in your browser. You should see a project list containing a
project called **Sample Program**.

That's it — you're running the tool.

## Using it day to day

**To stop the app:** click on the Terminal window and press `Ctrl + C`. Closing the browser tab does
not stop it. It is safe to leave it running.

**To start it again later**, open Terminal and run these two commands:

```bash
cd ~/program-roadmap-generator
npm run dev
```

You do **not** need to repeat steps 2 through 5.

**To get the latest version** of the app after someone makes updates:

```bash
cd ~/program-roadmap-generator
git pull
npm run setup
```

## About your data

Your projects are saved in a single file on your laptop at
`apps/server/prisma/dev.db`. This means:

- Your data is private and stays on your machine
- It is **not** backed up, and it is **not** shared with teammates
- If you delete the app folder, your projects are gone

You can back up the project directory, including the database file, with Google Drive Sync if you choose.

The sample data is placeholder content, so feel free to delete the `Sample Program` project once
you have created your own.

To wipe everything and start over with fresh sample data:

```bash
npm run db:reset
```

---

# Troubleshooting

**"command not found: brew" (or `node`, or `gh`)**
Close Terminal completely and open a new window, then try again. Installers often only apply to
newly opened windows.

**"address already in use" or `EADDRINUSE`**
The app is already running in another Terminal window. Switch to that window and press `Ctrl + C`,
or close all Terminal windows and start again. This matters: the web page may still load while the
data service is not actually running, which makes the app look broken.

**The page loads but is blank, or shows errors about loading data**
The web page and the data service are two separate pieces, and both must be running. Look at the
`npm run dev` output — you should see both `[server]` and `[web]` lines with no errors. If only
`[web]` started successfully, see the "address already in use" fix above.

**Browser says "This site can't be reached"**
The app isn't running. Run `npm run dev` and wait for the `Local: http://localhost:5173/` line
before opening the browser.

**"@prisma/client did not initialize yet"**
Run `npm run setup` again from the `program-roadmap-generator` folder.

**Terminal opened somewhere unexpected / commands can't find files**
Run `cd ~/program-roadmap-generator` first. Every command in this guide assumes you are in that
folder.

**"Authentication failed" when downloading**
Run `gh auth status` to confirm you are signed in, and `gh auth setup-git` to link Git to your
GitHub account. If it still fails, confirm you have access to the NavaPBC organization.

**Still stuck?** Copy the last 20 lines of red or error text from Terminal and send them to the repo
owner. The exact error text is the useful part.

---

# For developers

## Architecture

npm workspaces monorepo:

- `apps/server` — Fastify + tRPC API, Prisma ORM over SQLite. Runs on port **4000**.
- `apps/web` — React 18 + Vite + Tailwind + TanStack Query. Runs on port **5173** and proxies
  `/trpc` to port 4000 (see `apps/web/vite.config.ts`).
- `packages/shared` — types, Zod schemas, and sizing/timeline logic shared by both, tested with Vitest.

Ordering of milestones, increments, and initiatives uses fractional indexing (`orderKey`) so drag
and drop reordering only writes a single row.

## Data model

`Project → Milestone → Increment → Initiative`, with `Project.sizeLabels` defining the size codes
available to initiatives. Each initiative can carry both a policy size and an implementation size.

`SizingKey` is a reusable estimation template: `SizingKeyLabel` defines the codes (S/M/L), and
`SizingPhase` + `SizingDuration` map each code to a duration per phase. A project references one
via `defaultSizingKeyId`.

## Scripts

Run from the repo root:

- `npm run setup` — install, create `.env`, migrate, generate the Prisma client, and seed
- `npm run dev` — run server and web together
- `npm run build` — build all workspaces
- `npm test` — run the shared package's Vitest suite
- `npm run seed` — reseed placeholder data
- `npm run db:reset` — drop the database, re-migrate, and reseed

In `apps/server`:

- `npm run migrate` — create a new migration (`prisma migrate dev`)
- `npm run studio` — browse the database in Prisma Studio

## Environment

`apps/server/.env` is created from `.env.example` by `npm run setup`:

- `DATABASE_URL` — SQLite path, relative to `apps/server/prisma/`
- `PORT` — API port, defaults to `4000`

Note that the server has no `dotenv` dependency. These variables reach the process because Prisma
Client loads `.env` when it initializes. Changing `PORT` also requires updating the proxy target in
`apps/web/vite.config.ts`, which is hardcoded to `http://localhost:4000`.

`.env` files and `*.db` files are gitignored and must never be committed.

## Adding a migration

```bash
cd apps/server
npx prisma migrate dev --name your_change_name
```

Commit the generated folder under `apps/server/prisma/migrations/`.
