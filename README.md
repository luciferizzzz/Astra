# Astra

> **Design visually. Own your code.**

Astra is a local-first desktop application for designing websites visually while editing the
**real source code** (HTML/CSS/JS). No account, no mandatory cloud, no proprietary format.
Your files stay readable, portable and Git-friendly.

Windows 10/11 · Electron 44 · React 19 + TypeScript + Vite

---

## Status

**Phase 0 ✅ and Phase 1 ✅ — sync engine validated, desktop foundation complete
(all 5 deliverables), Windows installer verified.**

This repository contains the byte-preserving synchronisation engine (`src/core/`), the hardened
Electron shell, the project-loading pipeline (scoped filesystem + watcher + explorer + entry
point detection) and a self-contained NSIS installer. The visual canvas and the editing loop
(Phase 2+) from the PRD roadmap **are not implemented yet**.

Everything below has been verified end-to-end on Windows:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm run test` | 283 passing, 24 files |
| `npm run build` | 3 processes emitted (renderer 622.36 kB) |
| `npm run test:e2e` | 19 passing against the real Electron shell |
| `npm run dev` | renders cleanly (required for every slice to be called done) |
| `npm run make` | `release/Astra Setup 0.1.0.exe` — 106.55 MB, fully self-contained |
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

- **Node.js** LTS + npm
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
│   │   └── validation.ts     #   IPC payload validation
│   ├── preload/              # contextBridge allowlist → window.astra
│   │   ├── index.ts
│   │   └── api.ts            #   typed bridge contract (source of truth)
│   ├── renderer/             # React app
│   │   ├── index.html
│   │   └── src/
│   ├── shared/               # used by all three processes
│   │   ├── ipc.ts            #   channel names + payload types
│   │   └── csp.ts            #   dev / prod Content-Security-Policy
│   └── core/                 # pure TS: model, parsers, sync, history, lib
├── tests/                    # Vitest unit tests
├── e2e/                      # Playwright (real Electron shell)
├── .github/workflows/ci.yml  # CI skeleton
└── docs/                     # PRD (EN / ID)
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
- The preload publishes only `window.astra.ping()` / `window.astra.getAppVersion()`
- Every IPC payload is validated on arrival and rejected by type, not coerced

The E2E suite asserts these rather than trusting them: it checks that `require`, `module`,
`process` and `ipcRenderer` are all `undefined` inside the renderer, and that a validated IPC
round trip still works across the sandbox boundary.

> The sandboxed preview iframe (PRD §11.2) will need its **own** separately-scoped policy. It must
> not be added by loosening `frame-src` on this one.

---

## Known Debt

- **No application icon** — electron-builder falls back to the default Electron icon (visible in
  the build log and in the installer).
- **No linter** — ESLint is not wired up yet (PRD NFR-010, §10.5).
- **No `CHANGELOG.md` in this repo** — the changelog lives in the project vault for now.
- **Node version drift** — CI runs Node 22 while local development uses Node 24.
- **8 moderate npm advisories** — the `sprintf-js` chain pulled in via `electron-builder`
  → `app-builder-lib` → `@electron/get` → `global-agent` → `roarr`. Dev-only tooling, no patched
  version exists, and the shipped asar contains no `node_modules` at all. CI blocks on
  `--audit-level=critical`; revisit when `@electron/get` >= 5 ships.
- **`docs/PRD.md` and `docs/PRD.id.md`** are copies of the vault PRDs, which remain authoritative.

---

## Principles

- **Sovereignty** — your files and machine are the source of truth.
- **Composability** — modular, standard web tech, minimal dependencies.
- **Security** — untrusted projects, sandboxed preview, least-privilege filesystem.
- **Code Ownership** — readable, portable, Git-friendly output.
