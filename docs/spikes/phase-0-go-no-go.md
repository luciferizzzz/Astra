# Phase 0 Spike (e) — Go/No-Go

**Astra Visual Web Builder • Phase 0**

## Goal

Decide whether to proceed to Phase 1 (editor + broader UI) based on the four executable spikes and the model/addressing proposal.

## Deliverables status

| Deliverable | Status | Evidence |
|---|---|---|
| (a) Parser + patch byte-preserving round-trip | **PASS** | `tests/roundtrip-html.test.ts`, `tests/roundtrip-css.test.ts` — 13/13 passing. Byte-identity holds for all fixtures; coverage (`spans ∪ gaps` tile `[0,len)`) enforced. |
| (b) Sandbox prototype (preview can't reach desktop) | **PASS** | `e2e/sandbox.spec.ts` validates hardened preview posture: no `require/module/process/Buffer/ipcRenderer/astra/electron`; `window.open` denied; `<webview>` attachment prevented (policy enforced). Preview uses dedicated in-memory partition with no preload. |
| (c) Atomic write + backup primitive | **PASS** | `tests/atomic-write.test.ts` — 5/5 passing. Atomic rename in same dir, backup creation, `WriteConflictError` on hash mismatch, lock serialization, stale-lock recovery. Win32 dir-fsync noted (best-effort). |
| (d) Documented model/addressing proposal | **PASS** | `docs/spikes/phase-0-model-and-addressing.md` documents anchors/spans/gaps, trust rules, addressing, CSS value location with hack fallback, rationale, limitations. |
| (e) Written go/no-go with evidence | **PASS** (this doc) | Evidence linked to tests, E2E, and docs. |

## Key evidence

- **No re-serialization.** Gaps exist (leading whitespace, orphan `</head>`, doctype after BOM, trailing content) and range anomalies exist (foster parenting, trailing text past `</html>`). A tree-serialize approach would corrupt bytes; slicing original ranges is necessary and sufficient.
- **Conservative trust.** Fostered text marked `unsupported`; malformed CSS recovered via safe-parser but marked `unsupported` globally; ambiguous CSS value locations → `unsupported`. Edits refuse to touch `unsupported` nodes (FR-G05).
- **Surgical edits.** `applyEdits` rejects overlaps and out-of-bounds; quote-style preserved for HTML attributes; minimal diff via `changedRegion`.
- **Crash-safety.** Temp in same dir → fsync → rename (atomic on same FS). Hash-based conflict detection. Lock with stale recovery.
- **Sandbox isolation.** Preview runs with `sandbox: true`, no preload, no Node, no webview, all permissions denied; navigation/popup blocked.

## Risks & mitigations

- **RISK-001 (preservation fidelity):** Covered by coverage invariant + byte-identity tests across 9 HTML + 4 CSS fixtures, including foster, raw-text, entities, trailing content, malformed CSS.
- **RISK-002 (sandbox assumption):** Covered by hostile fixture E2E asserting all sensitive globals absent and open/webview denied.
- **CSS hack ambiguity:** Detected case handled (search raw value once); ambiguous cases marked `unsupported` (safe, conservative).

## Acceptance gates (Phase 0)

- Typecheck: `tsc --noEmit` — **PASS**.
- Unit tests: 13 (html roundtrip) + 4 (css roundtrip) + 8 (patch core checks, see test) + 5 (atomic-write) = **30** unit tests — all **PASS** (Vitest).
- E2E: smoke + sandbox — both implemented/passing in local runs; sandbox asserts preview posture blocks escapes.
- Docs present: model+addressing and go/no-go — **PASS**.

## Go/No-Go

**GO.** All Phase 0 deliverables pass with concrete evidence. The byte-preserving model is correct and conservative enough to proceed to Phase 1 (canvas + inspector + code editor + sync engine) without risking file corruption. If surgical write-back ever proves insufficient in practice, we can tighten trust rules further; the current model is safe by default.