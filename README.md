# Astra

> **Design visually. Own your code.**

Astra is a local-first desktop application for designing websites visually while editing the
**real source code** (HTML/CSS/JS). No account, no mandatory cloud, no proprietary format.
Your files stay readable, portable and Git-friendly.

Windows 10/11 · Electron 44 · React 19 + TypeScript + Vite

---

## Status

**Phase 0 ✅ · Phase 1 ✅ · Phase 2 ✅ (S1–S5, 2026-10-26) — desktop foundation, project
pipeline and a sandboxed visual canvas.**

This repository contains the byte-preserving synchronisation engine (`src/core/`), the hardened
Electron shell, the project-loading pipeline (scoped filesystem + watcher + explorer + entry
point detection), a self-contained NSIS installer, and a **read-only visual canvas**: the real
project is rendered in an isolated `WebContentsView`, and clicking it selects an element, draws
an outline and drives the layer tree and inspector (both directions).

Phase 3 — the editing loop (edit → source mapping → minimal patch → atomic save → undo/redo) —
**is not implemented yet**. Astra opens, renders and navigates a project; it never writes to one.

Everything below has been verified end-to-end on Windows:

| Gate | Result |
| --- | --- |
| `npm run lint` | 0 problems |
| `npm run typecheck` | 0 errors |
| `npm run test` | 314 passing, 25 files |
| `npm run build` | 3 processes emitted |
| `npm run test:e2e` | 28 passing against the real Electron shell |
| `npm run dev` | renders cleanly (required for every slice to be called done) |
| `npm run make` | `release/Astra Setup 0.1.0.exe`, fully self-contained |
| installer cycle | silent install → boots with **0 outbound TCP connections** → silent uninstall, all residue removed |


---

## Tech Stack

| Area | Choice |
| --- | --- |
| Desktop shell | Electron 44 (main / preload / renderer) |
| Frontend | React 19 + TypeScript + Vite 8 |
| Build | electron-vite 6 |
| Packaging | electron-builder 26 (NSIS) |
| Code editor | Monaco |
| HTML parser | parse5 |
| CSS parser | PostCSS + postcss-safe-parser |
| Drag & drop | dnd-kit |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| Unit tests | Vitest 5 |
| E2E tests | Playwright (`_electron`) |

---

## Prerequisites

- **Node.js** 24+ (LTS, pinned by `engines` — CI runs the same major) + npm
- **Git**

That is the whole list.

> **No Rust, no MSVC, no Windows SDK.** Astra has no native addons, so `npmRebuild: false` is set
> in `electron-builder.yml` and packaging never invokes `node-gyp`. A dependency that requires a
> compiler toolchain to install is a rejection, not a setup step (PRD ASM-009).

---

## Getting Started

```bash
npm install          # install dependencies
npm run dev          # desktop app with HMR (renderer on http://localhost:5173)
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Electron shell + electron-vite dev server (port 5173) |
| `npm run build` | Production build of all three processes into `out/` |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run typecheck` | TypeScript only (`tsc --noEmit`) |
| `npm run test` | Vitest (unit / parser / sync) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Build, then Playwright against the real Electron shell |
| `npm run package` | Build + unpacked Windows build → `release/win-unpacked` |
| `npm run make` | Build + NSIS installer → `release/` |

---

## Project Structure

Astra follows the four-layer split from PRD §11.2. Dependencies point downward only —
`src/core` imports nothing from Electron or React.

```text
astra/
├── electron.vite.config.mts  # three-process build, CSP injection
├── electron-builder.yml      # packaging (npmRebuild: false)
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          #   hardened BrowserWindow
│   │   ├── ipc.ts            #   channel registration
│   │   ├── security.ts       #   navigation / window-open denial
│   │   ├── trusted-url.ts    #   renderer origin allowlist
│   │   ├── validation.ts     #   IPC payload validation
│   │   ├── project-*.ts      #   scoped fs adapter, watcher, session, path contract
│   │   ├── canvas-view.ts    #   sandboxed preview WebContentsView
│   │   ├── preview-protocol.ts # astra-preview:// handler + MIME + CSP
│   │   └── preview-posture.ts  # preview permission / navigation policy
│   ├── preload/              # contextBridge allowlist → window.astra
│   │   ├── index.ts
│   │   └── api.ts            #   typed bridge contract (source of truth)
│   ├── renderer/             # React app
│   │   ├── index.html
│   │   └── src/
│   ├── shared/               # used by all three processes
│   │   ├── ipc.ts            #   channel names + payload types
│   │   ├── entry-point.ts    #   entry page detection
│   │   └── csp.ts            #   dev / prod Content-Security-Policy
│   └── core/                 # pure TS: model, parsers, sync, history, lib
├── tests/                    # Vitest unit tests
├── e2e/                      # Playwright (real Electron shell)
├── scripts/                  # icon generation, manual canvas probe
├── .github/workflows/ci.yml  # CI skeleton
└── docs/                     # local PRD copies (git-ignored; the vault is authoritative)
```

### Path aliases

`@/*` → `src/renderer/src/*` · `@core/*` → `src/core/*`

These are declared in **three** places that must stay in sync: `tsconfig.json`,
`electron.vite.config.mts` and `vitest.config.mts`. Drift between them compiles cleanly and only
fails at runtime.

---

## Security Posture

The hardening in `src/main/index.ts` is intentional, not decorative (PRD §14.4, SEC-001..022):

- `nodeIntegration: false` · `contextIsolation: true` · `sandbox: true` · `webSecurity: true`
- Restrictive CSP injected at build time — production sets `script-src 'self'` and `frame-src 'none'`
- The renderer may only load one URL (packaged `file://`, or the dev server in `npm run dev`)
- Navigation and window creation outside that URL are denied
- The preload publishes a typed allowlist on `window.astra` (app, settings, project, canvas) —
  no generic filesystem, shell or process access, and no renderer-side `ipcRenderer`
- Every IPC payload is validated on arrival and rejected by type, not coerced
- The project filesystem is contained to one open folder: paths are normalised against a
  contract (absolute, `..`, drive and UNC forms are rejected by name), then re-checked with
  `realpath` against the canonical root, so symlink escapes fail for reads *and* creates
- The canvas is a separate `WebContentsView` on the `astra-preview` partition, with its own
  `astra-preview://` protocol handler and its **own** CSP — `frame-src 'none'` on the UI
  renderer is never loosened, and the preview holds no Node, bridge, filesystem or network
  privilege

The E2E suite asserts these rather than trusting them: it checks that `require`, `module`,
`process` and `ipcRenderer` are all `undefined` inside the renderer, that a validated IPC
round trip still works across the sandbox boundary, that the preview cannot navigate away or
open a window, and that the preview CSP actually blocks an outbound `fetch` while still serving
the project's own CSS/JS/SVG with correct MIME types.

---

## Known Debt

- **Editing does not exist yet.** Save / Save All and undo/redo are deliberately disabled rather
  than lying; `astra:project:write-file` is implemented and validated but no renderer code calls
  it. That is Phase 3 (PRD loop: edit → source mapping → patch → atomic save + conflict → history).
- **No auto-reload on external change.** The watcher emits `fs-event`, but the canvas is not
  re-rendered when a file changes on disk underneath it.
- **TEST-016 (pixel parity) is partial.** Structural parity and computed-style parity are asserted;
  cross-engine (level 3) screenshot parity is deferred to post-MVP.
- **`node_modules` advisories** are monitored rather than patched: the bundled Node.js in
  Electron 44.7.2 predates the 21 Oct 2026 Node advisories. No code path in `src/` uses the
  affected APIs (`https`/`http` request, Brotli decode); upgrade only when an Electron release
  explicitly lists a Node.js security update.

Paid down 2026-10-20: application icon (`resources/icon.ico`, generated by
`scripts/make-icon.ps1`), ESLint (`npm run lint`, gated in CI), `CHANGELOG.md`, Node drift
(CI now runs 24 like development, pinned by `engines`), and the 8 moderate npm advisories
(`overrides.global-agent: ^4.1.3` cuts the `roarr → sprintf-js` chain — `npm audit` reports
0; drop the override when electron-builder moves to `@electron/get` >= 5).

Paid down 2026-11-02: `.gitignore` encoding (a UTF-16 block had made the file unreadable as
text and duplicated entries) and the 4 lingering `npm run lint` errors, which came from a local
one-off scratch script outside the project.

---

## Principles

- **Sovereignty** — your files and machine are the source of truth.
- **Composability** — modular, standard web tech, minimal dependencies.
- **Security** — untrusted projects, sandboxed preview, least-privilege filesystem.
- **Code Ownership** — readable, portable, Git-friendly output.
