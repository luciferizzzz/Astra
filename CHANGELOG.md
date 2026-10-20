# Changelog

All notable changes to Astra are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **No release yet.** Everything below is unreleased development work:
> the foundation scaffold, Phase 0 (sync engine + hardened preview), and
> Phase 1 (Electron shell + project filesystem, closed 2026-10-19 with a
> verified NSIS installer). The project vault carries the full narrative
> changelog; this file is its repo-side mirror.

## [Unreleased]

### Phase 1 — debt cleanup (2026-10-20)

#### Added

- **Application icon** — `resources/icon.ico` (256/128/64/48/32/16, generated from
  `src/renderer/src/assets/Astra-logo-png.png` by `scripts/make-icon.ps1`). electron-builder
  consumes the `.ico` directly, so packaging needs no icon-conversion tool download. The dev
  window points at it too; packaged windows inherit it from the executable.
- **ESLint** (PRD NFR-010) — flat config `eslint.config.mjs`: `@eslint/js` + typescript-eslint
  recommended + `eslint-plugin-react-hooks`; `npm run lint` script, wired into CI before typecheck.
- **`CHANGELOG.md`** — this file; the vault changelog stays authoritative for the full narrative.

#### Changed

- **CI Node aligned with development** — workflows run Node 24 (was 22), matching local
  v24.11.1; `engines.node >= 24` in `package.json` pins the contract.
- **Advisories 8 moderate → 0** — `overrides.global-agent: ^4.1.3` cuts the
  `roarr → sprintf-js` chain pulled in via `electron-builder → app-builder-lib → @electron/get`.
  `sprintf-js` has no patched release; global-agent 4 drops it while keeping the exact API
  `@electron/get` calls (`bootstrap()`, same `GLOBAL_AGENT_*` env vars). Drop the override when
  electron-builder moves to `@electron/get` >= 5.

#### Fixed

- `StatusBar` no longer calls `setState` synchronously inside its effect (the absent-bridge case
  is decided in the state initializer), and `project-store` no longer dead-initializes `picked`.

### Phase 1 — installer NSIS, Phase 1 closed (2026-10-19)

Closed the last Phase 1 deliverable, **#5 "packaged Windows build"**: the NSIS installer was
built and the install cycle fully verified on the development machine. Commit `3fe976e`.
Gates: typecheck clean · vitest 283/283 · Playwright 19/19 · production build · `npm run make` ·
`npm run dev` verified clean.

#### Added

- **NSIS installer** — `npm run make` → `release/Astra Setup 0.1.0.exe` (106.55 MB) + `.blockmap`;
  SHA256 `364A483689A1B84D3A8BB31C6636C5B42331DAC0C20FF66E088420AF63A6F5B0`. Fully
  self-contained (Electron bundled; no download step in the install script) — not a web downloader.
- **Install-cycle verification (AC-017, DoD-005)** — silent `/S` per-user install (exit 0) →
  app installed and running (window "Astra", 4 processes, `settings.json` written correctly) →
  **0 outbound TCP connections** across all app processes during boot + render → silent uninstall
  with no residue (folder, Start Menu, registry, desktop shortcut all zero).

#### Changed

- **README Status section** — replaced the stale 15 Oct snapshot with the real state:
  Phase 0 ✅ + Phase 1 ✅, gate numbers, installer cycle row, known debt list.

#### Notes

- `electron-builder.yml` unchanged (NSIS, `oneClick: false`, per-user, `npmRebuild: false`) —
  the slice was build + verify + document only. Installer artifacts stay out of Git
  (distribution is via GitHub Release).
- Acceptance "external changes detected" honestly remains half: manual confirmation + write
  conflict resolution belong to Phase 3.

### Phase 1 — project manager & entry-point detection (2026-10-18)

Closed Phase 1 deliverable **#4**: the `index.html` entry page is detected and openable from
the toolbar. Commits `c872992` (+ `dff550f`, + `8319a5b`).
Gates: typecheck clean · vitest 283/283 · Playwright 19/19 · build OK · `npm run dev` clean.

#### Added

- **Pure entry-point detection** (`src/shared/entry-point.ts`) — `detectEntryPoint(entries)`:
  `index.html` → `index.htm`, case-insensitive, files only, root entries only. 9 unit tests.
- **`entryPoint` in the project store** — derived from the root listing (recomputed on open,
  hydrate and fs-event refresh), adding no IPC channel; `openEntryPoint()` opens it through the
  existing read-only path.
- **Entry affordance in the Header** — `Entry: index.html` button, or `No entry page` when a
  project has no entry.
- **Tests** — 9 unit + store/shell/e2e additions (including a `plain-project` fixture).

#### Fixed

- **Explorer wiring never committed** — `23b9f5e` shipped only 7 files; `src/main/*`,
  `src/preload/*`, `shared/ipc` and Header/Sidebar/CodeEditor/AppLayout lived only in the
  working tree for two sessions. Completed by `dff550f` and re-gated (269/269 + 17/17).
  Lesson: gates read the working tree, never the commit — `git show --stat` before vault sync.
- **`.gitignore` patterns ineffective** — three vitest lines had been written UTF-16 by
  PowerShell, making Git treat the file as binary. Rewritten as UTF-8 in `8319a5b`.

### Phase 1 — explorer (2026-10-18)

Closed Phase 1 deliverable **#3**: project-open flow from UI to file tree. Commit `23b9f5e`
(+ `dff550f`). Gates: typecheck clean · vitest 269/269 · Playwright 17/17 · build OK · dev clean.

#### Added

- **Native folder picker** (`pickProjectFolder`) + live Open/Close Project menu items.
- **Project store** — hydrate, open/close, lazy expansion, file selection, fs-events
  (reload on change, keep content on delete, cache pruning, notices).
- **FileTree ARIA** — `role="tree"`, per-directory lazy expansion, text/image icons.
- **Read-only file opening** into the CodeEditor; Sidebar shows the tree or an
  "Open a project folder" invitation; window title = folder name.

### Phase 1 — FS adapter, watcher & project session (2026-10-18)

Closed Phase 1 deliverable **#2**: the scoped filesystem window plus the sync engine's sensor
half. Commit `dd16ace`. Gates: typecheck clean · vitest 252/252 · Playwright 15/15 · build OK ·
dev clean.

#### Added

- **Scoped FS adapter** (`src/main/project-paths.ts`, `src/main/project-fs.ts`) — one canonical
  project root (`realpath`); renderer paths are *normalized into a contract* (absolute, drive
  letters, UNC, `..`, NUL rejected by name — SEC-003, SEC-013); containment checked at the
  nearest existing ancestor; hashes always over bytes on disk; atomic write with `expectedHash`
  guard → `WriteConflictError` (FR-G08); `node_modules`/`.git`/`.astra` ignored (FR-K02).
- **External-change watcher** (`src/main/project-watcher.ts`) — OS events are only wakeups;
  truth comes from rescan snapshot-diff (natural polling fallback); Astra's own writes
  (announced by hash) are swallowed (FR-G06) with a `beginWrite`/`endWrite` window.
- **Project session** (`src/main/project-session.ts`) — one open project (OQ-007); opening
  another replaces it; self-writes announced automatically.
- **7 IPC channels** — `projectOpen/Close/List/ReadFile/WriteFile/GetState` (invoke) +
  `projectFsEvent` (push); single source of truth in `src/shared/ipc.ts`; traversal rejected at
  the boundary (SEC-019).
- **Tests** — 88 new unit tests + `e2e/project.spec.ts` (5) through the real preload.

### Perbaikan: dev server memuat dua instance React (2026-10-17)

Commit `8a45640`. Gates: typecheck clean · vitest 164/164 · Playwright 10/10 · build OK.

#### Fixed

- **Dev server loaded two React generations** — `main.tsx` referenced two optimizer outputs at
  once, so zustand and react-dom imported two React copies → "Invalid hook call" on every boot.
  Fixed by declaring the whole React + zustand graph in `optimizeDeps.include` (with
  `resolve.dedupe` as a safety net). Unit, build and e2e never caught it — all three bypass the
  dev-server path. Lesson: green gates ≠ app runs; "done" requires running the app.
- **Menu flakiness** — `installApplicationMenu()` queued behind `await settings.read()`;
  it needs neither settings nor window and is now installed before anything is awaited.

### Phase 1 — application menu & settings (2026-10-17)

Closed Phase 1 deliverable **"shell Electron (window, menu, settings)"**: built-in menu (FR-A02)
and per-user persistent settings (FR-A05). Commit `c535eb6`.
Gates: typecheck clean · vitest 164/164 · Playwright 10/10 · build OK.

#### Added

- **Application menu** (`src/main/menu.ts`) — File/Edit/View/Help as pure data (unit-testable
  without Electron); features that do not exist yet render **disabled, not hidden**;
  Settings/Exit/About/viewport presets (Ctrl+1/2/3)/panel and preview toggles (Ctrl+P) live;
  Reload/DevTools dev-only.
- **Menu → renderer command bus** over `astra:menu:command`.
- **Settings contract** (`src/shared/settings.ts`) — theme, font size, autosave interval,
  telemetry (off by default, FR-K03), formatting policy (FR-G09), external-resource policy
  (FR-K04); lenient normalization on read, strict validation on update.
- **Persistent settings store** (`src/main/settings-store.ts`) — `userData/settings.json` via the
  Phase 0 atomic write; missing/corrupt file falls back to defaults without blocking startup.
- **Settings surface** — `SettingsDialog` + store; opened from menu, toolbar, `Ctrl+,`, sidebar tab.
- **Dark/light semantic theme** — `--color-fg*` tokens, `[data-theme="light"]` +
  `prefers-color-scheme` for "system"; window background follows the stored theme.

#### Notes

- `role: "help"` is labelled **"Window"** by Windows — caught by e2e, fixed by removing the role.

### Phase 1 — editor shell & visual tree (2026-10-17)

First Phase 1 slice: separated the **visual tree** from the byte-preserving source model and
broke the renderer shell into real editor regions. Commit `d75c817`.
Gates: typecheck clean · vitest 108/108 · Playwright 6/6 · build OK.

#### Added

- **`src/core/model/visual.ts`** — `VisualNode`/`VisualDocument` as a read-only projection over
  `HtmlDocumentModel`: deterministic path-based ids, `parentId` + `depth`, pre-order flat index,
  `editable` flag derived from parser trust (implied & unsupported → read-only), breadcrumb and
  labels. No bytes; never mutates the source model.
- **Editor shell** — `AppLayout` composes Header, Sidebar, Inspector, Canvas, CodeEditor,
  StatusBar; `App.tsx` is a thin mount.

### Phase 0 — synchronization engine spikes (2026-10-16)

`src/core/` filled: byte-preserving source model, HTML/CSS parsers with trust guards, surgical
patch, atomic write (backup + lock + conflict), hardened preview.
Gates: typecheck OK · vitest 92/92 · Playwright 6/6. Commit `6068ba1`.

#### Added

- **Source model** (`src/core/model/source.ts`, `src/core/parsers/{html,css}.ts`) —
  byte-preserving round-trip on the fixture corpus (malformed HTML, foster parenting, comments,
  IE hacks). No bytes lost or reordered.
- **Surgical patch** (`src/core/sync/patch.ts`) — each edit is one small `SourceEdit`;
  `unsupported` nodes are rejected at the last line of defence (FR-G05).
- **Atomic write** (`src/core/sync/atomic-write.ts`) — temp → fsync → rename, backup,
  `WriteConflictError` on hash mismatch, lock serialisation + stale-lock recovery.
- **Hardened preview** — `src/main/preview.ts` and friends: in-memory partition, no preload;
  escape tests prove the preview cannot reach the desktop.
- **Artifacts** — `docs/spikes/phase-0-model-and-addressing.md`,
  `docs/spikes/phase-0-go-no-go.md` (decision **GO**), `fixtures/`, `e2e/sandbox.spec.ts`,
  the `ASTRA_E2E` seam.

#### Fixed

- `changedRegion` made minimal (common prefix/suffix include equal characters).
- E2E seam moved to module scope so `app.evaluate` is not skipped before `whenReady`.

### Migrasi Electron (2026-10-15)

Scaffold moved from **Tauri 2 + Rust** to **Electron + Node** (ADR-001), in place, history
preserved. **Phase 0 prerequisites complete**: repo scaffold ✅ + CI skeleton ✅.
Commits `ca4d4d7`, `129ffa7`, `d452de8`, `1fc6c58`.

#### Changed

- **Desktop framework:** Tauri 2 → **Electron 44** (ADR-001). Operational reason: the
  Rust + MSVC + Windows SDK toolchain (~6.7 GB on C:) had to be rolled back, so
  `tauri dev` could never run.
- **Structure:** 4 layers — `src/main`, `src/preload`, `src/renderer`, `src/core` (pure TS) +
  `src/shared` (dependency-free, shared by all three processes).
- **Testing:** Playwright e2e now drives a **real Electron shell** (`_electron`).
- **Config:** `*.mts` extensions because `"type": "module"` is deliberately absent
  (`sandbox: true` requires a CommonJS preload).
- `docs/PRD.md` + `docs/PRD.id.md` synced from the vault PRDs (Tauri references 85 → 4).

#### Added

- **Window hardening** (PRD §14.4): `nodeIntegration: false`, `contextIsolation: true`,
  `sandbox: true`, `webSecurity: true`; build-time CSP; renderer origin allowlist;
  navigation/window-open denial; IPC payload validation; narrow preload allowlist.
- **`electron-builder.yml`** — NSIS, `npmRebuild: false` ⇒ no `node-gyp`/MSVC/Windows SDK.
- **Unit tests** — 50 tests / 5 files; **e2e** — 4 tests including empirical proof of a
  renderer without Node and an IPC round trip across the sandbox boundary.
- **CI skeleton** (`.github/workflows/ci.yml`) — typecheck → unit → e2e → package (no artifact
  upload) + dependency-audit job (SEC-006, blocking at `--audit-level=critical`).
- **Release workflow** (`release.yml`) — on `v*` tags: NSIS installer + `SHA256SUMS.txt` →
  draft release.
- **CI live on GitHub** — 2 successful runs; **e2e 4/4 on `windows-latest`** ⇒ RISK-005 refuted.

#### Removed

- All of `src-tauri/` (24 files), `public/`, root `index.html`, `vite.config.ts`,
  `tsconfig.node.json`, and every Tauri dependency.

#### Fixed

- **Production CSP never applied** — `String.replace` only replaced the first occurrence and the
  `index.html` comment carried the same token first; now `replaceAll`.
- **`src/preload/index.d.ts` silently dropped by TypeScript** (basename clash with `index.ts`)
  → global `window.astra` declaration moved to `src/renderer/src/env.d.ts`.
- **Asar size 110.81 MB → 1.52 MB** — `!node_modules/**` (the renderer is Vite-bundled).

### Foundation (2026-10-14)

Project foundation: planning (PRD + vault notes) and the **code scaffold**. No app logic.

#### Added

- **PRD Astra** (English + Indonesian) in the project vault.
- **Vault note structure** — `Projact/Astra/` (Documentation, Roadmap, Development, Ideas,
  Changelog, Release, Bugs) + `Astra Index`.
- **Code scaffold** — React 19 + TypeScript + Vite; `zustand`, `@dnd-kit/*`, Monaco,
  `parse5`, `postcss`; Tailwind CSS v4, Vitest + jsdom + Testing Library, Playwright;
  path aliases; `docs/PRD.md` + `docs/PRD.id.md`.
- **Security:** `dompurify ^3.4.17` override (Monaco pinned a vulnerable version).

#### Notes

- All performance targets & estimates are **provisional**.
- The Rust toolchain install was **rolled back** (disk full) before the Electron migration
  made it moot.
