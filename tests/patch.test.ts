import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCss } from "../src/core/parsers/css";
import { parseHtml } from "../src/core/parsers/html";
import {
  applyEdits,
  changedRegion,
  patchCssValue,
  patchHtmlAttribute,
  patchHtmlText,
  PatchError,
} from "../src/core/sync/patch";

function fixture(relative: string): string {
  return readFileSync(join(process.cwd(), "fixtures", relative), "utf8");
}

describe("applyEdits", () => {
  it("applies non-overlapping edits left to right", () => {
    expect(
      applyEdits("abcdef", [
        { range: { start: 0, end: 1 }, text: "A" },
        { range: { start: 5, end: 6 }, text: "F" },
      ]),
    ).toBe("AbcdeF");
  });

  it("inserts without consuming bytes when the range is empty", () => {
    expect(applyEdits("ab", [{ range: { start: 1, end: 1 }, text: "X" }])).toBe("aXb");
  });

  it("rejects overlapping edits instead of guessing an order", () => {
    expect(() =>
      applyEdits("abcdef", [
        { range: { start: 0, end: 3 }, text: "AAA" },
        { range: { start: 2, end: 4 }, text: "BB" },
      ]),
    ).toThrow(PatchError);
  });

  it("rejects ranges outside the document", () => {
    expect(() => applyEdits("abc", [{ range: { start: 5, end: 6 }, text: "x" }])).toThrow(PatchError);
    expect(() => applyEdits("abc", [{ range: { start: 2, end: 1 }, text: "x" }])).toThrow(PatchError);
  });

  it("is a no-op for an empty edit list", () => {
    expect(applyEdits("abc", [])).toBe("abc");
  });
});

describe("changedRegion", () => {
  it("returns the minimal window for a single replacement", () => {
    // `H` is shared by both texts, so the window really does start at 5.
    expect(changedRegion("<h1>Hello</h1>", "<h1>Hi</h1>")).toEqual({
      before: { start: 5, end: 9 },
      after: { start: 5, end: 6 },
    });
  });

  it("returns null when nothing changed", () => {
    expect(changedRegion("same", "same")).toBeNull();
  });
});

describe("patchHtmlText", () => {
  it("escapes the new text and leaves every other byte alone", () => {
    const source = fixture("html/fragment-basic.html");
    const model = parseHtml(source);
    const heading = model.nodes.find((node) => node.kind === "text" && node.value === "Hello & welcome");
    expect(heading).toBeDefined();

    const patched = patchHtmlText(model, heading!, "Hi <there> & you");
    expect(patched).toContain(">Hi &lt;there&gt; &amp; you<");

    // Undoing the single edit reproduces the source byte for byte: proof that
    // the document outside the edited range was copied verbatim (FR-G03).
    expect(patched.replace("Hi &lt;there&gt; &amp; you", "Hello &amp; welcome")).toBe(source);

    const diff = changedRegion(source, patched)!;
    expect(patched.slice(0, diff.after.start)).toBe(source.slice(0, diff.before.start));
    expect(patched.slice(diff.after.end)).toBe(source.slice(diff.before.end));
  });

  it("refuses a node the parser marked unsupported", () => {
    const source = "<body>\ntable\n<table>\n<tr><td>x</td></tr>\ntable\n</table>\n</body>";
    const model = parseHtml(source);
    const fostered = model.nodes.find((node) => node.kind === "text" && node.trust === "unsupported");
    expect(fostered).toBeDefined();
    expect(() => patchHtmlText(model, fostered!, "y")).toThrow(PatchError);
  });
});

describe("patchHtmlAttribute", () => {
  it("keeps double quotes and changes only the value", () => {
    const source = fixture("html/fragment-basic.html");
    const model = parseHtml(source);
    const card = model.nodes.find((node) => node.tagName === "div");
    const patched = patchHtmlAttribute(model, card!, "class", "hero");

    expect(patched).toContain('class="hero"');
    const diff = changedRegion(source, patched)!;
    expect(diff.before.end - diff.before.start).toBe("card".length);
    expect(patched.slice(diff.after.start, diff.after.end)).toBe("hero");
  });

  it("keeps single quotes for a single-quoted attribute", () => {
    const source = fixture("html/fragment-basic.html");
    const model = parseHtml(source);
    const card = model.nodes.find((node) => node.tagName === "div");
    expect(patchHtmlAttribute(model, card!, "data-id", "9")).toContain("data-id='9'");
  });

  it("escapes the value for the quote that delimits it", () => {
    const source = fixture("html/fragment-basic.html");
    const model = parseHtml(source);
    const img = model.nodes.find((node) => node.tagName === "img");
    const patched = patchHtmlAttribute(model, img!, "alt", 'a "quote"');
    expect(patched).toContain('alt="a &quot;quote&quot;"');
  });

  it("reports an attribute that does not exist", () => {
    const source = fixture("html/fragment-basic.html");
    const model = parseHtml(source);
    const card = model.nodes.find((node) => node.tagName === "div");
    expect(() => patchHtmlAttribute(model, card!, "nope", "x")).toThrow(/no attribute named/);
  });
});

describe("patchCssValue", () => {
  it("replaces one declaration value and nothing else", () => {
    const source = fixture("css/valid-messy.css");
    const model = parseCss(source);
    const color = model.declarations.find((node) => node.prop === "color");
    expect(color).toBeDefined();

    const patched = patchCssValue(model, color!, "rgb(0, 0, 0)");

    expect(patched).toContain("color: rgb(0, 0, 0);");
    expect(patched).toContain("margin: calc(var(--space) * 2) 0 !important;");
    // Reversing the single edit reproduces the stylesheet exactly.
    expect(patched.replace("color: rgb(0, 0, 0);", "color: var(--accent);")).toBe(source);
  });

  it("replaces the raw value including any comments inside it", () => {
    const source = fixture("css/comments.css");
    const model = parseCss(source);
    // The fixture has two `color` declarations; this is the commented one.
    const color = model.declarations.filter((node) => node.prop === "color").at(-1)!;
    expect(color.rawValue).toContain("green");

    const patched = patchCssValue(model, color, "teal");

    // The raw value range starts at `green` and runs to the end of the comment,
    // so both move together; the `/* before value */` comment sits outside it.
    expect(patched).toContain("/* before value */ teal;");
    expect(patched).not.toContain("after value */");
    expect(
      patched.replace("/* before value */ teal", "/* before value */ green /* after value */"),
    ).toBe(source);
  });

  it("refuses a declaration from a repaired parse", () => {
    const source = fixture("css/malformed.css");
    const model = parseCss(source);
    expect(model.recovered).toBe(true);
    const declaration = model.declarations[0];
    expect(declaration).toBeDefined();
    expect(declaration!.trust).toBe("unsupported");
    expect(() => patchCssValue(model, declaration!, "red")).toThrow(PatchError);
  });
});
