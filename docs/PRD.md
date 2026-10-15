---
title: PRD - Astra
type: prd
author: Project001
date: 2026-10-14
updated: 2026-10-15
status: Draft
priority: P0
tags:
  - prd
  - astra
  - desktop
  - visual-web-designer
  - local-first
  - electron
aliases:
  - PRD-Astra
  - Astra
---

# PRD - Astra

> [!abstract] Astra - Design visually. Own your code.
>
> Astra is a local-first desktop visual web designer for Windows. Users open real
> website projects, edit them through a live canvas, an element inspector, and a
> source editor, and save changes directly to standard HTML, CSS, and JavaScript
> files. There is no account, no mandatory cloud, and no proprietary output format.
> Source code remains readable, portable, and version-controllable.

> [!warning] Document Status - Specification Only (No Application Logic Implemented)
>
> This document is a **specification only**. No application logic has been built,
> tested, or shipped. The source repository (`D:\code-web\Astra`) contains, at most, a
> project scaffold (build tooling and dependencies) and no implemented features. Every
> requirement below describes intended behavior, not a delivered feature. All performance
> figures, effort estimates, and success-metric targets are **provisional** unless
> explicitly marked as measured.
>
> No "supplied Astra visual reference" image was found in the workspace. The UI/UX
> section therefore specifies the design direction in prose (Section 9). If a
> reference image is later supplied, this document must be reconciled with it, and
> the reference must be treated as a design intent, not proof of implemented behavior.

---

## Document Control

| Field | Value |
|---|---|
| Product | Astra |
| Category | Desktop Visual Web Designer |
| Tagline | Design visually. Own your code. |
| Primary platform | Windows 10/11 (x64) |
| Secondary (later) | macOS, Linux |
| Document version | 0.1 (Draft for review) |
| Status | Specification only - implementation not started |
| Owner | Project001 |
| Reviewers | Product, Architecture, UX, Security, QA (to be assigned) |
| Related docs | `PRD-Visual-Web-Builder (Astra).md`, `PRD-Local-Visual-Web-Builder.md` (superseded adjacent concepts; this document defines the Electron-based sibling product) |

### How to read requirement IDs

| Prefix | Meaning |
|---|---|
| `FR-###` | Functional requirement |
| `NFR-###` | Non-functional requirement |
| `SEC-###` | Security / privacy requirement |
| `UX-###` | UI/UX requirement |
| `TEST-###` | Test case |
| `RISK-###` | Registered risk |
| `OQ-###` | Open question |
| `ASM-###` | Assumption |
| `AC-###` | MVP acceptance criterion |
| `DoD-###` | Definition-of-done item |

Priority scale: **P0** = required for MVP; **P1** = required before general availability, may ship after MVP; **P2** = desirable, post-GA.

---

## 1. Executive Summary

Astra is a Windows desktop application that lets a person design a website visually
while editing the website's **actual source code**. It occupies a gap that current
tools leave open:

- Code editors (VS Code, Sublime, JetBrains) are powerful and produce real code, but
  they offer almost no visual manipulation of HTML and CSS.
- Visual "no-code" website builders offer drag-and-drop design but frequently store
  projects in proprietary formats, depend on accounts and cloud services, and either
  hide the source or emit markup that is hard for humans to maintain.
- Design tools (Figma and similar) produce designs that are disconnected from
  production code; developers re-implement them by hand.

Astra's thesis is that **visual editing should operate directly on standard web
technologies and should produce portable, maintainable source code**. The canvas
renders the real website. Edits made visually are translated into minimal, surgical
changes to HTML/CSS/JS files. Edits made in the built-in code editor are reflected
back in the canvas. The project on disk stays a normal website: it opens in any
browser and any code editor without Astra.

The product is local-first by construction: no account, no telemetry by default, and
all core features work offline. Website previews are sandboxed so that untrusted
project code cannot reach privileged desktop APIs or the filesystem.

Astra is implemented as an **Electron** desktop application: a Node.js main process
hosting controlled project services, a React + TypeScript renderer for the UI, and a
narrow `contextBridge` between them. Electron is an implementation choice, not Astra's
product differentiator (Section 10; ADR-001 in Section 10.7).

The central engineering risk is **synchronization**: keeping a visual document model
and real source files consistent without corrupting formatting, comments, or unsupported
syntax, and without falling into infinite update loops or conflicting external edits.
Sections 7G, 11, and 13 treat this as the primary thing to prototype and prove before
investing in UI breadth.

This PRD defines the vision, personas, requirements with testable acceptance criteria,
a modular architecture, an MVP, a phased roadmap, a security model, a testing strategy,
success metrics, risks, and open questions. All of it is planning material; none of it
is implemented.

---

## 2. Product Vision

**Vision.** Anyone should be able to open an existing website, understand it visually,
improve it visually, and leave behind code that is as clean (or cleaner) than what
they started with - without surrendering ownership of their files, their data, or
their workflow.

**Positioning statement.** For web developers and designers who want the speed of
visual editing without losing control of their source code, Astra is a local-first
desktop web designer that edits real HTML, CSS, and JavaScript in place. Unlike no-code
builders, Astra produces standard, portable, Git-friendly code with no proprietary
runtime and no mandatory cloud service.

**Guiding principles.**

1. **Sovereignty** - the user's files and machine are the source of truth. No account,
   no cloud, no telemetry by default, offline-capable core.
2. **Composability** - modular architecture, reusable components, standard web
   technologies, and minimal, replaceable dependencies.
3. **Security** - imported projects are untrusted; previews are isolated from desktop
   privileges; filesystem access follows least privilege; no silent destructive change.
4. **Code ownership** - output is readable and editable; no proprietary format; existing
   structure and unsupported syntax are preserved; changes yield understandable Git diffs.

**The north-star interaction.** Open a real project, click an element, change it, save,
and have the change appear as a small, sensible diff in the real file - then open that
file in any browser and see it work.

---

## 3. Problem Statement

Astra targets a specific gap between visual design tooling and code ownership. The
following are stated as **hypotheses to validate** (see Section 18, `OQ-001`..`OQ-004`),
not as proven facts. Evidence status is explicit.

### 3.1 Primary problem (hypothesis, partially supported by adjacent-tool patterns)

> Visually editing an **existing** HTML/CSS website - while preserving its real source
> structure - is poorly supported. Tools either edit visually but hide/abstract the
> code, or edit code but do not let the user manipulate the page visually.

Supporting observations (to be validated with user research, not yet conducted):

- Visual builders commonly require the project to be authored *inside* the tool and
  stored in the tool's own format (`OQ-001`).
- Design tools export static artifacts or framework-specific code rather than editing
  an existing hand-written site (`OQ-002`).
- A website project on disk is "just files"; most visual tooling does not treat those
  files as the editable truth (`OQ-003`).

### 3.2 Secondary problems (unvalidated)

- **Design/code drift.** Design decisions and the codebase diverge because there is no
  single artifact both can edit (`OQ-002`).
- **Prototyping friction.** Developers rewrite markup for small visual experiments
  because there is no fast visual loop over real files (`OQ-004`).
- **Lock-in and infrastructure dependence.** Some desktop builders require login, cloud
  storage, or hosted infrastructure for core behavior (`OQ-001`).
- **Comprehension cost.** Visual learners struggle to mentally map HTML/CSS to rendered
  output; a live, inspectable canvas reduces that cost (`OQ-004`).

### 3.3 Problems explicitly OUT of scope

- Building a general-purpose code editor or IDE replacement.
- Hosting, publishing, or deploying websites.
- Real-time multi-user editing or team collaboration.
- Replacing Figma for high-fidelity static design and design handoff.
- Editing arbitrary dynamic applications (SPA runtimes, server-rendered frameworks) with
  full visual fidelity.
- Managing a CMS, database, or backend for the user's site.

### 3.4 Assumption vs. validated finding (summary)

| Claim | Status | How to validate |
|---|---|---|
| Visual editing of existing sites is underserved | Assumption | 10-15 user interviews; competitor teardown |
| Users value source ownership enough to switch tools | Assumption | Willingness-to-use study; retention after MVP |
| Surgical source patching preserves formatting well enough | Unproven engineering hypothesis | Phase 0 prototype (see Section 13) |
| Local-first/offline is a differentiator for this segment | Assumption | Persona interviews; telemetry-free survey |

---

## 4. Target Users and Personas

Astra targets technically curious users who care about code ownership. Personas are
**hypotheses** used to prioritize requirements; they are not yet validated by research.

### 4.1 Persona A - Rina, "The Visual Learner" (beginner web developer)

| Dimension | Detail |
|---|---|
| Role | Career-switching junior dev / bootcamp student |
| Tech skill | Low-to-moderate (understands HTML tags, learning CSS) |
| Goals | Build a personal site; understand how CSS produces visible results; avoid breaking things |
| Main problems | CSS concepts (box model, flex/grid, specificity) are hard to intuit from text alone; fear of irreversible mistakes |
| Existing workflow | VS Code + browser, constant reload, tutorial copy-paste |
| Expected benefits | See cause and effect instantly; safe experimentation with undo; learn by inspecting real code |
| Why Astra over alternatives | Visual feedback over her *own* files; no account; she can still open the code in VS Code |
| Key requirements | FR-B, FR-C, FR-E, FR-F, FR-I (undo) |

### 4.2 Persona B - Bagas, "The Speed Pro" (developer / freelancer)

| Dimension | Detail |
|---|---|
| Role | Freelance front-end developer |
| Tech skill | High |
| Goals | Prototype marketing pages and tweak client sites quickly; keep clean Git diffs |
| Main problems | Hand-editing repetitive markup is slow; wants visual layout experiments without rewriting |
| Existing workflow | VS Code, browser devtools, occasional no-code builder he distrusts for client work |
| Expected benefits | Fast visual iteration on real files; diffs stay reviewable; no export/rebuild step |
| Why Astra over alternatives | Edits real files in place; portable output; no framework lock-in; offline on client sites |
| Key requirements | FR-D, FR-E, FR-G, FR-H, FR-J |

### 4.3 Persona C - Sinta, "The Ownership Designer" (designer who ships code)

| Dimension | Detail |
|---|---|
| Role | Product/UI designer who writes HTML/CSS |
| Tech skill | Moderate (semantic HTML, modern CSS, design tokens) |
| Goals | Control the exact markup and CSS that ships; keep a design system consistent |
| Main problems | Handoff tools output code she must rewrite; visual tools fight her existing structure |
| Existing workflow | Figma -> hand-written HTML/CSS, sometimes Tailwind |
| Expected benefits | Design directly on production code; reuse tokens/components; advisory accessibility help |
| Why Astra over alternatives | Code ownership + visual editing together; portable component/token storage |
| Key requirements | FR-E, FR-I, FR-H, FR-J (accessibility advisory) |

### 4.4 Persona D - Andre, "The Privacy-Conscious Localist"

| Dimension | Detail |
|---|---|
| Role | Senior engineer / consultant in a security-sensitive context |
| Tech skill | Very high |
| Goals | Work fully offline; no telemetry; no account; audit what the app can access |
| Main problems | Suspicious of cloud builders; wants least-privilege filesystem access; needs preview isolation |
| Existing workflow | Local editor + browser; vetting dependencies |
| Expected benefits | Verifiable offline operation; scoped filesystem permissions; sandboxed previews |
| Why Astra over alternatives | Local-first, no telemetry by default, preview isolation, auditable dependency set |
| Key requirements | FR-K, SEC-*, NFR offline, preview sandbox |

### 4.5 Persona E (secondary) - "The Inheritor" (maintainer of legacy sites)

| Dimension | Detail |
|---|---|
| Role | Developer asked to update an old hand-written/WordPress-exported site |
| Tech skill | Moderate-to-high |
| Goals | Understand an unfamiliar, messy HTML/CSS codebase and make targeted visual changes |
| Main problems | Fear of breaking unknown markup; spaghetti CSS |
| Existing workflow | Devtools + careful manual edits |
| Expected benefits | A visual map of the page; surgical edits; preservation of unsupported/legacy syntax |
| Why Astra over alternatives | Reads arbitrary existing HTML/CSS without demanding a rewrite; preserves what it does not understand |
| Key requirements | FR-B, FR-C, FR-G (preservation), FR-J |

### 4.6 Persona prioritization

For MVP, optimize for **Persona B (developer/freelancer)** and **Persona E (inheritor)**,
because they exercise the differentiator hardest (editing *existing real* projects).
Persona A informs onboarding and undo safety; Persona C informs later component/token
work; Persona D constrains the security model from day one.

---

## 5. Goals and Non-Goals

### 5.1 Product goals (overall)

| ID | Goal |
|---|---|
| G-01 | Open an existing local website project folder and display it faithfully. |
| G-02 | Render the real website in a live visual canvas. |
| G-03 | Select and inspect any rendered HTML element. |
| G-04 | Insert and rearrange elements via drag-and-drop. |
| G-05 | Edit common CSS properties visually. |
| G-06 | Synchronize supported visual changes into source code. |
| G-07 | Synchronize supported source-editor changes back into the canvas. |
| G-08 | Save changes to the actual project files safely and atomically. |
| G-09 | Preview desktop, tablet, and mobile layouts. |
| G-10 | Operate with no mandatory cloud service, account, or network connection. |

### 5.2 Non-goals for the MVP, with rationale

| Non-goal | Why excluded from MVP |
|---|---|
| Cloud synchronization | Adds accounts, servers, conflict/merge complexity, and a trust surface; violates local-first default. Validate demand first. |
| User accounts | Not needed for a local single-user tool; adds auth, storage, and privacy liabilities. |
| Real-time collaboration | Requires a backend and a CRDT/OT model; orthogonal to the core sync-with-files risk we must solve first. |
| Hosted website publishing | Deployment is a separate product concern (FTP, Git, CDNs); Astra edits code, it does not host. |
| Figma replacement | Astra targets production code, not static high-fidelity design tooling; competing with Figma is out of scope. |
| Full support for every JS framework | Framework-specific semantics (JSX, SFCs, template DSLs) multiply sync complexity; start from plain web technologies. |
| A proprietary rendering runtime | Contradicts code-ownership and portability; output must run in an ordinary browser. |
| Mandatory AI features | AI introduces non-determinism, cost, privacy questions, and review burden; keep it optional and additive. |
| Full visual editing of arbitrary dynamic applications | DOM produced at runtime is not reliably round-trippable to source; editing it risks corrupting app logic. |

---

## 6. User Stories and User Journeys

### 6.1 User journeys

**Journey 1 - First open of an existing project (Persona B/E).**

```text
Launch Astra
  -> Welcome / no project open (empty state: "Open a folder to begin")
  -> "Open Project" -> native folder picker
  -> Astra scans folder, detects entry HTML (index.html), links CSS/JS
  -> Canvas renders the site
  -> Files appear in Project Explorer
  -> User clicks an element, inspector shows its HTML + styles
```

**Journey 2 - Visual edit to code (Persona A/B).**

```text
Select element
  -> Edit text / change a CSS value in the Inspector
  -> Internal document model updates (provisional preview)
  -> Sync engine computes a minimal source patch
  -> Source editor tab shows the updated source (highlighted diff)
  -> Save (Ctrl+S) or autosave debounce
  -> Atomic write to disk
  -> "Saved" indicator; Git working tree shows a small diff
```

**Journey 3 - Code edit to canvas (Persona B).**

```text
Open styles.css in the Code Editor tab
  -> Type a new rule
  -> Debounced parse -> model updates
  -> Canvas re-renders affected subtree
  -> User sees the change without leaving Astra
```

**Journey 4 - External change while Astra is open (Persona B/D).**

```text
User edits index.html in VS Code and saves
  -> File watcher detects change (mtime + hash differ)
  -> If Astra has no unsaved changes to that file: reload silently, log activity
  -> If Astra has unsaved changes: conflict prompt (Keep mine / Take theirs / Compare)
  -> No file is overwritten without an explicit decision
```

**Journey 5 - Responsive tweak (Persona C).**

```text
Switch viewport preset to Mobile
  -> Canvas resizes to a mobile frame; active breakpoint is indicated
  -> Edit a property while Mobile is active
  -> Change is written into the matching media query (existing or new)
  -> Save
```

**Journey 6 - Inherited messy project (Persona E).**

```text
Open a legacy folder
  -> Astra parses even malformed HTML (best-effort, non-destructive)
  -> Unsupported elements are shown but marked "not fully editable"
  -> User makes a targeted text/style change
  -> Only the touched range changes on disk; everything else byte-identical
```

### 6.2 User stories (selection; full coverage in Section 7)

Format: `As a <persona>, I want <capability>, so that <benefit>.`

| ID | Story |
|---|---|
| US-001 | As a developer, I want to open an existing project folder, so that I can work on my real code. |
| US-002 | As a developer, I want to see my site rendered, so that I can judge the result without switching apps. |
| US-003 | As a developer, I want to click an element and see its HTML and CSS, so that I can understand and change it. |
| US-004 | As a developer, I want to drag a component into the page, so that I can build layout quickly. |
| US-005 | As a beginner, I want undo/redo for visual edits, so that I can experiment safely. |
| US-006 | As a developer, I want my edits saved into the real files, so that Git diffs stay meaningful. |
| US-007 | As a privacy-conscious user, I want the app to work offline with no account, so that my work stays private. |
| US-008 | As a designer, I want to preview mobile/tablet/desktop, so that I can make responsive decisions visually. |
| US-009 | As a maintainer, I want unsupported/legacy markup preserved, so that Astra never silently destroys code it does not understand. |
| US-010 | As a designer, I want reusable components and tokens, so that my design stays consistent. |
| US-011 | As any user, I want accessibility warnings, so that I can fix basic issues without automation rewriting my code. |

---

## 7. Functional Requirements

Format per requirement: **ID - priority** - description; **Story**; **Acceptance criteria**;
**Dependencies**; **Known limitations**.

### A. Desktop Application

#### FR-A01 - Native application window (P0)
Astra runs as a native Windows desktop window hosted by Electron, not a browser tab.
- **Story:** As a user, I want a real desktop app, so that it integrates with my OS.
- **Acceptance:** Given the installed app, when launched, then a single application
  window appears with a native title bar, resizes smoothly, and has OS min/max/close
  controls; no browser chrome is present.
- **Dependencies:** Electron shell (Section 10), build pipeline.
- **Limitations:** Windows-first; macOS/Linux later.

#### FR-A02 - Application menu and window controls (P0)
A native/application menu exposing File, Edit, View, and Help actions.
- **Story:** As a user, I want menu access to core actions.
- **Acceptance:** Given the app is focused, when I open the menu, then File contains
  New/Open/Close/Save/Save All/Settings/Exit; Edit contains Undo/Redo/Find; View
  contains viewport presets, zoom, and panel toggles; each item triggers the
  corresponding action or is disabled when unavailable.
- **Dependencies:** FR-A01, command bus.
- **Limitations:** Menu layout may differ on non-Windows later.

#### FR-A03 - Project open and close (P0)
Open a project by selecting a local folder; close the current project.
- **Story:** As a user, I want to open and close projects cleanly.
- **Acceptance:** Given the welcome screen, when I choose "Open Project" and select a
  folder containing at least one `.html` file, then the project loads, the folder name
  becomes the project title, and the explorer lists its files. Given an open project,
  when I choose "Close Project", then I return to the welcome screen and no file handles
  remain open.
- **Dependencies:** Filesystem adapter, project manager.
- **Limitations:** One project open at a time in MVP (see `OQ-007`).

#### FR-A04 - Unsaved-change warnings (P0)
Warn before discarding unsaved changes.
- **Story:** As a user, I want protection from accidental data loss.
- **Acceptance:** Given a dirty document, when I close the project, close the window, or
  open another project, then a modal offers Save / Discard / Cancel; choosing Cancel
  aborts the action; choosing Discard does not write; choosing Save writes atomically
  before proceeding.
- **Dependencies:** FR-G (dirty tracking), FR-A03.
- **Limitations:** If the app is force-killed, autosave/recovery (FR-A04b) is the only
  safeguard.

#### FR-A04b - Crash recovery (P1)
Recover unsaved work after an abnormal exit.
- **Acceptance:** Given a session with unsaved changes and a journal of pending writes,
  when the app starts after a crash, then Astra offers to restore the pending changes
  from `.astra/recovery/`; restoring never overwrites a newer on-disk file without confirmation.
- **Dependencies:** Journal, backups.
- **Limitations:** Recovery is best-effort and bounded by the debounce window.

#### FR-A05 - Application settings (P1)
Persist user preferences.
- **Story:** As a user, I want to configure Astra to my needs.
- **Acceptance:** Given the Settings panel, when I change a setting (theme, font size,
  autosave interval, telemetry toggle - off by default, formatting policy, external-resource
  policy), then it persists across restarts and applies immediately where applicable.
- **Dependencies:** Local config store (no database).
- **Limitations:** Settings are per-user, not per-project (project-level config is P2).

#### FR-A06 - Installer and packaged Windows build (P0)
Ship an installable, code-signed-or-clearly-unsigned Windows package.
- **Story:** As a user, I want to install Astra without a toolchain.
- **Acceptance:** Given a release build, when I run the installer on a clean Windows 10/11
  machine, then Astra installs, launches offline, and opens a project with no dev tools present.
- **Dependencies:** Electron packaging (Electron Forge or electron-builder; NSIS/Squirrel), CI build.
- **Limitations:** Code signing requires a certificate (`OQ-011`); unsigned builds may
  trigger SmartScreen warnings.

### B. Project Explorer

#### FR-B01 - Open existing local project folder (P0)
See FR-A03. Explorer is rooted at the chosen folder and never navigates above it.

#### FR-B02 - Display directories and files (P0)
- **Acceptance:** Given an open project, when the explorer renders, then it shows the
  directory tree (excluding ignored folders per FR-B07) with folders expandable/collapsible;
  selecting a file shows its type icon and opens it per FR-B04.
- **Dependencies:** Filesystem adapter.
- **Limitations:** Very large trees are lazily loaded per directory (perf, FR-NFR).

#### FR-B03 - Support HTML, CSS, JS, and common web assets (P0)
- **Acceptance:** Given a project, when the explorer lists files, then `.html/.htm`,
  `.css`, `.js/.mjs/.cjs`, images (`.png/.jpg/.jpeg/.gif/.svg/.webp/.avif`), fonts, and
  `.json` are recognized with appropriate icons; unknown files are listed but only
  previewed as text or left unopened.
- **Dependencies:** FR-B02.
- **Limitations:** Preprocessor sources (`.scss`, `.ts`, `.jsx`) are listed but treated
  as plain text with a "not visually editable" notice in MVP (`OQ-005`).

#### FR-B04 - Open files in the code editor (P0)
- **Acceptance:** Given the explorer, when I click an editable text file, then it opens
  in the bottom Code Editor tab within 300 ms for files <= 1 MB, with syntax highlighting
  per FR-F.
- **Dependencies:** Code editor (Monaco).
- **Limitations:** Binary files are not opened as text.

#### FR-B05 - Detect externally modified files (P0)
- **Acceptance:** Given an open file also changed on disk by another program, when the
  watcher fires, then Astra compares content hash to its last-known hash; if the document
  is clean it reloads (with a subtle toast), and if it is dirty it raises a conflict per
  FR-G-Conflict without writing anything automatically.
- **Dependencies:** File watcher (Node `fs.watch` in the main process), hashing.
- **Limitations:** Watcher events are OS-dependent and may coalesce; Astra debounces and
  falls back to a hash check.

#### FR-B06 - Handle missing or inaccessible files safely (P0)
- **Acceptance:** Given a file that was deleted or made unreadable while open, when Astra
  next accesses it, then it does not crash; it marks the document as "missing/inaccessible",
  preserves the in-memory content, and offers Save-As / Retry / Close without data loss.
- **Dependencies:** Filesystem adapter error mapping.
- **Limitations:** Content on a removed drive cannot be recovered from Astra alone.

#### FR-B07 - Safe defaults and ignores (P1)
- **Acceptance:** Given an open project, then `node_modules`, `.git`, `.astra`, and other
  configurable ignore patterns are hidden/collapsed by default; ignored folders are never
  watched or scanned for the canvas entry point unless the user explicitly opts in.
- **Dependencies:** Settings, watcher scoping.
- **Limitations:** Ignore list is heuristic; user may need to adjust it.

### C. Visual Canvas

#### FR-C01 - Render the actual website (P0)
- **Story:** As a user, I want to see my real site.
- **Acceptance:** Given a project with `index.html` (or a user-selected entry), when the
  canvas loads, then it renders the HTML with linked local CSS and JS applied, matching
  the same file opened directly in an ordinary browser for supported features.
- **Dependencies:** Preview sandbox (SEC), asset resolution.
- **Limitations:** Server-side and build-step features do not run; unsupported elements
  are rendered as-is by the browser but not visually editable.

#### FR-C02 - Select elements by clicking (P0)
- **Acceptance:** Given the canvas, when I click a rendered element, then that element
  becomes the active selection, a selection outline appears (box + tag label), and the
  Inspector and Layer tree both reflect the selection within 100 ms.
- **Dependencies:** Selection bridge (postMessage), model mapping.
- **Limitations:** Elements with `pointer-events: none` may be selected via the Layer tree.

#### FR-C03 - Display selection outlines (P0)
- **Acceptance:** Given a selection, then an outline (e.g. 1-2 px accent, with hover vs.
  selected distinction) is drawn without affecting layout or the site's own CSS.
- **Dependencies:** FR-C02.
- **Limitations:** Outline is rendered by Astra's overlay layer injected into the preview,
  which itself must remain isolated from project styles.

#### FR-C04 - Show element hierarchy (P1)
- **Acceptance:** Given a selected element, then a breadcrumb path (e.g. `body > main >
  section > h1`) is shown and each segment is clickable to select that ancestor.
- **Dependencies:** FR-C02, model.
- **Limitations:** Path is DOM-based, not source-based, for elements generated at runtime.

#### FR-C05 - Synchronize selection with the layer tree (P0)
- **Acceptance:** Given a selection in the canvas, then the corresponding Layer tree node
  is scrolled into view and highlighted; selecting in the Layer tree selects in the canvas.
- **Dependencies:** FR-C02, Layer tree (FR-... in UI section).
- **Limitations:** Nodes created purely at runtime that have no source counterpart appear
  in the tree as "runtime (read-only)".

#### FR-C06 - Handle unsupported elements without corrupting the project (P0)
- **Acceptance:** Given an element Astra does not fully support (e.g. an unknown custom
  element, `<svg>` internals, `<canvas>`, an inline `<script>`-produced node), when the
  user selects or inspects it, then Astra shows it read-only, emits no source change, and
  never removes or rewrites it during unrelated edits.
- **Dependencies:** Sync preservation rules (FR-G).
- **Limitations:** Some elements are inspectable but not visually editable in MVP.

### D. Drag-and-Drop

#### FR-D01 - Drag components from the component panel (P0 for basic; full library P1)
- **Acceptance:** Given the component panel, when I press and drag a component, then a
  drag preview follows the pointer and the canvas shows valid drop targets; releasing over
  a valid target inserts the element per FR-D02.
- **Dependencies:** dnd-kit, validation (FR-D05), sync (FR-G).
- **Limitations:** MVP ships a small, curated component set (Section 12); the large
  library is P1.

#### FR-D02 - Insert elements into valid locations (P0)
- **Acceptance:** Given a valid drop target, when I drop, then a new element is inserted at
  the indicated position in the document model and, on save, in the source at the matching
  location with correct nesting.
- **Dependencies:** FR-D01, model, sync.
- **Limitations:** Insertion uses serialized, formatted markup; existing sibling formatting
  is preserved elsewhere.

#### FR-D03 - Move elements within the document hierarchy (P0)
- **Acceptance:** Given a selected element, when I drag it to another valid parent/position
  and drop, then it moves (not duplicates) in both model and source, and the move is a
  single undoable step.
- **Dependencies:** FR-D02, history.
- **Limitations:** Moving across syntax boundaries Astra cannot represent is blocked with
  an explanation.

#### FR-D04 - Display insertion indicators (P0)
- **Acceptance:** Given an active drag, then the canvas shows a clear drop indicator (line
  or placeholder) at the prospective position, plus a highlighted target container; invalid
  targets show a forbidden cursor/indicator.
- **Dependencies:** FR-D01, validation.
- **Limitations:** Indicator precision for deeply nested or zero-height targets may require
  the Layer tree as a fallback.

#### FR-D05 - Validate basic HTML nesting constraints (P0)
- **Acceptance:** Given a drop, when the resulting nesting is invalid per a documented rule
  set (e.g. a `<button>` may not contain a `<section>`; `<p>` may not contain block content;
  no interactive element nested in interactive element), then the drop is rejected with an
  explicit message ("This component cannot be placed here") and no model/source change occurs.
- **Dependencies:** Rule set, model.
- **Limitations:** The rule set is intentionally incomplete at first; unknown cases default
  to allow-with-warning rather than block (`OQ-006`).

#### FR-D06 - Undo and redo for drag operations (P0)
- **Acceptance:** Given any insert/move/reorder, when I press Ctrl+Z, then the operation is
  reverted in model and source as a single step; Ctrl+Shift+Z (or Ctrl+Y) redoes it.
- **Dependencies:** History module.
- **Limitations:** See FR-G-Undo for granularity rules.

### E. Property Inspector

#### FR-E01 - Edit text and supported HTML attributes (P0)
- **Acceptance:** Given a selected element, when I edit its text content or a supported
  attribute (`href`, `src`, `alt`, `title`, `id`, `class`, `target`, `rel`, `width`,
  `height`, `placeholder`, `type`, `value`, `aria-*`, `data-*`), then the model, canvas, and
  (on save) source update; unsupported attributes are shown read-only.
- **Dependencies:** Model, sync.
- **Limitations:** Attribute editing is schema-driven; the schema grows over time.

#### FR-E02 - Edit CSS typography (P0)
- **Acceptance:** Given a selection, when I change font-family, font-size, font-weight,
  line-height, letter-spacing, text-align, color, or text-transform, then the change is
  reflected in the canvas and written to a stylesheet rule (or inline style per policy),
  not hard-coded into markup.
- **Dependencies:** CSS parser, sync.
- **Limitations:** Units and shorthand handling follow a documented normalization policy.

#### FR-E03 - Edit colors and backgrounds (P0)
- **Acceptance:** Given a selection, when I change `color`, `background-color`,
  `background-image` (URL/gradient presets), or opacity, then the canvas updates and the
  target rule is patched in source.
- **Dependencies:** FR-E02.
- **Limitations:** Complex gradients may be edited as raw values in MVP.

#### FR-E04 - Edit spacing, borders, and dimensions (P0)
- **Acceptance:** Given a selection, when I change margin, padding, border (width/style/color/
  radius), width, height, min/max dimensions, or display/position fundamentals, then the
  change is reflected and written to the correct rule; box-model editing shows where each
  value currently resolves from.
- **Dependencies:** FR-E02, computed-style reading.
- **Limitations:** Flex/grid child sizing interactions are shown but not fully modeled in MVP.

#### FR-E05 - Configure Flexbox and CSS Grid (P1)
- **Acceptance:** Given a container with `display:flex` or `display:grid`, when I use the
  Layout tab, then I can set direction, wrap, justify/align, gap, and template track/area
  values, with the canvas updating live and the rule patched in source.
- **Dependencies:** FR-E04.
- **Limitations:** Full grid-area placement editor is P1/P2.

#### FR-E06 - Manage CSS classes (P0)
- **Acceptance:** Given a selection, when I add/remove a class, then the `class` attribute is
  updated in source, and the inspector lists which stylesheet rules match the element with
  their origin (file + selector).
- **Dependencies:** FR-E01, CSS parser.
- **Limitations:** Dynamic class manipulation via JS is not tracked.

#### FR-E07 - Show the source selector/rule for a style (P0)
- **Story:** As a developer, I want to know where a style lives.
- **Acceptance:** Given a computed style on a selected element, then the inspector shows the
  originating rule's file and selector (linkable to the source editor), distinguishing
  inline styles from stylesheet rules where feasible.
- **Dependencies:** CSS cascade resolution.
- **Limitations:** Cascade resolution is approximate for `!important`, layers (`@layer`),
  and complex specificity; approximations are labeled.

#### FR-E08 - Distinguish inherited / stylesheet / inline styles (P1)
- **Acceptance:** Given a property, then the inspector labels it as inherited (and from
  where), a stylesheet rule, inline, or the browser default, matching devtools-style
  categorization for common cases.
- **Dependencies:** FR-E07.
- **Limitations:** Computed vs. specified distinction may be simplified in MVP.

#### FR-E09 - Responsive property editing (P0)
- **Acceptance:** Given an active non-desktop viewport, when I edit a property, then Astra
  writes it into the media query that matches the current breakpoint (existing rule if
  present, otherwise a new rule inserted in a documented, deterministic location).
- **Dependencies:** FR-H, CSS parser, sync.
- **Limitations:** Breakpoints in MVP derive from the three presets and existing media
  queries; arbitrary breakpoint authoring is P1.

### F. Code Editor

#### FR-F01 - HTML, CSS, and JS editing with syntax highlighting (P0)
- **Acceptance:** Given an open `.html/.css/.js` file, when I view the Code Editor, then it
  shows syntax highlighting, line numbers, bracket matching, and code folding for that
  language via Monaco.
- **Dependencies:** Monaco Editor.
- **Limitations:** Preprocessors and frameworks get plain highlighting only (MVP).

#### FR-F02 - Search within files (P0)
- **Acceptance:** Given an open file, when I press Ctrl+F, then an in-file search box finds
  matches with next/previous navigation and match count; Ctrl+H offers replace.
- **Dependencies:** Monaco.
- **Limitations:** Project-wide search is P1.

#### FR-F03 - Error feedback (P0)
- **Acceptance:** Given a syntax error introduced in the editor, then a debounced parser pass
  surfaces an inline marker and a status-bar count within ~500 ms; the canvas does not
  crash and, if parsing fails, the last-good render is retained with a warning banner.
- **Dependencies:** Parsers, status bar.
- **Limitations:** Semantic (not just syntactic) JS errors are not detected.

#### FR-F04 - Save and reload files (P0)
- **Acceptance:** Given an edited file, when I press Ctrl+S, then the file is written
  atomically (FR-G-Write) and the tab's dirty indicator clears; reloading shows identical
  content.
- **Dependencies:** Filesystem adapter.
- **Limitations:** External locks may cause write failure, handled per FR-G-Write.

#### FR-F05 - Source changes reflected in the preview (P0)
- **Acceptance:** Given valid HTML/CSS changed in the editor, when the debounce elapses
  (default <= 400 ms), then the canvas reflects the change without a full app reload.
- **Dependencies:** Better sync (FR-G), watcher not required for self-edits.
- **Limitations:** Changes with side effects on runtime JS are reflected as the browser runs them.

### G. Synchronization Engine

The synchronization engine is the core architectural risk. It reconciles three
representations:

```text
   Visual Editor (canvas + inspector + dnd)
              |
              v
   Internal Document Model (parsed, addressed, diffable)
              |
              v
   Source Files (real HTML / CSS / JS on disk)
```

The **files on disk are the durable source of truth**. The model is a live, lossless-enough
projection that records source anchors so edits can be written back surgically.

#### FR-G01 - Source parsing with source anchors (P0)
- **Acceptance:** Given an HTML file, when parsed, then each node carries its source
  start/end offsets and, for CSS, each rule/declaration carries its raw text and offsets,
  such that an unmodified node can be re-emitted byte-identical to its original text.
- **Dependencies:** parse5 (with `sourceCodeLocationInfo`), PostCSS (`node.raws`, `source`).
- **Limitations:** Parser-specific normalization is minimized but not eliminated; the
  round-trip test (TEST-### in Section 15) is the gate.

#### FR-G02 - Detect source changes (P0)
- **Acceptance:** Given both an Astra edit and an external edit, then Astra tracks a content
  hash per file and distinguishes "changed by Astra", "changed externally", and "changed by
  both"; each case takes the documented path (self-write: no reload loop; external, clean:
  reload; external, dirty: conflict prompt).
- **Dependencies:** Watcher, hashing, revision tokens.
- **Limitations:** Same-millisecond races are handled by hashing, not by timing.

#### FR-G03 - Translate visual changes into source changes (P0)
- **Acceptance:** Given a visual edit (text, attribute, style, insert, move, delete), then
  Astra produces the minimal set of textual patches that realize it in source, applies them,
  reparses, and verifies the resulting node matches the intended model state.
- **Dependencies:** FR-G01, patch engine.
- **Limitations:** Edits that cannot be expressed as local patches are rejected with an
  explanation rather than approximated silently (`OQ-006`).

#### FR-G04 - Conflict handling (P0)
- **Acceptance:** Given a file changed on disk since Astra last read it while Astra also has
  unsaved changes, when a save or reload is triggered, then no automatic overwrite occurs;
  the user is shown options (Keep Mine / Take Theirs / Compare side-by-side), and Compare
  presents an in-app unified diff before the user commits.
- **Dependencies:** FR-G02, diff view.
- **Limitations:** MVP is line/text-based, not a full three-way merge (`OQ-008`).

#### FR-G05 - Preserve unsupported syntax (P0)
- **Acceptance:** Given constructs Astra does not model (inline `<script>`, template
  literals, `<template>`, conditional comments, exotic CSS at-rules, `style` in unknown
  forms), when unrelated edits occur, then those byte ranges are untouched; a preservation
  test asserts byte-equality outside edited ranges.
- **Dependencies:** FR-G01.
- **Limitations:** An edit that *requires* changing unsupported syntax is refused, not guessed.

#### FR-G06 - Prevent infinite synchronization loops (P0)
- **Acceptance:** Given any single user edit, then the number of disk writes is exactly one
  (debounced), and the watcher does not trigger a reparse that produces a further edit;
  self-writes are tagged and matched by hash so they never echo back as "external".
- **Dependencies:** Revision tokens, origin tagging, hash matching.
- **Limitations:** Third-party tools that rewrite formatting in a watch loop remain the
  user's responsibility; Astra stops echoing by hash.

#### FR-G07 - Undo/redo across model and source (P0)
- **Acceptance:** Given a sequence of edits, then undo/redo restores both the model and the
  corresponding source state; each logical user action is one step; undoing a save still
  leaves the file consistent (undo edits content, not the fact that a save occurred).
- **Dependencies:** Command stack with inverse patches.
- **Limitations:** Granularity is coalesced for rapid typing (e.g. one step per ~500 ms or
  per pause), documented in settings.

#### FR-G08 - Commit changes to disk safely (P0)
- **Acceptance:** Given a save, then Astra: (1) acquires the file lock/lease; (2) verifies
  the on-disk base hash still matches; (3) writes to a temp file in the same directory;
  (4) fsyncs; (5) atomically renames over the target; (6) records a backup in
  `.astra/backups/`. On any step failure, the original file is left intact and the user is
  told.
- **Dependencies:** Filesystem adapter.
- **Limitations:** Not all network/shared drives support atomic rename; Astra detects and
  warns.

#### FR-G09 - Preserve formatting and comments (P0)
- **Acceptance:** Given an edit to one value, then indentation, line endings, attribute
  quoting style, self-closing conventions, whitespace, and comments elsewhere in the file
  are byte-identical; the new value is formatted consistently with its immediate context.
- **Dependencies:** FR-G01, FR-G03.
- **Limitations:** Newly generated fragments use a configurable formatter policy (project
  style detection is best-effort).

#### FR-G10 - Editing policy: stylesheet vs inline (P0)
- **Acceptance:** Given a style edit on an element that matches an existing stylesheet rule,
  then Astra updates that rule by default; if no rule matches, Astra creates a rule (default:
  a class on the element + a rule in the associated stylesheet) rather than inline styles,
  unless the user chooses inline; the choice is remembered per project.
- **Dependencies:** Cascade resolution.
- **Limitations:** Choosing the "right" stylesheet when many exist is heuristic (`OQ-009`).

#### FR-G11 - Multi-file and multi-entry awareness (P1)
- **Acceptance:** Given a project with multiple HTML pages and stylesheets, then edits to
  shared CSS are applied once and re-render all affected pages; the explorer shows which
  files an edit touches before saving.
- **Dependencies:** Project graph.
- **Limitations:** MVP may operate on the active page + its linked stylesheets.

### H. Responsive Design

#### FR-H01 - Viewport presets (P0)
- **Acceptance:** Given the toolbar, when I choose Desktop/Tablet/Mobile, then the canvas
  resizes to the preset width (defaults provisional: Desktop = full/flexible, Tablet = 768 px,
  Mobile = 390 px) and the active preset is clearly indicated.
- **Dependencies:** Canvas.
- **Limitations:** Preset widths are defaults; user-adjustable later.

#### FR-H02 - Adjustable viewport dimensions (P1)
- **Acceptance:** Given a preset, when I drag the frame edge or type a width/height, then the
  canvas resizes live and the value is reflected in the indicator.
- **Dependencies:** FR-H01.
- **Limitations:** Specific device profiles are P2.

#### FR-H03 - Breakpoint-aware CSS editing (P0)
- **Acceptance:** Given a non-desktop preset and an existing media query for that range, when
  I edit a property, then it is written into that media query for the matched selector;
  if none exists, a new `@media` block is created at a deterministic location with the
  project's default breakpoint.
- **Dependencies:** FR-E09, CSS parser, sync.
- **Limitations:** Breakpoint values are inferred in MVP; a dedicated breakpoint editor is P1.

#### FR-H04 - Real media-query support (P0)
- **Acceptance:** Given existing `@media` rules in the project CSS, then resizing the canvas
  past a media-query threshold visibly changes the rendered result exactly as the browser
  would apply it (no separate Astra-only rendering path).
- **Dependencies:** Preview sandbox (real browser engine).
- **Limitations:** Depends on the webview's CSS support matching the user's target browsers.

#### FR-H05 - Clear active-breakpoint indication (P0)
- **Acceptance:** Given the current viewport width, then Astra shows which media queries are
  active for the selection and which stylesheet rule currently wins for the inspected property.
- **Dependencies:** FR-E08, FR-H03.
- **Limitations:** Overlapping/`min-max` ranges are summarized.

### I. Components and Design Tokens

#### FR-I01 - Reusable component definitions (P1)
- **Acceptance:** Given a selected element/subtree, when I choose "Create Component", then
  Astra stores a definition (name + markup + styles) in a portable, documented location and
  inserts a reference at the anchor; later edits to the definition update all references in
  the active project.
- **Dependencies:** Model, sync, storage format.
- **Limitations:** MVP: deferred. Full component tooling is P1+/Phase 5. MVP ships a curated
  component palette, not user-defined components.

#### FR-I02 - Shared color and typography tokens (P1)
- **Acceptance:** Given a project, when I define/redefine a token (color, font family/size,
  spacing scale), then all elements referencing it update, and the token appears in the
  inspector as a selectable value.
- **Dependencies:** CSS custom properties.
- **Limitations:** MVP: read-only display of existing tokens if present; editing is P1.

#### FR-I03 - CSS custom property support (P0 for reading, P1 for editing)
- **Acceptance:** Given a project using `--custom-properties`, then Astra displays resolved
  token values in the inspector and, if the value is a custom property, shows the property
  name and its definition site. Editing token values is P1.
- **Dependencies:** CSS parser, cascade.
- **Limitations:** Computed `var()` fallbacks are shown as resolved or raw, labeled.

#### FR-I04 - Portable storage formats (P1)
- **Acceptance:** Given components/tokens, then they are stored in human-readable files
  (CSS custom properties + HTML/partials or a documented JSON with no runtime dependency),
  and the resulting project still opens in an ordinary browser without Astra.
- **Dependencies:** Architecture decision (`OQ-010`).
- **Limitations:** Exact mechanism deferred to Phase 5.

**MVP boundary (per Section 12):** FR-I03 *reading* is in MVP; FR-I01, FR-I02, FR-I04 and
FR-I03 *editing* are deferred.

### J. Accessibility

All accessibility findings are **advisory**. Astra must not silently rewrite project code.

#### FR-J01 - Missing image alt text (P0 advisory)
- **Acceptance:** Given an `<img>` without `alt`, then the checker flags it (severity: warning/
  error per policy), lists it in an Accessibility panel, and clicking it selects the element;
  Astra does not add `alt` automatically.
- **Dependencies:** Analyzer.
- **Limitations:** Decorative images with `alt=""` are correct and must not be flagged.

#### FR-J02 - Missing accessible names (P0 advisory)
- **Acceptance:** Given interactive elements with no discernible accessible name (button,
  link, input), then they are flagged with the reason; no automatic fix.
- **Dependencies:** Analyzer.
- **Limitations:** Accurate accessible-name computation is complex; MVP uses heuristics and
  labels them as approximate.

#### FR-J03 - Form-label issues (P0 advisory)
- **Acceptance:** Given a form control without an associated label/`aria-label`/`aria-labelledby`,
  then it is flagged, and the fix is described (not applied).
- **Dependencies:** FR-J02.
- **Limitations:** Implicit label associations via wrapping are detected; exotic cases may be missed.

#### FR-J04 - Heading hierarchy warnings (P1 advisory)
- **Acceptance:** Given headings that skip levels or lack an `h1`, then a warning is shown
  with the offending outline.
- **Dependencies:** Analyzer.
- **Limitations:** Purely structural; advisory only.

#### FR-J05 - Basic contrast checks (P1 advisory)
- **Acceptance:** Given text elements, then contrast ratios are estimated from computed
  colors and backgrounds and flagged against WCAG AA thresholds where computable.
- **Dependencies:** Computed styles.
- **Limitations:** Backgrounds from images/gradients may be indeterminate; reported as "cannot
  compute" rather than passed.

#### FR-J06 - Keyboard accessibility checks (P2 advisory)
- **Acceptance:** Given obvious focus-order/trap risks (e.g. positive `tabindex`), then a
  warning is shown.
- **Dependencies:** Analyzer.
- **Limitations:** Full keyboard traversal testing is out of scope for MVP.

### K. Local-First Operation

#### FR-K01 - No mandatory network connection (P0)
- **Acceptance:** Given a disconnected machine, when Astra launches and the user opens,
  edits, and saves a local project, then all core flows succeed with no network access.
- **Dependencies:** Architecture; no remote calls in core paths.
- **Limitations:** Optional features (e.g. AI, remote fonts preview) may require network and
  must degrade gracefully.

#### FR-K02 - No account requirement (P0)
- **Acceptance:** Given a fresh install, then Astra is fully usable without sign-in, email,
  or license activation.
- **Dependencies:** None.
- **Limitations:** Optional future paid tiers must not gate core editing (`OQ-012`).

#### FR-K03 - No telemetry by default (P0)
- **Acceptance:** Given default settings, then Astra transmits no analytics or usage data;
  any future telemetry is opt-in, documented, and disclosed exactly.
- **Dependencies:** Settings, network policy.
- **Limitations:** Crash reporting, if ever added, must be explicit opt-in.

#### FR-K04 - Clear boundaries around external resources (P0)
- **Acceptance:** Given a project referencing remote assets (CDN CSS/JS, webfonts, remote
  images), then Astra shows an "external resources" indicator, applies a configurable policy
  (Block by default in MVP; Allow with confirmation), and never silently executes remote
  script without the user's policy permitting it.
- **Dependencies:** Preview sandbox, CSP.
- **Limitations:** Blocking all remote resources may make some sites look broken offline;
  the UI explains why.

#### FR-K05 - Local project storage (P0)
- **Acceptance:** Given a project, then it is stored only in the user-selected folder plus a
  `.astra/` metadata directory; no project data is copied to any cloud by Astra.
- **Dependencies:** Filesystem adapter.
- **Limitations:** `.astra/` holds non-essential metadata (IDs, backups, settings); deleting
  it must not break the project.

#### FR-K06 - Graceful offline operation (P0)
- **Acceptance:** Given loss of connectivity mid-session, then no core feature errors out;
  features that need network show a clear offline notice.
- **Dependencies:** FR-K01.
- **Limitations:** None material.

### L. Optional AI (future extension)

#### FR-L01 - Provider adapter (P2)
- **Acceptance:** Given an optional AI provider configuration, then Astra can route AI
  requests through an adapter interface supporting a local runtime (e.g. Ollama) and,
  optionally, a hosted provider if the user configures one; no provider is required for
  core functionality.
- **Dependencies:** None for core; deferred to Phase 6.
- **Limitations:** Not in MVP; entirely opt-in.

#### FR-L02 - Reviewable AI changes (P2)
- **Acceptance:** Given any AI-proposed change (generate component, explain CSS, suggest
  responsive improvement, refactor selection, suggest a11y fix), then the proposal is shown
  as a diff and applied only on explicit approval; AI never executes shell commands and
  never overwrites files without authorization.
- **Dependencies:** Diff view, permissions.
- **Limitations:** Not in MVP.

---

## 8. Non-Functional Requirements

All numeric targets below are **provisional** and must be measured before being treated as
commitments (`ASM-001`). Where a target exists, the measurement method is stated. Targets are
chosen for a mid-range Windows laptop (e.g. 4-core CPU, 16 GB RAM, SSD) and must also be validated
on modest hardware (4-core CPU, 8 GB RAM), given Electron's multi-process model. Because Electron
bundles Chromium and runs multiple processes, memory and distribution-size figures are expected to
be materially higher than for a lighter system-webview shell; they are stated as targets to be
measured, not as promises.

#### NFR-001 - Startup time (provisional)
Cold start to an interactive welcome window: **target <= 3 s** (P95 over 20 runs).
Measurement: instrumented timestamps from process start to first interactive paint; recorded
in the local (opt-in) diagnostics log.

#### NFR-002 - Project open time (provisional)
Open a medium project (<= 200 files, <= 5 MB total, entry HTML <= 500 KB): **target <= 1.5 s**
to first canvas paint, excluding remote resources.
Measurement: timer around project load pipeline.

#### NFR-003 - Interaction responsiveness (provisional)
Click-to-selection and property-edit-to-canvas-update: **target <= 100 ms** local, P95.
Measurement: performance marks around selection and edit pipelines.

#### NFR-004 - Memory usage (provisional)
Measured across the Electron process tree (main + renderer(s) + GPU/utility helpers): idle
(welcome screen) **target <= 350 MB total RSS**; a medium project open with the preview loaded
**target <= 900 MB total RSS**. Measurement: sum of all app process metrics sampled during scripted
scenarios on both 16 GB and 8 GB machines; report a per-process breakdown. These provisional
ceilings are intentionally looser than a system-webview shell to reflect Electron's process model.

#### NFR-005 - Large-tree handling (provisional)
Editing within a document of up to ~5,000 HTML nodes: no operation blocks the UI > 200 ms.
Measurement: synthetic stress documents with scripted edits.

#### NFR-006 - Reliability
No crash in a 2-hour scripted editing session; zero occurrences of the "source corruption"
class (NFR-010) across the acceptance suite. Measurement: automated soak + preservation tests.

#### NFR-007 - Data integrity (P0)
Every save is atomic; no interrupted save leaves a partially written file. If a write fails,
the previous content remains intact. Measurement: fault-injection tests (kill mid-write, disk-full
simulation) asserting file content is one of {old, new}, never a mix.

#### NFR-008 - Security posture
Preview code cannot invoke privileged desktop commands; filesystem access is confined to the
opened project root. Measurement: automated sandbox-escape tests (Section 15) must fail to escape.

#### NFR-009 - Accessibility of Astra itself (P1)
Astra's own UI meets WCAG 2.1 AA for color contrast and keyboard operability for primary
flows: open project, select element, edit a property, save. Measurement: contrast audit tooling
+ keyboard-only walkthrough checklist.

#### NFR-010 - Maintainability
Modular boundaries (Section 11) with no cyclic dependencies between core modules; TypeScript
strict mode; lint clean (main, preload, renderer); documented public interfaces. Measurement:
dependency-graph lint, typecheck, lint gates in CI.

#### NFR-011 - Offline coverage
100% of MVP acceptance tests pass with networking disabled (except tests explicitly marked
network-optional). Measurement: CI job that runs the suite with network blocked.

#### NFR-012 - Compatibility
Support Windows 10 (21H2+) and Windows 11; the rendered preview uses the Chromium engine bundled
with the application's pinned Electron version (not the machine's system webview). Measurement:
matrix of OS versions in CI/manual; the pinned Electron/Chromium version is recorded per release.

#### NFR-013 - Data integrity under external change
External modification while Astra is open never results in silent data loss. Measurement:
concurrent-writer tests (Section 15).

#### NFR-014 - Observability without telemetry
Diagnostics are local-only: a user-viewable log and an opt-in exportable diagnostic bundle.
No data leaves the machine unless the user exports it. Measurement: network capture during
normal use shows no egress.

#### NFR-015 - File size scaling
Files up to 5 MB open in the code editor without freezing; larger files open with a warning
and a read-only fallback if editing latency is unacceptable. Measurement: timed open of
generated large files.

#### NFR-016 - Preview refresh latency (provisional)
After a settled source edit, the preview reflects the change within **target <= 400 ms**
(consistent with FR-F05), P95, for a medium project. Measurement: performance marks from the
debounced edit to the preview paint.

#### NFR-017 - Renderer stability
No renderer process crash in a 2-hour scripted session; if a renderer does crash, the app
recovers UI state without data loss and without restarting the main process. Measurement:
automated soak runs plus a forced-crash injection test (`TEST-032`).

#### NFR-018 - Distribution and install size (provisional, measured not promised)
Electron ships a Chromium runtime, so artifacts are large. **Measure** rather than target:
record the installed footprint (MB) and installer size for each release on Windows x64 and publish
the numbers. A provisional planning budget of "order of hundreds of MB installed" is recorded for
estimating only; it must not be quoted to users as a guarantee. Measurement: file-size accounting on
a clean install.

---

## 9. UI/UX Specification

> [!note] Regarding the visual reference
> The prompt references a "supplied Astra visual reference." No such image exists in the
> workspace at the time of writing. The following specifies the intended design language in
> prose. If a reference is supplied later, treat it as authoritative for visual specifics
> (exact hues, spacing scale) and reconcile this section; treat it as design intent, not
> proof of implemented functionality.

### 9.1 Design language

- Professional desktop development environment, dense and information-rich, not a marketing page.
- **Dark charcoal** base (e.g. near-neutral `#1E1E1E`-ish surfaces with layered elevation),
  restrained **burgundy and gold** interaction accents, unless a reference specifies otherwise.
- Clear typographic hierarchy, consistent spacing scale, subtle 1 px borders, minimal
  decorative effects. No excessive gradients, glassmorphism, neon, giant rounded cards, or
  generic "AI dashboard" styling.

### 9.2 Layout regions

```text
+---------------------------------------------------------------------------+
| TOOLBAR: project | current file | undo/redo | preview | D/T/M | zoom | save | ⚙ |
+------------+------------------------------------------------+-------------+
| LEFT       |                 CENTER CANVAS                  |  RIGHT      |
| Sidebar    |          (real site + overlays)                |  Inspector  |
|            |                                                |             |
| Files      |        selection outline / breadcrumb          | Inspector   |
| Components |        drop indicators                         | Styles      |
| Design Sys |                                                | Layout      |
| Assets     |                                                | Attributes  |
| Settings   |                                                |             |
+------------+------------------------------------------------+-------------+
| BOTTOM CODE EDITOR: [HTML] [CSS] [JS]  ... syntax highlighted ...         |
|                      (resizable panel height)                             |
+---------------------------------------------------------------------------+
| STATUS BAR: selection path | breakpoint | errors | save state | ext-resources|
+---------------------------------------------------------------------------+
```

### 9.3 Top toolbar (UX-001)
Project selector; current file breadcrumb; undo/redo; live-preview toggle (edit vs. preview
mode); device presets (Desktop/Tablet/Mobile); zoom controls (fit, 100%, +/-); Save; Settings.
Every control has a tooltip with its keyboard shortcut; unavailable controls are visibly
disabled (not hidden) to preserve layout stability.

### 9.4 Left sidebar (UX-002)
Tabs/sections: **Project files** (tree per FR-B), **Components** (draggable palette per FR-D),
**Design system** (tokens, read-only in MVP), **Assets** (images/fonts used), **Settings**.
Collapsible; remembers scroll/expansion state per project.

### 9.5 Center canvas (UX-003)
Renders the real site inside the sandboxed preview. Overlays (selection outline, hover
highlight, breadcrumb, drop indicators) are drawn by Astra in a distinct overlay layer that
must not leak styles into the site and must not be captured in saved output. Empty state:
centered prompt "Open a project folder to begin" with an Open button and a list of recent
projects (recent list is P1).

### 9.6 Right inspector (UX-004)
Tabs: **Inspector** (element identity + attributes), **Styles** (matched rules + computed
values), **Layout** (box model, flex/grid), **Attributes** (HTML attributes), plus typography
and spacing controls presented within Styles. Each value shows its origin (inline / rule file
+ selector / inherited / default) per FR-E07/E08. Responsive values are labeled with the
breakpoint they apply to.

### 9.7 Bottom code editor (UX-005)
Monaco-based, with HTML/CSS/JS tabs (one tab per open file). Syntax highlighting, search,
error markers (FR-F03). Panel height is user-adjustable and persisted. Editing in the panel
feeds the sync engine (FR-F05).

### 9.8 States (UX-006)
- **Empty:** welcome screen; empty explorer ("This folder has no web files"); empty inspector
  ("Select an element to edit").
- **Loading:** canvas shows a skeleton/frame with a loading indicator; project open shows
  progress; long parses show a non-blocking spinner.
- **Error:** parse failure (banner: "Could not parse index.html; showing last good render"),
  unsupported element (read-only badge), failed save (dialog with cause + retry), conflict
  (FR-G04), external resource blocked (status-bar indicator with explanation).
- **Success:** transient "Saved" indicator in the status bar (no modal).

### 9.9 Keyboard shortcuts (UX-007, provisional)

| Shortcut | Action |
|---|---|
| Ctrl+S | Save current file |
| Ctrl+Shift+S | Save all |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+C / Ctrl+V | Copy / Paste selection |
| Ctrl+D | Duplicate selection |
| Delete | Delete selection |
| Ctrl+F / Ctrl+H | Find / Replace in file |
| Ctrl+Shift+F | Project-wide search (P1) |
| Ctrl+O | Open project |
| Ctrl+W | Close file/project (with unsaved guard) |
| Ctrl+1 / 2 / 3 | Desktop / Tablet / Mobile |
| Ctrl+P | Toggle preview mode |
| Ctrl+Shift+A | Toggle accessibility panel |
| Ctrl+, | Settings |

Shortcuts must not fire while the code editor has focus when they would conflict with typing
or Monaco defaults; conflicts are resolved in favor of the focused editor.

### 9.10 Accessibility considerations for Astra itself (UX-008)
Keyboard-navigable panels, visible focus rings, ARIA roles for tree/tabs/dialogs, screen-reader
labels for icon-only buttons, and respect for reduced-motion. Target NFR-009.

---

## 10. Technical Stack and Rationale

> [!note] Framework decision
> The desktop framework is **Electron** (ADR-001, Section 10.7). Electron is an implementation
> choice, not Astra's product differentiator - the differentiator remains visual editing of real,
> portable source code (Section 2). This section replaces the earlier Tauri/Rust plan.

### 10.1 Stack (approved baseline)

| Area | Choice | Required for MVP | Why | Trade-offs / security |
|---|---|---|---|---|
| Desktop framework | **Electron** | Yes | Bundles a known Chromium version for consistent rendering and mature automation; Node.js main process for filesystem work; large, stable ecosystem. | Larger distribution size and higher memory than a system-webview shell; security depends on correct main/preload/renderer separation (Section 14). |
| Frontend | **React + TypeScript** | Yes | Mature ecosystem for complex editor UIs; strong typing reduces model bugs. | Virtual DOM overhead for large trees (mitigated by virtualization/memoization). |
| Application main process | **Node.js + TypeScript** | Yes | Filesystem, watcher, atomic writes, hashing, dialogs, and IPC validation in a privileged, single place. | Privileged context; every IPC request must be validated and Node APIs must never reach untrusted content. |
| Renderer bridge | **preload script + `contextBridge`** | Yes | Exposes a small, explicit, typed API while keeping `contextIsolation` on. | Any channel added here widens the trust surface; keep it minimal and audited. |
| Build tool / dev server | **Vite** with an Electron integration (e.g. `electron-vite` or an equivalent Vite plugin) | Yes | Fast HMR and TS support for the renderer; simple main/preload bundling. | Keep `base`/asset paths Electron-compatible (loading from `file://`). |
| Packaging | **Electron Forge** or **electron-builder** | Yes | Both produce Windows installers/portables for standard projects without a C++ toolchain of our own. | Signing/SmartScreen handling; large installer size (Section 10.6). |
| Code editor | **Monaco Editor** | Yes | Proven, feature-rich (highlighting, find, folding), offline-capable when bundled locally. | Large bundle; must be served locally (not from CDN) to honor offline. |
| HTML parser | **parse5** | Yes | Spec-compliant parsing, source location info for surgical patching. | Must preserve raw text via location offsets; parse5 alone does not round-trip formatting, so a patch layer is required. |
| CSS parser | **PostCSS** | Yes | AST with `raws` preservation and source offsets; broad plugin ecosystem. | Formatting fidelity requires care; complex at-rules need explicit handling. |
| Drag-and-drop | **dnd-kit** | Yes (Phase 4) | Accessible, modern, React-friendly; works for palette and reorder. | Pointer/keyboard parity needs explicit testing. |
| State management | **Zustand** | Yes | Minimal, non-opinionated, avoids prop-drilling; good for editor state. | Not a full framework; discipline required to keep slices modular. |
| Styling | **Tailwind CSS (optional)** | Optional | Fast, consistent design system for the shell if adopted. | Include only if it clearly helps; must be scoped so it never leaks into the previewed site. |
| Unit / integration testing | **Vitest** | Yes | Fast, Vite-native, TS-friendly. | DOM-level sync tests need jsdom/happy-dom plus parser fixtures. |
| E2E / app testing | **Playwright** (Electron support) | Yes | Can launch and drive the real Electron app across main/preload/renderer/preview; strong for cross-flow testing. | OS-level behaviors (installer, native dialogs, SmartScreen) still need manual verification (Section 15). |

### 10.2 Why Electron

Astra's UI is a code-editor-class application: a large React tree (canvas, layer tree, inspector,
explorer), an embedded Monaco editor, and long-lived local state. Electron aligns with that shape:

- **Chromium renderer:** one predictable, up-to-date engine renders both the project preview and
  the app UI, independent of whichever system webview happens to be installed on the machine.
- **Node.js main process:** first-class filesystem, process, and dialog APIs support the controlled
  project services (Section 11.6) without a second implementation language or a cross-language bridge.
- **One language and ecosystem:** TypeScript on both sides of IPC reduces serialization bugs and
  keeps a single dependency model (`npm` only).
- **Mature tooling:** packaging (Electron Forge / electron-builder) and automation (Playwright) are
  well-established for Electron.

**Trade-offs (explicit).**

| Dimension | Electron consequence | Mitigation / note |
|---|---|---|
| Memory | Each renderer is a Chromium process; idle and per-view memory exceed a system-webview shell. | Fewer, reused renderers; lazy-initialize the preview; unload unused views; measurable targets in `NFR-004` (provisional). |
| Bundle / distribution size | Ships a Chromium runtime, so installers are large (order of hundreds of MB). | Accepted trade-off; measured, not promised (Section 10.6, `NFR-018`). |
| Startup time | Cold start includes Electron/Chromium initialization. | Defer non-critical work until after first paint; target in `NFR-001` (provisional). |
| Security | The main process is powerful; a misconfiguration can expose privileges to project code. | Enforced process separation and hardened settings (Section 14); the preview is isolated from privileged APIs. |

These are **trade-offs, not defects**. They are accepted because Astra is a large local desktop tool
where renderer consistency and tooling maturity matter more than a minimal binary. Electron is an
implementation detail; the local-first, no-account, offline, source-ownership guarantees (Sections 2
and 14) are unchanged.

### 10.3 Three different kinds of "building" (do not conflate)

1. **Frontend development** - Vite bundles React/TypeScript and the app UI. Requires only Node.js and
   the project's npm dependencies; no native compiler.
2. **Application packaging** - bundling the app together with the Electron runtime into a Windows
   installer/portable. Standard projects use the **prebuilt Electron binary** downloaded by
   npm/Electron Forge; the developer does **not** compile Electron or Chromium.
3. **Native dependency compilation** - some npm packages are native C/C++ addons. If a package ships
   **prebuilt binaries for the target Electron/Node ABI**, no compiler is needed. If it must be built
   from source (node-gyp), it may require **additional build tools**, which on Windows can include the
   Microsoft C++ Build Tools and, depending on the dependency, the Windows SDK.

> [!important] Accuracy note on toolchains
> Electron does **not** categorically eliminate the need for the Microsoft C++ Build Tools or the
> Windows SDK. For a standard project whose dependencies ship prebuilt binaries, neither is normally
> required. Requirements depend entirely on the chosen dependencies and build configuration. Any
> statement about which tools are or are not needed must be confirmed by actually attempting the
> build on the target machine, never assumed.

Astra's MVP dependency set is deliberately chosen to avoid native addons where practical
(Section 10.4). If a future dependency needs native compilation, that cost is evaluated then.

### 10.4 Additional libraries (each with a stated responsibility)

- **File watching:** Node's built-in `fs.watch` for the project root, with debouncing and a content
  hash as the source of truth (watcher events are advisory and OS-dependent; FR-B05). A library such
  as `chokidar` may be adopted only if `fs.watch` proves insufficient on Windows; if adopted, it must
  be justified and audited.
- **Hashing:** Node's built-in `node:crypto` (e.g. SHA-256) for content hashes used in sync/conflict
  logic.
- **Diffing:** a small JS diff library (e.g. `diff`) for the Compare view (FR-G04).
- **HTML sanitization (Astra's own UI only):** a vetted sanitizer such as DOMPurify for any place
  Astra injects untrusted strings into Astra's **own** UI; this is defense-in-depth and never a
  substitute for sandboxing the preview.
- **Database:** **None.** No requirement justifies one. Project state lives in files; app settings
  live in a small config file (`ASM-002`).

### 10.5 Development and build workflow (Windows)

Proposed npm scripts. These names are proposals; the chosen tooling must support them and their
actual behavior must be defined once the scaffold is finalized.

| Script | Purpose | Notes |
|---|---|---|
| `npm run dev` | Launch Electron in development with the Vite dev server and renderer HMR. | Does not package. |
| `npm run build` | Type-check and build the frontend bundles (renderer + main + preload). | Produces build output, not an installer. |
| `npm run package` | Package the app into a runnable (unpacked) directory. | Electron Forge `package` / electron-builder `--dir`. |
| `npm run make` | Produce the Windows distributable(s): installer and/or portable (Section 10.6). | Electron Forge `make` / electron-builder `--win`. |
| `npm test` / `npm run test:e2e` | Unit/integration and end-to-end tests (Section 15). | |
| `npm run lint` / `npm run typecheck` | Static checks. | |

Ordered stages: **develop -> build frontend -> package -> make installer -> sign/publish.** A
developer can run and test the app with only Node.js installed; producing installers is a separate
step that may additionally download packaging tools.

**CI (optional).** A GitHub Actions workflow (Windows runner) can lint, test, package, and publish
Windows artifacts. Hosted Windows runners provide build tooling without requiring the developer to
install a full toolchain locally, but this is **not a guarantee** that every native dependency will
build without additional tools. CI is **not mandatory for the MVP**; it becomes valuable once
packaging and releases stabilize.

### 10.6 Packaging, updates, and distribution

- **Target:** Windows x64, packaged with Electron Forge or electron-builder.
- **Distribution options:** an installer (e.g. NSIS or Squirrel) and, where supported, a portable
  build. The exact set is an open decision once the packaging tool is fixed.
- **Versioning:** the application version is tracked in `package.json` and surfaced in the About UI.
- **Release artifacts:** the installer/portable plus a checksum manifest. Do not publish promised
  sizes until measured (Section 10.3; estimates must not become promises).
- **Code signing:** desirable to reduce SmartScreen friction; requires a certificate and is an open
  question (`OQ-011`). Unsigned builds must be documented as such.
- **Updates:** auto-update (e.g. via `electron-updater`) is **optional and opt-in**; it must be
  described together with its security implications (signature verification, transport integrity) and
  must never become a hidden egress that undermines the local-first posture (FR-K03, SEC-010,
  SEC-021).
- **Dependency / vulnerability management:** minimal pinned dependencies, `npm audit` (and, where
  applicable, `npm audit signatures`) in CI, review before adding dependencies, and no remote asset
  loading (Section 14).
- **Offline operation:** after installation the app must run fully offline; no core flow may require
  network access (FR-K01, FR-K06).

### 10.7 Architecture Decision Record

**ADR-001 - Desktop framework: Electron**

- **Decision:** Electron is the approved desktop framework for Astra.
- **Status:** Accepted.
- **Context:** The team evaluated desktop implementation options for a local-first visual web
  designer and selected Electron, aligning the desktop app with the TypeScript/React ecosystem and
  reducing dependence on a Rust-specific development workflow.
- **Rationale:** JavaScript/TypeScript ecosystem alignment, straightforward React integration, mature
  desktop capabilities (windows, dialogs, filesystem, packaging), and a uniform dependency and
  tooling model.
- **Trade-offs:** larger application distribution size and potentially higher memory usage compared
  with lighter system-webview alternatives.
- **Consequences:** a main/preload/renderer separation, Electron-specific security requirements
  (Section 14), and an Electron-based packaging and testing workflow (Sections 10.5, 10.6, 15).
- **Reconsideration criteria:** revisit the framework only if measured performance, security,
  maintenance, or distribution requirements cannot reasonably be met (`OQ-013` covers the E2E tooling
  question). No formal benchmark study was conducted to reach this decision.

---

## 11. System Architecture

### 11.1 Module map (the 17 required modules)

| # | Module | Responsibility | Depends on |
|---|---|---|---|
| 1 | Desktop Shell | Electron main process: window lifecycle, menus, IPC surface, IPC validation, settings. | OS, Electron |
| 2 | Project Manager | Open/close project, entry detection, project graph (pages ↔ assets), recent list. | 3 Filesystem Adapter |
| 3 | Filesystem Adapter | Scoped read/write/list/watch, hashing, atomic writes, backups, error mapping. | Node fs (main process), watcher |
| 4 | HTML Parser | Parse HTML to AST with source anchors; re-emit ranges; report syntax issues. | parse5 |
| 5 | CSS Parser | Parse CSS to AST with raws/source; media queries; cascade inputs. | PostCSS |
| 6 | Internal Document Model | Addressed, diffable projection; node identity; edit operations; dirty tracking. | 4, 5 |
| 7 | Visual Canvas | Sandboxed render host, overlay injection, viewport framing. | 1, 3, 12 |
| 8 | Selection & Layer Tree | Selection state, hover, breadcrumb, tree virtualization, canvas↔tree sync. | 6, 7 |
| 9 | Drag-and-Drop Engine | Drag sources/targets, validation hooks, insertion indicators, reorder. | 6, 8 |
| 10 | Property Inspector | Schema-driven editing; computed-style reading; origin attribution. | 6, 8 |
| 11 | Code Editor | Monaco host, language services, find/replace, markers. | 6 |
| 12 | Synchronization Engine | Diff source↔model, generate/apply patches, conflict handling, loop prevention. | 3, 4, 5, 6 |
| 13 | Undo/Redo History | Command stack with inverse patches; coalescing; per-file scoping. | 6, 12 |
| 14 | Responsive Preview | Viewport presets, size control, active breakpoint computation. | 7, 5 |
| 15 | Component Manager | Palette, component definitions/references (P1). | 6, 12 |
| 16 | Design Token Manager | Token discovery (MVP), token editing (P1). | 5, 6 |
| 17 | Accessibility Analyzer | Advisory checks over the model; findings list. | 6 |

### 11.2 Application process architecture (Electron)

Electron runs multiple processes. Astra assigns each a clear trust level and API surface.

| Layer | Process | Trust | Responsibilities | Must not |
|---|---|---|---|---|
| Main | Electron main (Node.js) | Privileged / trusted | App lifecycle, window and menu management, native dialogs, project-root tracking, the controlled filesystem service, IPC request validation, settings. | Render untrusted project content. |
| Preload | Per-renderer preload | Trusted bridge, minimal | Expose a small, explicit, typed API via `contextBridge`; translate calls to vetted IPC channels only. | Expose `ipcRenderer`, `require`, `process`, or arbitrary channel names. |
| Renderer (UI) | Chromium renderer | Trusted (Astra's own UI) | React UI: canvas host, layer tree, inspector, explorer, Monaco, state (Zustand). | Receive Node APIs. Runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. |
| Preview | Isolated renderer / nested view | **Untrusted** | Render the user's project HTML/CSS/JS. | Access IPC/preload/main, navigate freely, open windows, or touch the filesystem. |

```text
  +--------------------------------------------------------------+
  |                   Electron Main (Node.js)                    |
  |  lifecycle | windows | menus | dialogs | settings            |
  |  filesystem service (scoped)   |   IPC request validation    |
  +-------------------^-----------------------------^------------+
                      |  ipcMain.handle (validated) |
        +-------------+--------------+              |
        |                            |              |
  +-----v-------------+   +----------v-----------+  |
  |  Preload (UI)     |   |  Preload (Preview)   |  |
  |  contextBridge    |   |  minimal / none      |  |
  +-----^-------------+   +----------^-----------+  |
        |                            |              |
  +-----v-------------+   +----------v-----------+  |
  |  Renderer: Astra  |   |  Preview renderer    |  |
  |  UI (React)       |   |  (untrusted project) |  |
  +-------------------+   +----------------------+  |
        ^                                            |
        |  validated postMessage (selection/overlay) |
        +--------------------------------------------+
```

Trust boundaries:

1. **Main <-> Renderer** (privileged vs UI): every message crossing into main is validated (channel
   allowlist, payload schema, project-root containment).
2. **Astra UI <-> Preview** (trusted UI vs untrusted project): communication uses a validated,
   versioned postMessage protocol; the preview receives no privileged channel.
3. **App <-> Filesystem:** only the main-process filesystem service touches disk, scoped to the
   active project root (Section 11.6).
4. **App <-> Network:** off by default for project resources (FR-K04); no egress on core paths.

### 11.3 Layered dependency direction

```text
            +---------------------------------------------------+
            |                    Desktop Shell (1)              |
            +---------------------------------------------------+
                 |            |             |            |
        +--------v---+  +-----v------+ +----v-----+ +----v------+
        | Project Mgr|  |  Canvas(7) | | Code Ed. | | Inspector |
        |    (2)     |  |  + Sel(8)  | |  (11)    | |   (10)    |
        +-----+------+  |  + DnD(9)  | +----+-----+ +----+------+
              |         |  + Resp(14)|      |            |
        +-----v---------v------------v------v------------v------+
        |                Internal Document Model (6)             |
        +-----+--------------------+--------------------+-------+
              |                    |                    |
     +--------v-------+  +---------v--------+  +--------v--------+
     | HTML Parser (4)|  | CSS Parser (5)   |  | History (13)    |
     +--------+-------+  +---------+--------+  +--------+--------+
              |                    |                    |
              +----------+---------+--------------------+
                         |
              +----------v-----------+
              | Synchronization (12) |
              +----------+-----------+
                         |
              +----------v-----------+
              | Filesystem Adapter(3)|
              +----------+-----------+
                         |
                  Real project files (disk)

  Side modules: Components(15), Tokens(16), A11y(17) observe the model;
  Responsive Preview(14) drives the Canvas(7) viewport.
```

Dependencies point **downward and inward** (UI -> model -> parsers/sync -> filesystem).
No core module depends on a UI module. This keeps parsers and sync testable in isolation.

### 11.4 Data flow

**Read path (open project):**

```text
Folder pick -> FS Adapter lists files -> Project Manager picks entry
  -> HTML Parser + CSS Parser -> Document Model
  -> Canvas loads sandboxed preview from files (via scoped protocol)
  -> Selection/Layer Tree and Inspector hydrate from the model
```

**Visual-edit path:**

```text
Inspector/DnD -> Model mutation (operation) -> provisional canvas update
  -> Sync Engine computes minimal source patch -> applies to source buffer
  -> Code editor reflects new source -> Autosave debounce -> Atomic write + backup
```

**Source-edit path:**

```text
Code Editor change -> debounced parse -> Model update
  -> Sync Engine confirms self-origin (no external conflict) -> Canvas re-render
```

**External-change path:**

```text
Watcher event -> FS Adapter hashes file -> compare to last-known hash
  -> clean doc: reload (hash update)
  -> dirty doc: conflict prompt (no auto-write)
```

### 11.5 Error-handling strategy

- **Never destructive on error:** parser failures, save failures, and conflicts must leave the
  on-disk file valid and the in-memory buffer recoverable.
- **Errors are typed and mapped:** FS errors -> user-facing categories (not-found, permission,
  locked, disk-full, path-invalid). Parse errors -> structured diagnostics with ranges.
- **Boundaries:** each module returns `Result`/`Result<T,E>`-style outcomes; the UI renders a
  consistent error surface (toast for transient, banner for persistent, dialog for decisions).
- **Fallbacks:** parse failure -> keep last-good render; save failure -> keep dirty buffer and
  offer retry/Save-As; unsupported construct -> read-only, never rewrite.

### 11.6 Filesystem and project management (Electron main process)

The renderer never touches the filesystem directly. All disk access is a **controlled service in the
Electron main process**, invoked over validated IPC.

- **Folder selection:** a native dialog (user gesture) yields a **project root**.
- **Project-root tracking:** the main process stores the canonical root and issues a project handle;
  every operation requires that handle.
- **Allowlisted operations:** read, list, stat, watch, write, create, rename, delete - each a named,
  typed IPC handler. No generic "read any path", "write any path", or "exec" channel exists.
- **Safe path handling:** canonicalize every path; verify containment inside the project root; reject
  `..` traversal, symlink escapes, and non-UTF-8/odd names gracefully.
- **Limits:** enforce sensible file-size and operation limits; refuse to open or overwrite beyond them.
- **Atomic / recoverable saves:** write to a temp file in the same directory, fsync, atomically rename
  over the target, and record a backup in `.astra/backups/` (FR-G08). On failure the original stays
  intact.
- **Externally changed / moved / deleted files:** detected via watcher + content hash and reconciled
  per FR-B05/FR-G02 (clean reload vs. conflict prompt); never silently overwritten.
- **Destructive operations:** require explicit confirmation; nothing is deleted silently.
- **Preview:** receives **no** filesystem capability; project assets reach it only via a scoped,
  read-only mechanism (Section 11.7).
- `.astra/` holds only non-essential metadata and remains optional to the project's validity.

### 11.7 Preview isolation strategy (see also Section 14)

The preview renders untrusted project code and must be separated from privileged APIs.

- **Separate renderer, separate context:** the preview runs in its **own Electron renderer** (a
  dedicated `BrowserWindow`/`WebContentsView`), not in the Astra UI renderer and not in the main
  process. It loads with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`, and
  with **no preload bridge** (or a bridge exposing nothing privileged).
- **No privileged IPC:** the preview has no access to `ipcRenderer`/`ipcMain`, no project handle, and
  no filesystem channel. Any Astra-issued message is one-way or strictly validated.
- **Asset delivery via a scoped, read-only mechanism:** project files are served through a custom
  protocol (or an equivalent read-only scheme rooted at the project directory) so `../` escapes are
  impossible at the transport layer; the preview cannot read arbitrary paths.
- **Navigation and window restrictions:** block in-page navigation away from the served origin, deny
  `window.open` and new-window requests, and deny unexpected external URLs. External resources follow
  the FR-K04 policy (blocked by default).
- **CSP:** apply a restrictive Content Security Policy to the preview document; script execution is
  permitted only for the project's own scripts as required for faithful rendering.
- **Overlay/selection channel:** Astra draws selection outlines and receives inspection data via a
  **validated, versioned postMessage protocol** (message shape, source, and origin checked; unknown
  messages ignored). The protocol is designed so a hostile project cannot forge Astra UI messages
  across a trust boundary.
- **Justification (why not "just an iframe"):** a sandboxed iframe (`sandbox="allow-scripts"` without
  `allow-same-origin`) is a viable containment mechanism and may be used where it fits. A separate
  Electron renderer is preferred for Astra because it gives process-level isolation, an independent
  CSP/navigation policy, and a clean boundary that escape tests can target. The final choice is
  recorded as an open question (`OQ-015`) and must be validated by escape tests (`TEST-017`,
  `TEST-018`), never assumed secure.

### 11.8 Testing boundaries

- Repo-level projects (`fixtures/`) with synthetic HTML/CSS/JS for every edge case.
- Parser and Sync modules are pure and tested without a running app.
- FS Adapter is tested in the main process against a temporary directory (and fault-injected).
- Main-process IPC handlers and the preload API are unit/integration tested in isolation.
- UI is component-tested; full journeys run as Electron E2E with Playwright (Section 15).

### 11.9 Independently developable modules

These can be built and tested in parallel once interfaces are fixed:
parsers (4,5), sync (12), history (13), FS adapter (3), analyzer (17), token discovery (16).
The canvas (7), selection (8), DnD (9), and inspector (10) share the model and are more coupled;
they proceed after the model interface stabilizes.

---

## 12. MVP Scope

The MVP is deliberately the **smallest product that proves the core loop**:
`open real project -> render -> select -> edit -> write back to real files -> verify in a browser`.

### 12.1 In scope (MVP)

| Area | Included |
|---|---|
| Desktop shell | Window, menu, open/close project, settings (basic), packaged Windows build. |
| Explorer | Open folder, list files, open HTML/CSS/JS in the code editor, detect external changes, safe handling of missing files. |
| Canvas | Render the real site in a sandboxed preview, click-select, selection outline, selection↔layer sync (basic tree). |
| Inspector | Edit text + supported attributes; edit common CSS (typography, color/background, spacing, border, dimensions); class management; show originating rule; responsive editing for the three presets. |
| Code editor | HTML/CSS/JS with highlighting, find/replace, markers, save/reload, reflect in preview. |
| Sync engine | Parse with anchors, minimal patch write-back, atomic save + backups, conflict prompt, loop prevention, formatting/comment preservation, single-step undo/redo for model+source. |
| Responsive | Three presets, real media queries, active breakpoint indication. |
| A11y | Advisory: alt text, accessible names, form labels (FR-J01..03). |
| Local-first | Offline, no account, no telemetry, external-resource policy (block-first). |
| Components | A small **curated, draggable palette** (a handful of semantic blocks) sufficient to prove insert/reorder/move via DnD (FR-D is P0 in basic form). |
| Tokens | Read-only display of existing CSS custom properties in the inspector. |

### 12.2 Deferred (explicitly not in MVP)

- Full component authoring/references (FR-I01), token editing (FR-I02/I04), large component library.
- Full Flexbox/Grid visual editors (FR-E05) and advanced cascade editing.
- Project-wide search (FR-F02 P1), multi-entry awareness (FR-G11).
- Crash recovery durability beyond best-effort (FR-A04b P1) - aim to include a minimal version.
- Accessibility checks beyond J01-J03.
- Any AI feature (FR-L*).

### 12.3 Explicit exclusions (out of scope entirely for now)

Accounts, cloud sync, collaboration, publishing/hosting, Figma replacement, framework-specific
editing, proprietary runtime, CMS/database, payments, plugin marketplace.

### 12.4 Dependencies (MVP)

- Phase 0 proof that surgical write-back preserves formatting (else the thesis fails).
- Stable model interface + source anchor strategy.
- Preview sandbox proven to isolate untrusted code.
- Atomic write + backup primitive in the Electron main process (Node.js).
- A curated component set that maps to clean semantic markup.

### 12.5 Major MVP risks

See Section 17. The dominant risks are `RISK-001` (sync/patch corruption) and `RISK-002`
(preview sandbox escape), both of which are Phase 0 gates.

### 12.6 MVP acceptance tests

See Section 19 (`AC-###`). The end-to-end gate is `AC-010`: a project edited visually in Astra
then opened in an ordinary browser (and inspected in a normal code editor / git diff) shows the
expected change and nothing else.

### 12.7 Effort estimate (provisional, assumption-laden)

**Assumptions:** one experienced full-stack developer (strong TS/Node) working solo, or a
two-person team for roughly half the calendar time; familiar with Electron/Monaco/parse5/PostCSS.

| Workstream | Solo estimate (dev-days) | Notes |
|---|---|---|
| Phase 0 prototypes (parse/patch/round-trip, sandbox) | 8-15 | Highest uncertainty; may exceed |
| Shell + build + installer | 6-10 | Electron packaging + CI signing unknowns |
| FS adapter + watcher + atomic writes | 6-10 | Main-process (Node) heavy |
| Model + parsers + addressing | 8-15 | Core |
| Canvas + sandbox + selection/layer tree | 8-15 | Overlay/protocol fiddly |
| Inspector (schema-driven editing) | 8-15 | Breadth of properties |
| Code editor integration | 4-8 | Monaco offline bundling |
| Sync engine (patch/conflict/undo) | 15-25 | The core risk; overlaps Phase 0 |
| Responsive + breakpoint editing | 5-10 | Depends on CSS editing |
| Basic DnD + palette | 6-12 | Validation + indicators |
| A11y advisory (3 checks) | 4-8 | Heuristics |
| Tests, fixtures, hardening | 10-20 | Continuous |
| **Total (rough)** | **~90-160 dev-days** | Optimistic-to-realistic band; not a guarantee |

**Uncertainty statement:** these estimates are not commitments. Phase 0 results can shift them
by a wide margin, especially if surgical write-back proves harder than assumed.

### 12.8 Definition of done (MVP)

See Section 20 (`DoD-###`).

---

## 13. Product Roadmap

The roadmap prioritizes **technical validation of the HTML/CSS synchronization engine** before
broad UI investment.

### Phase 0 - Technical validation and architectural prototypes (gate for everything)
- **Deliverables:** (a) a parser+patch prototype proving byte-preserving round-trip on messy
  HTML/CSS fixtures; (b) a sandbox prototype proving the preview cannot reach desktop commands;
  (c) an atomic-write + backup primitive; (d) a documented model/addressing proposal.
- **Prerequisites:** Repo scaffold, CI skeleton.
- **Acceptance:** Round-trip test suite passes on the fixture corpus (including malformed HTML,
  comments, exotic formatting); a deliberate escape attempt from the preview fails; atomic write
  survives fault injection.
- **Risks:** Preservation fidelity (`RISK-001`), sandbox assumptions (`RISK-002`).
- **Testing:** Parser fixtures, round-trip/preservation tests, sandbox escape tests, fault injection.
- **Exit:** Written go/no-go with evidence. No-go triggers a redesign of the sync strategy.

### Phase 1 - Desktop foundation and project loading
- **Deliverables:** Electron shell (window, menu, settings), main-process FS service + watcher, explorer, project
  manager + entry detection, packaged build.
- **Prerequisites:** Phase 0 exit.
- **Acceptance:** Open/close a real folder; files listed; external change detected; missing files
  handled; installer runs offline.
- **Risks:** Windows packaging/signing; watcher reliability.
- **Testing:** FS integration tests, E2E open-project, manual installer run.
- **Exit:** A user can open a project folder and browse files reliably.

### Phase 2 - Canvas and basic visual editing
- **Deliverables:** Sandboxed canvas rendering real CSS/JS; click-select; selection outline;
  basic layer tree; read-only inspector origin display.
- **Prerequisites:** Phase 1.
- **Acceptance:** Render parity with the same file in a browser for supported features; selection
  sync works both ways; unsupported elements are read-only and preserved.
- **Risks:** Preview/build mismatch; overlay style leakage.
- **Testing:** Render-parity snapshots, selection E2E, sandbox tests.
- **Exit:** A user can see and inspect their real site.

### Phase 3 - Source synchronization and safe saving
- **Deliverables:** Property editing (text/attributes/common CSS) writing to source via minimal
  patches; atomic save + backups; conflict prompt; loop prevention; undo/redo across model+source;
  code editor wired to the same model.
- **Prerequisites:** Phase 2, Phase 0 prototype hardened.
- **Acceptance:** Every supported edit produces exactly one debounced, atomic, byte-preserving
  write; external conflict never silently overwrites; undo/redo restores source.
- **Risks:** `RISK-001`, conflict races (`RISK-006`).
- **Testing:** Preservation, conflict, rapid-edit, undo/redo, failed-save suites.
- **Exit:** MVP core loop works end-to-end (`AC-010`).

### Phase 4 - Drag-and-drop and responsive editing
- **Deliverables:** Curated draggable palette; insert/move/reorder with indicators and validation;
  responsive presets with media-query-aware editing; active breakpoint UI.
- **Prerequisites:** Phase 3.
- **Acceptance:** DnD operations are single undoable steps with correct markup; responsive edits
  land in the correct media query; invalid drops are rejected with a message.
- **Risks:** DnD precision, validation completeness, breakpoint inference.
- **Testing:** DnD E2E, validation unit tests, responsive E2E.
- **Exit:** Visual construction of simple layouts is reliable.

### Phase 5 - Components, design tokens, accessibility
- **Deliverables:** User-defined reusable components (portable storage); token management;
  accessibility analyzer expansion (headings, contrast, keyboard advisories).
- **Prerequisites:** Phase 4.
- **Acceptance:** Components update all references and remain browser-openable without Astra;
  tokens apply project-wide; a11y findings are advisory and never auto-apply.
- **Risks:** Storage-format design (`OQ-010`), scope creep.
- **Testing:** Component/reference tests, token tests, a11y rule tests.
- **Exit:** Design-system features are usable without breaking portability.

### Phase 6 - Optional local AI and advanced features
- **Deliverables:** Provider adapter (local model via Ollama, optional hosted), reviewable diff-based
  AI actions, advanced layout editors, non-Windows builds.
- **Prerequisites:** Phase 5.
- **Acceptance:** All AI actions require explicit approval; no shell execution; disabling AI leaves
  the product fully functional.
- **Risks:** Privacy, cost, non-determinism.
- **Testing:** Approval-gate tests, provider adapter tests, offline-with-AI-disabled tests.
- **Exit:** AI is additive and reviewable.

---

## 14. Security and Privacy

Astra's threat model assumes **project files are untrusted**. Opening a project must never grant
that project privileges over the machine.

### 14.1 Assets and trust boundaries

- **Trusted:** Astra's own code, its bundled dependencies, the main window UI.
- **Untrusted:** project HTML/CSS/JS, remote resources referenced by the project, imported
  component/token JSON, and any external text.
- **Boundary 1:** Astra UI renderer vs. preview renderer (strongest boundary); the main process is
  the only privileged context.
- **Boundary 2:** app vs. filesystem (scoped to the project root).
- **Boundary 3:** app vs. network (off by default for project resources; no egress in core).

### 14.2 Threats and mitigations

| ID | Threat | Mitigation |
|---|---|---|
| SEC-001 | Malicious project files (HTML/CSS/JS) execute in the app context and call privileged IPC. | Project code loads only in an isolated preview renderer (Section 11.7) with `nodeIntegration: false`, `contextIsolation: true`, and no privileged preload/IPC; project code is never executed in the Astra UI renderer or the main process. Escape tests (`TEST-017`, `TEST-028`) gate this. |
| SEC-002 | Preview JS reaches the Astra UI or main process and steals data or escalates privileges. | Separate preview renderer with no shared DOM and no privileged bridge; validated, versioned postMessage for inspection only; navigation/new-window denied. Escape tests (`TEST-017`, `TEST-029`). |
| SEC-003 | Filesystem access escapes the project root. | Command-only fs surface; canonicalize + prefix-check; reject `..` and symlink escapes; scoped custom protocol for preview assets. |
| SEC-004 | Path traversal via crafted asset references or file names. | Normalize and validate every path against the root; reject non-UTF-8/odd names gracefully. |
| SEC-005 | External resource loading leaks data or executes remote script. | CSP on the preview; default policy blocks remote resources; explicit opt-in with a visible indicator; never silently fetch. |
| SEC-006 | Dependency vulnerabilities. | Minimal pinned dependencies; `npm audit` (and `npm audit signatures` where applicable) in CI; review before adding deps; bundle assets locally (no CDN). |
| SEC-007 | Accidental source-code corruption by buggy patching. | Surgical range patches + preservation tests; atomic writes; backups in `.astra/backups/`; validation re-parse before commit; never write if post-check fails. |
| SEC-008 | Conflicting external modifications cause data loss. | Hash-based change detection; conflict prompt; no automatic overwrite when both sides changed; compare view before committing. |
| SEC-009 | AI-generated code introduces vulnerabilities or applies unwanted changes. | AI is opt-in and review-only: changes shown as diffs, applied on approval; no shell execution; provider adapter is the only egress and is user-configured. |
| SEC-010 | Telemetry/privacy leakage. | No telemetry by default; local-only diagnostics; opt-in export; network capture test asserts no egress. |
| SEC-011 | Malicious import data (components/tokens JSON). | Schema-validate imports; reject unknown/oversized structures; treat imported strings as text, never `eval`; never execute imported templates. |
| SEC-012 | `eval`/dynamic code execution of project content inside Astra. | Explicit prohibition: Astra never `eval`s project code; rendering happens in the isolated preview only. |
| SEC-013 | Symlink escape from the project root. | Resolve symlinks (canonicalize) and re-check containment; optionally refuse to follow symlinks outside the root. |
| SEC-014 | Data loss on interrupted save. | Temp-file + fsync + atomic rename; `NFR-007` fault-injection tests. |
| SEC-015 | Insecure renderer configuration regresses during development. | Enforce and test `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true` for the UI and preview renderers; the effective config is asserted by automated tests (`TEST-028`). |
| SEC-016 | IPC payloads are not validated; a renderer sends forged input. | Validate every IPC payload in the main process (channel allowlist, schema, types, project handle, path containment); reject unknown channels; never trust renderer-supplied paths (`TEST-027`). |
| SEC-017 | The preload exposes too much to the renderer. | Allowlisted, typed `contextBridge` API only; never expose `ipcRenderer`, `require`, `process`, dynamic channel names, or Node built-ins (`TEST-030`). |
| SEC-018 | Unexpected navigation, new windows, or OS permission prompts. | Deny unexpected `will-navigate`/new-window requests; deny OS permission requests by default; open external links only through an explicit, user-confirmed handler (`TEST-029`). |
| SEC-019 | Arbitrary shell/process execution from renderer content. | No renderer path can spawn processes or run shell commands; the main process exposes no such channel; the preview has no process access at all. |
| SEC-020 | Malformed or malicious project files crash or exploit parsers. | Treat all project content as untrusted; bound parser inputs; fail safe (read-only / last-good render) instead of crashing; malformed and malicious fixtures in tests (`TEST-033`). |
| SEC-021 | Insecure auto-update channel. | Updates are opt-in, signature-verified, and delivered over TLS; a compromised update channel must not silently install code; disabled by default (Section 10.6). |
| SEC-022 | Local-first/privacy posture regressed by hidden egress. | No telemetry; no egress on core paths; egress only via explicit, user-configured features; verified by a network-capture test (`TEST-021`). |

### 14.3 Permission separation summary

| Capability | Main process | Astra UI renderer | Preview renderer |
|---|---|---|---|
| Privileged IPC (filesystem, dialogs) | Yes (validated, allowlisted) | Via the narrow preload bridge only | **No** |
| Node.js APIs | Yes | **No** (`nodeIntegration: false`) | **No** |
| Read project files | Yes (scoped) | Via main-process IPC | Read-only via scoped protocol |
| Write project files | Yes (scoped, atomic) | Via main-process IPC | **No** |
| Network egress | Governed by policy | Blocked by default | Governed by FR-K04 policy/CSP |
| Access to OS APIs | Yes (dialogs, window) | Minimal (window controls) | **No** |

### 14.4 Required Electron hardening settings (normative)

These settings are mandatory for the UI and preview renderers unless a documented exception is
approved:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` (where supported and appropriate)
- `webSecurity: true` (never disable)
- A restrictive **Content Security Policy** on rendered documents.
- **IPC:** `ipcMain.handle` handlers validate every payload; channels are allowlisted; no dynamic
  channel names; `ipcRenderer` is never exposed to the renderer.
- **Preload:** only a small, typed `contextBridge` API; no Node built-ins, no `require`, no `process`.
- **Navigation:** block navigation away from the app/served origin; deny new windows and unexpected
  external URLs; deny OS permission requests by default.
- **Filesystem:** confined to the user-approved project root, with canonicalization and containment
  checks (Section 11.6).
- **No shell execution** from renderer content and no `eval` of project code (SEC-012).
- **No silent destructive edits:** writes are atomic/recoverable and destructive actions require
  explicit user confirmation (Section 11.6).

Normative reference: Electron's official security documentation (security checklist and process
model) is the baseline. Where it conflicts with any statement in this PRD, the stricter control
applies. A compromised renderer must not be able to reach privileged APIs merely because the main
process runs locally - isolation is enforced by process and configuration boundaries, not by
assumption.

### 14.5 Privacy posture

No account, no cloud, no telemetry by default, no hidden egress. Diagnostics live only on the
machine. Any future networked feature is opt-in, disclosed, and disableable, and the core product
remains fully functional offline.

---

## 15. Testing Strategy

Testing prioritizes the **sync engine and preservation** because corruption is the highest-impact
failure. Tooling: Vitest (unit/integration), Playwright with Electron support (E2E against the real
app), main-process integration tests for the filesystem/IPC service, plus fault injection.

### 15.1 Test layers

- **Unit:** pure functions (patch computation, cascade resolution, validation rules,
  breakpoint selection, hash/compare logic).
- **Parser tests:** fixture-driven; assert parse -> re-emit byte-equality for unmodified content.
- **Synchronization tests:** given (source, operation), assert exact resulting source and
  round-trip stability (idempotence: applying the same model yields no further diff).
- **Filesystem integration tests:** temp-dir projects; atomic write, backup, watcher events,
  locked-file behavior, disk-full simulation.
- **Main-process and preload API tests:** IPC handler authorization/validation and the exposed
  `contextBridge` surface, tested in isolation.
- **UI tests:** component-level behavior of inspector, tree, palette ordering.
- **End-to-end tests:** full user journeys (Section 6) against the real Electron app (main +
  preload + renderer + preview).
- **Security tests:** sandbox escape attempts, IPC/input validation, navigation/window blocking,
  path traversal, external resource policy, import validation, no-egress assertion.
- **Packaging smoke tests:** the packaged Windows build launches, opens a project, saves, and exits
  offline.
- **Manual verification:** render-parity, installer, and SmartScreen behavior on real Windows
  machines.

> [!note] Electron E2E
> Playwright can launch and drive an Electron app directly. Strategy: run full user journeys against
> the real Electron app (main + preload + renderer + preview); keep fast unit/component tests for
> logic; and retain a small set of pure-browser tests for UI-only flows. OS-level behaviors
> (installer, SmartScreen, native dialogs) remain manual verification.

### 15.2 Required test cases (with IDs)

| ID | Case | Expectation |
|---|---|---|
| TEST-001 | Malformed HTML (unclosed tags, stray `<`, mis-nested) | Parse best-effort; on save, unmodified ranges byte-identical; no corruption; UI warns. |
| TEST-002 | Unsupported CSS (unknown at-rules, `@layer`, nesting, browser hacks) | Preserved verbatim outside edits; no rewrite. |
| TEST-003 | Comment preservation (HTML/CSS/JS comments) | Comments retained byte-identically after unrelated edits. |
| TEST-004 | Formatting preservation (indentation, CRLF/LF, quote style) | Byte-identical except the edited range; new value matches local style. |
| TEST-005 | Rapid edits (many changes within debounce window) | Exactly one atomic write per settled state; no interleaving; final file correct. |
| TEST-006 | Undo/redo sequences (mixed model+source) | Model and source both restore; no orphaned diffs. |
| TEST-007 | External file change while clean | Silent reload; toast; no data written. |
| TEST-008 | External file change while dirty | Conflict prompt; no auto-overwrite; each resolution path honored. |
| TEST-009 | Failed save (read-only file, disk full, locked file) | Original intact; dirty buffer retained; clear error; retry/Save-As offered. |
| TEST-010 | Missing/deleted open file | No crash; buffer preserved; Save-As works. |
| TEST-011 | Round-trip idempotence | Parse->model->emit equals input; repeated sync yields no diff. |
| TEST-012 | Infinite-loop guard | Edit produces single write; watcher does not re-trigger an edit. |
| TEST-013 | Insert/move/delete via DnD | Correct markup; single undo step; validation rejects invalid nesting. |
| TEST-014 | Responsive edit routing | Property lands in correct media query; canvas matches browser at threshold. |
| TEST-015 | Class edit + origin attribution | `class` attribute patched; inspector shows originating rule file/selector. |
| TEST-016 | Render parity vs. browser | Supported features match an ordinary browser screenshot within tolerance. |
| TEST-017 | Sandbox escape (project JS attempts IPC/parent access) | Attempt fails; no privileged call; app unaffected. |
| TEST-018 | Path traversal (`../../`) via asset/protocol | Blocked; error surfaced; no file read outside root. |
| TEST-019 | External resource policy | Blocked by default; opt-in loads with indicator; CSP enforced. |
| TEST-020 | Import validation (component/token JSON) | Malformed/oversized input rejected; no code execution. |
| TEST-021 | No network egress during core flows | Network capture shows no outbound traffic. |
| TEST-022 | Offline full suite | All MVP acceptance tests pass with network disabled. |
| TEST-023 | Large file (5 MB) open | Opens without freeze or with documented read-only fallback. |
| TEST-024 | Large tree (~5,000 nodes) editing | No UI block > 200 ms in scripted scenario. |
| TEST-025 | Accessibility advisory correctness | Flagged/missed cases match the documented heuristic; never auto-applies. |
| TEST-026 | Atomicity under kill | File content is old or new, never partial. |
| TEST-027 | IPC input validation (malformed/forged payloads, traversal via IPC) | Main process rejects invalid payloads and unknown channels; no out-of-root access; no crash. |
| TEST-028 | Renderer hardening config | Automated assertion that UI and preview renderers run with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`; no Node globals in the preview. |
| TEST-029 | Navigation and new-window blocking | The preview cannot navigate away, open new windows, or trigger OS permission prompts. |
| TEST-030 | Preload surface | Only the allowlisted API is exposed; `ipcRenderer`/`require`/`process` are absent. |
| TEST-031 | Packaging smoke test (Windows x64) | The packaged build launches, opens a project, saves atomically, and exits, offline. |
| TEST-032 | Renderer crash recovery | A forced renderer crash does not lose saved data and the UI recovers (`NFR-017`). |
| TEST-033 | Malformed/malicious project handling | Bounded parsing; no crash; read-only/last-good fallback; no privileged call. |

### 15.3 Coverage and gates

- Sync + parser + preservation suites are **release-blocking** for Phases 0 and 3.
- Security tests (`TEST-017`..`TEST-021` and `TEST-027`..`TEST-030`) are release-blocking for every phase.
- Coverage targets are provisional: aim for high branch coverage on parser/sync modules; UI
  coverage measured by journey completion rather than a percentage (`ASM-001`).

---

## 16. Success Metrics

Each metric states what it demonstrates and how it is measured. Vanity metrics (downloads,
waitlist size) are intentionally omitted.

| ID | Metric | Demonstrates | Measurement |
|---|---|---|---|
| SM-001 | Supported-edit save success rate >= 99.9% | Core loop correctness | Automated suite + (opt-in) local counters; ratio of applied edits verifiable in a browser. |
| SM-002 | Source-corruption rate = 0 across the acceptance suite | Data integrity / trust | Preservation + round-trip + atomicity tests (`NFR-010`, `TEST-011`, `TEST-026`). |
| SM-003 | Project-open success rate >= 98% on a corpus of real sites | Compatibility breadth | Open N representative real-world folders; count successes and reasons for failure. |
| SM-004 | Preview consistency (render parity) >= 95% of inspected elements match a browser | Fidelity | Automated screenshot/element comparison on a fixture corpus. |
| SM-005 | Undo/redo reliability = 100% in the suite | Editing safety | `TEST-006` pass rate; no state divergence. |
| SM-006 | Median edit-task time (e.g. "change heading text + color") <= 15 s | Productivity | Timed task study (n>=10) vs. baseline of hand-editing in a code editor. |
| SM-007 | Offline feature coverage = 100% of MVP features usable offline | Local-first promise | `TEST-022` pass rate with network disabled. |
| SM-008 | MVP acceptance-test pass rate = 100% before MVP sign-off | Release readiness | Section 19 suite green. |
| SM-009 | Zero outbound network during core flows | Privacy promise | `TEST-021` capture clean. |
| SM-010 | Conflict handling: 0 silent overwrites in concurrent-writer tests | Data integrity | `TEST-007/008` pass; logs show prompts, not auto-writes. |
| SM-011 | Crash-free session rate >= 99% over scripted soak | Reliability | Automated soak runs. |
| SM-012 | Formatting-preservation pass rate = 100% on the fixture corpus | Code ownership quality | `TEST-003/004/011` pass. |

Notes: percentages are provisional targets to be calibrated after Phase 0. Metrics that require
user data (SM-006) must be collected locally/consensually or in dedicated studies, never via
hidden telemetry.

---

## 17. Risks and Mitigations

Probability (P) and Impact (I) use Low/Medium/High. Validation methods specify how each risk is
retired or bounded.

| ID | Risk | P | I | Mitigation | Validation |
|---|---|---|---|---|---|
| RISK-001 | Synchronization/write-back corrupts source (formatting, comments, unsupported syntax). | High | High | Surgical range patches; source anchors; preservation tests; validate-before-write; backups; refuse edits that require rewriting unsupported syntax. | Phase 0 round-trip corpus; `TEST-001`..`TEST-004`, `TEST-011`, `TEST-016`. |
| RISK-002 | Preview isolation fails; project code reaches desktop privileges. | Medium | High | Separate preview renderer with no privileged preload/IPC; scoped read-only protocol; CSP; navigation/window denial; no-eval; escape tests. | `TEST-017`, `TEST-018`, `TEST-028`, `TEST-029` must fail to escape. |
| RISK-003 | Sync engine too complex; scope explodes; MVP slips badly. | High | High | Restrict MVP to plain HTML/CSS/JS, a bounded property set, one active page + linked stylesheets; defer components/tokens. | Phase 0 go/no-go; MVP scope review. |
| RISK-004 | Render parity mismatch between the Astra preview and target browsers. | Medium | Medium | Use the real engine (the Chromium version pinned with Electron); document supported features; parity snapshots; degrade gracefully. | `TEST-016`, `SM-004`. |
| RISK-005 | Electron packaging or E2E automation issues block reliable delivery. | Medium | Medium | Pin the Electron version; use prebuilt binaries; packaging smoke tests in CI; keep a browser fallback for UI-only flows. | Phase 1 packaging/E2E spike (`OQ-013`). |
| RISK-006 | Conflict races (external edit + Astra edit) cause loss. | Medium | High | Hash-based detection; conflict prompt; compare view; no auto-overwrite. | `TEST-007`, `TEST-008`, `SM-010`. |
| RISK-007 | Users find the tool unable to edit their real (messy/complex) projects. | Medium | High | Preservation-first design; read-only for unsupported constructs; open real corpora in Phase 1. | `SM-003`, `SM-004`. |
| RISK-008 | Dependency vulnerabilities or supply-chain issues. | Medium | Medium | Minimal pinned deps; `npm audit` in CI; no remote asset loading. | `npm audit` gates; `TEST-021`. |
| RISK-009 | Windows packaging/signing issues (SmartScreen warnings). | Medium | Low/Medium | Early CI packaging spike; document unsigned behavior; pursue signing. | Phase 1 installer test (`OQ-011`). |
| RISK-010 | Performance collapse on large projects. | Medium | Medium | Virtualized trees; lazy loading; debounced parsing; large-file fallback. | `TEST-023`, `TEST-024`, NFR-004/005. |
| RISK-011 | Users misinterpret advisory a11y/none-auto-apply behavior. | Low | Medium | Clear "advisory only" labeling; never auto-fix; explain suggested fixes. | `TEST-025`, usability review. |
| RISK-012 | AI (later) introduces non-determinism/privacy concerns. | Medium | Medium | Opt-in only; provider adapter; diff-review gate; no shell; core works without it. | Phase 6 tests. |
| RISK-013 | Over-scoping toward a Figma/IDE replacement. | Medium | Medium | Explicit non-goals; enforce MVP scope decisions. | Roadmap reviews. |
| RISK-014 | Data loss from crash before autosave. | Medium | Medium | Best-effort recovery journal/backups (`FR-A04b`). | Crash-recovery test. |
| RISK-015 | Electron resource footprint (memory, distribution size) hurts low-end machines or adoption. | Medium | Medium | Measured targets (`NFR-004`, `NFR-018`); lazy preview initialization; reuse a single preview renderer; document the footprint. | `NFR-004`, `NFR-018`, `TEST-023`. |

---

## 18. Assumptions and Open Questions

### 18.1 Assumptions (provisional defaults; revisit)

| ID | Assumption | Impact if wrong |
|---|---|---|
| ASM-001 | All performance/success numbers are provisional until measured; "smooth" is replaced by measurable targets. | Targets may be unrealistic; recalibrate after Phase 0. |
| ASM-002 | No database is needed; files + a small config store suffice. | May need an index for very large projects (add only if measured). |
| ASM-003 | MVP targets plain HTML/CSS/JS, one active page + its linked stylesheets. | Multi-page/global sync grows complexity (already P1 via FR-G11). |
| ASM-004 | Windows x64 with a pinned, bundled Chromium (Electron) is the only MVP platform. | Cross-platform later requires re-validating fs, watcher, and packaging. |
| ASM-005 | Users accept `style`-attribute avoidance: edits prefer stylesheet rules by default. | Some users prefer inline; the policy is configurable (FR-G10). |
| ASM-006 | A curated DnD palette is enough for MVP even though full library/component authoring is deferred. | If not, MVP scope for DnD must be re-examined. |
| ASM-007 | Accessibility findings should be advisory and never auto-apply. | If users demand auto-fix, add explicit, reviewable batch fixes later. |
| ASM-008 | Monaco can be bundled fully offline without a CDN. | If not, offline promise (FR-K01) is at risk; use a different local editor. |
| ASM-009 | The MVP dependency set ships prebuilt binaries, so no native compiler (MSVC/Windows SDK) is required; this is confirmed by attempting the build. | If a native addon is introduced, build-tool requirements change and must be documented. |

### 18.2 Open questions (with provisional defaults so nothing blocks)

| ID | Question | Provisional default |
|---|---|---|
| OQ-001 | Does a market gap for visual editing of *existing* projects actually exist at the assumed size? | Assume yes; validate with 10-15 interviews before Phase 2. |
| OQ-002 | Do design-to-code users want visual editing of production code, or only handoff? | Assume yes for a subset (Personas B/C/E); segment later. |
| OQ-003 | How do users expect "the project" to be identified (single folder vs. multi-root)? | Single folder per project. |
| OQ-004 | Is source ownership a real switching driver or just a nice-to-have? | Assume a real driver for the target segment; measure retention. |
| OQ-005 | How much preprocessor/framework support is needed early (SCSS, TS, JSX)? | None in MVP; list files, treat as text, mark non-editable. |
| OQ-006 | When a visual edit cannot be expressed safely in source, block or approximate? | Block with a clear explanation; never approximate silently. |
| OQ-007 | Single project open at a time, or multiple? | Single in MVP; multi-root later if demanded. |
| OQ-008 | Is a full three-way merge needed for conflicts? | Line/text compare in MVP; 3-way later if needed. |
| OQ-009 | How to pick the "right" stylesheet when creating a rule? | Prefer the stylesheet linked closest to the element's page; remember the user's choice per project. |
| OQ-010 | What portable format for components/tokens? | CSS custom properties + documented HTML/JSON; decide in Phase 5. |
| OQ-011 | Will releases be code-signed? | Assume unsigned initially; document; pursue a certificate. |
| OQ-012 | Future monetization that does not gate core editing? | Keep core free/offline; any paid tier is optional and additive. |
| OQ-013 | Is Playwright's Electron support sufficient for E2E, and which packaging tool (Electron Forge vs. electron-builder) do we standardize on? | Assume Playwright + Electron for app flows; choose the packaging tool in Phase 1. |
| OQ-014 | How are runtime-generated DOM nodes represented (read-only vs. hidden)? | Read-only in the tree; never written to source. |
| OQ-015 | Is a separate preview renderer or a sandboxed iframe the better isolation model? | Assume a separate Electron renderer; validate with escape tests (`TEST-017`, `TEST-018`). |

---

## 19. Acceptance Criteria (MVP)

These are testable end-state criteria for MVP sign-off. "Ordinary browser" means a normal
browser opening the project from disk without Astra.

| ID | Acceptance criterion |
|---|---|
| AC-001 | Opening a folder containing `index.html` renders the site in the canvas; closing leaves no handles open. |
| AC-002 | Render parity: for the fixture corpus, inspected elements match an ordinary browser within the defined tolerance for supported features. |
| AC-003 | Clicking a rendered element selects it, draws an outline, and updates both inspector and layer tree within 100 ms (P95). |
| AC-004 | Editing text/attributes and common CSS (typography, color/background, spacing, border, dimensions) updates the canvas and, on save, the source. |
| AC-005 | Every supported edit results in exactly one atomic, byte-preserving write; the git diff contains only the intended change plus formatting consistent with local style. |
| AC-006 | Editing source in the code editor updates the canvas within <= 400 ms without restarting the app. |
| AC-007 | Undo/redo reverts/restores both model and source per logical user action; no divergence remains after a full sequence. |
| AC-008 | Comments, unsupported syntax, and formatting outside edited ranges are byte-identical after edits (`TEST-003/004/011`). |
| AC-009 | External edits are detected; clean documents reload, dirty documents prompt a conflict with no automatic overwrite. |
| AC-010 | **End-to-end gate:** a site edited visually in Astra then opened in an ordinary browser shows the expected result and nothing else (`SM-001`, `SM-002`). |
| AC-011 | Failed saves (locked/read-only/disk-full) never corrupt the file; the dirty buffer persists and recovery options are offered. |
| AC-012 | Responsive presets resize the canvas; property edits route into the correct media query; existing media queries behave exactly as in a browser. |
| AC-013 | Basic drag insert/move/reorder works with clear indicators and HTML-nesting validation; invalid drops are rejected with a message. |
| AC-014 | Advisory a11y checks (alt text, accessible name, form label) flag issues, select the element on click, and never modify source. |
| AC-015 | With networking disabled, all MVP flows work; enabling networking does not cause silent egress. |
| AC-016 | The preview cannot call privileged IPC or reach the main process/UI renderer; path-traversal and navigation attempts are blocked (`TEST-017/018/027/029`). |
| AC-017 | A packaged Windows build installs and runs offline on a clean Windows 10/11 machine. |

---

## 20. Definition of Done

### 20.1 MVP Definition of Done

| ID | Item |
|---|---|
| DoD-001 | All MVP acceptance criteria (AC-001..AC-017) pass in CI where automatable and in manual verification otherwise. |
| DoD-002 | Release-blocking suites green: parser/preservation, sync, atomicity, security, and Electron hardening/IPC (`TEST-001`..`TEST-021` and `TEST-027`..`TEST-033`). |
| DoD-003 | Zero known source-corruption defects; zero silent-overwrite defects. |
| DoD-004 | Documentation: user guide (open/edit/save), sync behavior + policies (styles vs. inline, formatting), and a "what Astra will not touch" list. |
| DoD-005 | A packaged, installable Windows build exists and runs offline; install/launch verified on a clean machine. |
| DoD-006 | Rendering parity documented: supported vs. unsupported features are explicitly listed. |
| DoD-007 | Security review completed: preview isolation, renderer hardening, IPC validation, path handling, external resources, import validation, no egress (`SEC-001`..`SEC-022` reviewed). |
| DoD-008 | TypeScript strict + lint clean across main, preload, and renderer; module dependency graph has no core cycles (`NFR-010`). |
| DoD-009 | Offline E2E suite passes with networking disabled (`TEST-022`). |
| DoD-010 | Provisional performance targets (NFR-001..NFR-005) measured and either met or explicitly renegotiated with evidence. |
| DoD-011 | `.astra/` metadata is provably non-essential: deleting it does not break the project. |
| DoD-012 | No telemetry; local diagnostics only; verified by network capture (`TEST-021`). |

### 20.2 Phase exit definitions

Each roadmap phase (Section 13) defines its own deliverables, acceptance, testing, risks, and
exit conditions; a phase is done only when its acceptance criteria and its release-blocking tests
pass, and no new release-blocking risk is left unmitigated without an explicit, documented decision.

---

## Appendix A - Requirement ID Index

| Area | IDs |
|---|---|
| Desktop app | FR-A01..FR-A06 |
| Explorer | FR-B01..FR-B07 |
| Canvas | FR-C01..FR-C06 |
| Drag & drop | FR-D01..FR-D06 |
| Inspector | FR-E01..FR-E09 |
| Code editor | FR-F01..FR-F05 |
| Sync engine | FR-G01..FR-G11 |
| Responsive | FR-H01..FR-H05 |
| Components/tokens | FR-I01..FR-I04 |
| Accessibility | FR-J01..FR-J06 |
| Local-first | FR-K01..FR-K06 |
| Optional AI | FR-L01..FR-L02 |
| Non-functional | NFR-001..NFR-018 |
| UI/UX | UX-001..UX-008 |
| Security | SEC-001..SEC-022 |
| Testing | TEST-001..TEST-033 |
| Success | SM-001..SM-012 |
| Risks | RISK-001..RISK-015 |
| Assumptions/Questions | ASM-001..ASM-009, OQ-001..OQ-015 |
| MVP acceptance | AC-001..AC-017 |
| Definition of done | DoD-001..DoD-012 |

---

## Appendix B - Glossary

| Term | Meaning |
|---|---|
| Source anchor | Byte offset range in the original file that a parsed node corresponds to. |
| Surgical patch | A textual edit applied only to the exact range(s) an operation affects, leaving the rest byte-identical. |
| Document Model | Astra's in-memory, addressed projection of project files used for editing and diffing. |
| Preview sandbox | The isolated rendering context where untrusted project code runs with no desktop privileges. |
| Self-write | A disk write performed by Astra, tagged so the watcher does not treat it as an external change. |
| Arrow / loop prevention | Logic ensuring an Astra edit does not trigger a reparse that itself produces another edit. |
| Entry point | The HTML file Astra renders as the active page (default `index.html`). |
| Token | A reusable design value (color, font, spacing) expressed as a CSS custom property or documented config. |
| Advisory (a11y) | A finding shown to the user that Astra never applies automatically. |

---

## Appendix C - Explicit Non-Implementation Notice

To restate the document's status: **Astra's application logic has not been implemented.** The
project directory (`D:\code-web\Astra`) contains at most a project scaffold (tooling and
dependencies); no feature described here is built or tested. This PRD is planning material intended
to guide architecture, implementation planning, and acceptance testing. Nothing in this document
should be read as evidence that a requirement has been built or tested. When implementation begins,
this document must be reconciled with a supplied visual reference (if provided) and updated as
measurements replace the provisional targets above.
