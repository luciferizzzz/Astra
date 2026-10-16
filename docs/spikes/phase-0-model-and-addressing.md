# Phase 0 Spike (d) — Model and Addressing Proposal

**Astra Visual Web Builder • Phase 0**

## Summary

Phase 0 established a byte-preserving model for HTML and CSS that does not serialize the parse tree back to text. Instead we keep the original source, record byte ranges (anchors) for every editable node, capture spans and explicit gaps where the parser discards bytes, and classify nodes as `trusted` or `unsupported` when their ranges cannot be used for surgical edits (FR-G05).

This document describes the model, addressing scheme, trust rules, and why naive re-serialization is insufficient.

## Evidence (measured)

Empirical probes (stored in `C:\\Users\\ILHAM\\AppData\\Local\\Temp\\opencode\\*`) established:

- **parse5 text nodes** expose `value` (not `data`); implied elements (`html`, `head`, `body`, `tbody`) have **no sourceCodeLocation**.
- **Gaps exist** in real input: leading whitespace dropped, orphan `</head>`, orphan `</script>`, `<!DOCTYPE html>` after BOM swallowed. These bytes must be re-emitted verbatim.
- **Range anomalies** occur (foster parenting): e.g. text with `value = \"abctable\"` carries a range that spans table markup; trailing text can extend past `</html>`. The slice of such text is not equal to its decoded value when reparsed as a single text node.
- **Attribute anchors** in `startTag.attrs[name]` cover the whole `name=\"value\"` token (not just the value substring).
- **PostCSS**: `postcss.parse(src).toString()` is byte-identical for well-formed CSS (including CRLF, comments, hacks, custom properties, keyframes, empty files, no trailing newline). `postcss-safe-parser` repairs malformed input (`{` or `*/` inserted) and produces different output; therefore we must never write back its serialization.
- **Declaration value ranges**: arithmetic based on `prop.length + between` is correct in general; IE hacks (`*color`, `_color`) shift the recorded start offset. We verify by comparing the source slice to `raws.value?.raw ?? value` and, if ambiguous, fall back to locating that exact raw string inside the declaration range only when it appears exactly once.

## Data Model

### Source primitives (`src/core/model/source.ts`)

```ts
export interface SourceRange { readonly start: number; readonly end: number; } // half-open [start,end)
export interface Segment extends SourceRange { readonly owner: \"node\" | \"gap\"; }
```

`buildPartition(ranges, length)` produces an ordered, gap-free partition by coalescing overlapping node ranges and inserting `gap` segments for uncovered bytes. `assertPartition` verifies contiguous coverage of `[0, length)`.

### HTML (`src/core/parsers/html.ts`)

```ts
export interface HtmlNode {
  kind: \"document\" | \"fragment\" | \"element\" | \"text\" | \"comment\" | \"doctype\";
  tagName?: string;
  attrs?: Array<{ name: string; value: string; anchor?: SourceRange }>
  value?: string;
  children: HtmlNode[];
  anchor?: SourceRange;      // whole node when present
  startTag?: SourceRange;
  endTag?: SourceRange;
  implied: boolean;          // no location reported (synthesized)
  trust: \"trusted\" | \"unsupported\";
  notes: string[];
}

export interface HtmlDocumentModel {
  language: \"html\";
  source: string;
  root: HtmlNode;
  nodes: HtmlNode[];         // anchored nodes sorted by anchor.start
  spans: HtmlSpan[];         // trusted, non-overlapping ranges used for emit
  segments: Segment[];       // gap-free partition from spans
  gaps: SourceRange[];
  unsupported: HtmlNode[];
}
```

**Addressing (HTML):**

- Nodes are addressed by identity (the model node) plus the document model. Callers select nodes by structural predicates (e.g. `kind===\"text\" && value===\"Hello\"`, or `tagName===\"h1\"`).
- Attribute values are addressed via `attr.anchor`: the edit locates the value substring inside `name=\"value\"` by examining quotes/equals from the raw slice (preserving the original quote style).
- Element parts: `startTag` and `endTag` ranges are emitted as spans (not the whole element).

**Trust rules (HTML):**

1. Implied nodes have no `anchor`/`startTag`/`endTag` → not emitted as spans; they never receive surgical edits.
2. Text: trusted if (a) parent is a rawtext element (`script`, `style`, `textarea`, `title`, `xmp`, `iframe`, `noembed`, `noframes`, `plaintext`, `noscript`) and `slice === value`, OR (b) reparsing the anchor slice with `parseFragment` yields exactly one `#text` node whose `value === node.value`. Fostered/re-parented text fails (b).
3. Comment: slice starts with `<!--` and ends with `-->`.
4. Doctype: `/^<!doctype/i.test(slice)`.
5. Element: `startTag` slice matches `^<tagName[\\s/>]` and ends with `>`; `endTag` (if present) matches `^</tagName\\s*>$` (case-insensitive).
6. Span overlap resolution: spans sorted by start; if a span starts before current cursor (overlaps kept span), node marked `unsupported` (\"anchor overlaps another node's bytes\").

**Emission:** `emitHtml` concatenates `model.segments` in order. For unmodified models this is byte-identical to input.

### CSS (`src/core/parsers/css.ts`)

```ts
export interface CssNode {
  kind: \"root\" | \"rule\" | \"atrule\" | \"declaration\" | \"comment\";
  name?: string; selector?: string; params?: string;
  prop?: string; value?: string; rawValue?: string; important?: boolean;
  anchor?: SourceRange;
  valueAnchor?: SourceRange;   // verified slice of declaration value
  children: CssNode[];
  trust: \"trusted\" | \"unsupported\";
  notes: string[];
}

export interface CssDocumentModel {
  language: \"css\";
  source: string;
  root: CssNode;
  nodes: CssNode[];
  declarations: CssNode[];
  segments: Segment[];
  gaps: SourceRange[];
  unsupported: CssNode[];
  recovered: boolean;         // used safe-parser
  parseError?: string;
}
```

**Trust rules (CSS):**

- Strict parse first (`postcss.parse`); if it throws, `recovered = true`, tree from `postcss-safe-parser`, all nodes marked `trust = \"unsupported\"`.
- Declarations: compute `valueStart = start + prop.length + between.length`; verify slice equals `rawValue`. If mismatch (IE hacks), search for `rawValue` inside declaration slice only if it appears exactly once and after `prop.length`. Else `valueAnchor` undefined → `unsupported`.
- `anchor` required for included nodes; malformed-recovered input forces `unsupported`.

**Emission:** slice-based from `segments`. Byte-identity holds for well-formed CSS; malformed CSS emits original (never repaired string).

## Surgical edits (`src/core/sync/patch.ts`)

`SourceEdit { range: SourceRange; text: string }`. `applyEdits` sorts left-to-right, rejects out-of-bounds and overlaps (throws `PatchError`), copies untouched bytes verbatim.

High-level patchers:

- `patchHtmlText(model, node, newText)`: requires `node.kind==='text' && trusted`. Replaces `node.anchor` with `escapeText(newText)`.
- `patchHtmlAttribute(model, node, name, newValue)`: finds `attr.anchor`, detects quote style (`'`/`\"`/bare), replaces only value substring with `escapeAttributeValue(newValue, quote)`. If bare, rewrites to `name=\"...\"`.
- `patchCssValue(model, decl, newValue)`: replaces `decl.valueAnchor` with `newValue`.

`changedRegion(before, after)` returns common-prefix/suffix diff window.

## Design rationale

1. **Never re-serialize**: parse5/PostCSS may drop bytes or repair malformed input. Byte-identity is only achievable by slicing original ranges.
2. **Gaps are first-class**: orphan tags, BOM effects, dropped whitespace recorded and emitted. Coverage invariant: `spans ∪ gaps` tile `[0,len)` exactly.
3. **Trust is conservative**: fostered text, recovered CSS, or ambiguous value locations marked `unsupported` (FR-G05).
4. **Deterministic overlap handling**: earlier/kept span wins; others demoted to `unsupported`.
5. **Addressing is structural + range-based**: structural selection decoupled from offsets; ranges ground truth.

## Tests (reference)

- `tests/roundtrip-html.test.ts`: byte-identity + coverage tiling for 9 fixtures.
- `tests/roundtrip-css.test.ts`: well-formed identity+coverage, hacks, malformed (recovered emits original), comments.
- `tests/patch.test.ts`: applyEdits validation, changedRegion minimality, HTML text/attribute patches (quote-preserving), CSS value patch, unsupported node rejection.
- `tests/atomic-write.test.ts`: atomic write, backup, conflict detection, lock + stale-lock recovery.

## Limitations

- Value location fallback for CSS hacks requires raw value to appear exactly once after the property inside the declaration; pathological cases → marked unsupported (safe).
- ParseFragment-based text trust uses default fragment context (template); this is sufficient for the spike and matches measured behavior.
