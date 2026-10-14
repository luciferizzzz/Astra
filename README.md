# Astra

> **Design visually. Own your code.**

Astra is a local-first desktop application for designing websites visually while editing the
**real source code** (HTML/CSS/JS). No account, no mandatory cloud, no proprietary format.
Your files stay readable, portable and Git-friendly.

Windows 10/11 · Tauri 2 · React + TypeScript + Rust

---

## Status

**Foundation / planning.** Application logic has not been implemented yet — this repository
currently contains the scaffold, dependency setup and tooling (Phase 0). See the PRD for the
full plan and the vault notes for the roadmap.

---

## Tech Stack

| Area | Choice |
| --- | --- |
| Desktop shell | Tauri 2 |
| Frontend | React 19 + TypeScript + Vite |
| Native backend | Rust |
| Code editor | Monaco |
| HTML parser | parse5 |
| CSS parser | PostCSS |
| Drag & drop | dnd-kit |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| Unit tests | Vitest |
| E2E tests | Playwright |

---

## Prerequisites

- **Node.js** LTS + npm
- **Rust** toolchain (rustup / cargo) — required to build and run the Tauri backend
- **WebView2 Runtime** (preinstalled on Windows 11)
- **Git**

> Rust is required to run `npm run tauri:dev` / `npm run tauri:build`. The frontend
> (`npm run dev`, `npm run build`, `npm run test`) works without Rust.

---

## Getting Started

```bash
npm install          # install dependencies
npm run dev          # frontend only (Vite, http://localhost:1420)
npm run tauri:dev    # full desktop app (requires Rust)
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (port 1420) |
| `npm run build` | Type-check + production frontend build |
| `npm run typecheck` | TypeScript only (`tsc --noEmit`) |
| `npm run test` | Vitest (unit / parser / sync) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright (browser harness) |
| `npm run tauri:dev` | Run the desktop app (requires Rust) |
| `npm run tauri:build` | Build the Windows installer (requires Rust) |

---

## Project Structure

```text
astra/
├── src/                    # React + TypeScript frontend
│   ├── components/         # editor, toolbar, panels, canvas, ui
│   ├── model/              # internal document model & addressing
│   ├── parsers/            # html (parse5), css (postcss)
│   ├── sync/               # synchronization engine, patching, conflicts
│   ├── history/            # undo/redo
│   ├── store/              # zustand state
│   ├── lib/                # utilities, IPC wrappers
│   └── styles/             # Tailwind entry + design tokens
├── src-tauri/              # Rust backend (Tauri 2)
│   ├── src/                # commands: fs, watcher, hashing, atomic write
│   └── capabilities/       # least-privilege capability config
├── tests/                  # Vitest unit tests
├── e2e/                    # Playwright tests
├── fixtures/               # synthetic test projects
└── docs/                   # PRD and engineering docs
```

---

## Principles

- **Sovereignty** — your files and machine are the source of truth.
- **Composability** — modular, standard web tech, minimal dependencies.
- **Security** — untrusted projects, sandboxed preview, least-privilege filesystem.
- **Code Ownership** — readable, portable, Git-friendly output.
