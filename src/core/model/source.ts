/**
 * Source-range primitives shared by the parser and sync layers.
 *
 * Astra never re-serialises a document. During Phase 0 exploration we measured
 * that parse5 and PostCSS both lose or reorganise bytes on real-world input
 * (leading whitespace, orphan closing tags, fostered table text). The only
 * strategy that survives that is: keep the original text, record where every
 * node lives inside it, and splice edits into those ranges.
 *
 * These helpers give that strategy a precise vocabulary. `SourceRange` is a
 * half-open `[start, end)` window into a document; `Segment` is a window that
 * is owned either by a node or by nothing at all. See PRD §13 (Phase 0).
 */

/** A half-open window `[start, end)` into a document's source text. */
export interface SourceRange {
  /** Zero-based offset of the first byte. */
  readonly start: number;
  /** Zero-based offset directly after the last byte. */
  readonly end: number;
}

/**
 * A slice of the document that is owned by exactly one thing.
 *
 * `node` means a parsed node can be re-emitted (and patched) from this range.
 * `gap` means no node claims it: the parser dropped those bytes (whitespace
 * before `<html>`, a stray `</head>`, a doctype swallowed after a BOM). Gaps
 * are still emitted verbatim, which is what keeps the round-trip lossless.
 */
export interface Segment extends SourceRange {
  readonly owner: "node" | "gap";
}

/** Clamps a value into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** True when two ranges share at least one byte. */
export function rangesOverlap(a: SourceRange, b: SourceRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True when `inner` is fully contained in `outer`. */
export function rangeContains(outer: SourceRange, inner: SourceRange): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/** Number of bytes in a range. */
export function rangeLength(range: SourceRange): number {
  return range.end - range.start;
}

/**
 * Turns a bag of ranges into an ordered, gap-free partition of `[0, length)`.
 *
 * Overlapping ranges are coalesced: a wider range that starts first wins the
 * bytes it shares with a later one. Callers that cannot tolerate that (the
 * HTML classifier, for example) resolve overlaps before calling in and treat
 * this as a last line of defence.
 */
export function buildPartition(ranges: readonly SourceRange[], length: number): Segment[] {
  const clamped = ranges
    .map((range) => ({
      start: clamp(range.start, 0, length),
      end: clamp(range.end, 0, length),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const range of clamped) {
    if (range.start > cursor) {
      segments.push({ start: cursor, end: range.start, owner: "gap" });
    }
    const start = Math.max(cursor, range.start);
    if (range.end > start) {
      segments.push({ start, end: range.end, owner: "node" });
      cursor = range.end;
    }
  }

  if (cursor < length) {
    segments.push({ start: cursor, end: length, owner: "gap" });
  }

  return segments;
}

/**
 * Asserts that `segments` is a contiguous, non-overlapping partition of the
 * document. Returns the gaps it found so callers can report them.
 *
 * @throws If the segments are empty, out of order, overlapping, or do not
 * cover `[0, length)` exactly.
 */
export function assertPartition(segments: readonly Segment[], length: number): SourceRange[] {
  if (segments.length === 0) {
    if (length === 0) return [];
    throw new Error(`Partition is empty but the document is ${length} bytes long.`);
  }

  const first = segments[0];
  const last = segments[segments.length - 1];
  if (first === undefined || last === undefined || first.start !== 0) {
    throw new Error("Partition does not start at offset 0.");
  }
  if (last.end !== length) {
    throw new Error(`Partition ends at ${last.end} but the document is ${length} bytes.`);
  }

  const gaps: SourceRange[] = [];
  let cursor = 0;
  for (const segment of segments) {
    if (segment.start !== cursor) {
      throw new Error(`Partition is not contiguous: expected ${cursor}, found ${segment.start}.`);
    }
    if (segment.end <= segment.start) {
      throw new Error(`Partition contains an empty segment at ${segment.start}.`);
    }
    if (segment.owner === "gap") {
      gaps.push({ start: segment.start, end: segment.end });
    }
    cursor = segment.end;
  }

  return gaps;
}
