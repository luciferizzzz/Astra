import { describe, expect, it } from "vitest";
import {
  PREVIEW_CSP,
  PREVIEW_ORIGIN,
  PREVIEW_SCHEME,
  PreviewUrlError,
  contentTypeFor,
  isPreviewOriginUrl,
  previewUrlFor,
  relativePathFromPreviewUrl,
  toWholePixels,
} from "../src/main/preview-protocol";

describe("previewUrlFor", () => {
  it("addresses a project-relative path on the preview scheme", () => {
    expect(previewUrlFor("index.html")).toBe(`${PREVIEW_ORIGIN}/index.html`);
    expect(previewUrlFor("css/site.css")).toBe(`${PREVIEW_ORIGIN}/css/site.css`);
  });

  it("percent-encodes each segment, so a name cannot smuggle a separator", () => {
    expect(previewUrlFor("assets/my logo.png")).toBe(`${PREVIEW_ORIGIN}/assets/my%20logo.png`);
    expect(previewUrlFor("a b/c#d.png")).toBe(`${PREVIEW_ORIGIN}/a%20b/c%23d.png`);
  });
});

describe("relativePathFromPreviewUrl", () => {
  it("round-trips what previewUrlFor produced", () => {
    for (const path of ["index.html", "css/site.css", "assets/my logo.png", "a/b/c/d.txt"]) {
      expect(relativePathFromPreviewUrl(previewUrlFor(path))).toBe(path);
    }
  });

  it("refuses a URL on another scheme", () => {
    expect(() => relativePathFromPreviewUrl("file:///C:/Windows/win.ini")).toThrow(PreviewUrlError);
    expect(() => relativePathFromPreviewUrl("https://example.com/index.html")).toThrow(
      PreviewUrlError,
    );
  });

  it("refuses a URL naming another host", () => {
    expect(() => relativePathFromPreviewUrl(`${PREVIEW_SCHEME}://elsewhere/index.html`)).toThrow(
      PreviewUrlError,
    );
  });

  it("refuses percent-encoded traversal, which decoding would otherwise hide", () => {
    // `%2e%2e%2f` decodes to `../`. The URL parser leaves it encoded (it is a
    // single segment), so decoding before normalising is what turns it back
    // into the traversal the adapter would refuse.
    expect(() => relativePathFromPreviewUrl(`${PREVIEW_ORIGIN}/%2e%2e%2fsecret.txt`)).toThrow(
      PreviewUrlError,
    );
  });

  it("treats a dot-segment the URL parser already collapsed as the contained path it became", () => {
    // `new URL` collapses literal and `%2E%2E` dot segments itself, so by the
    // time this module sees the path it is the collapsed, contained form — not
    // a traversal. The assertion pins that this is understood rather than
    // accidentally tolerated.
    expect(relativePathFromPreviewUrl(`${PREVIEW_ORIGIN}/a/%2E%2E/%2E%2E/b.txt`)).toBe("b.txt");
  });

  it("refuses a path that resolves to the project root", () => {
    expect(() => relativePathFromPreviewUrl(`${PREVIEW_ORIGIN}/`)).toThrow(PreviewUrlError);
  });

  it("refuses malformed percent-encoding rather than guessing", () => {
    expect(() => relativePathFromPreviewUrl(`${PREVIEW_ORIGIN}/%E0%A4%A`)).toThrow(PreviewUrlError);
  });
});

describe("contentTypeFor", () => {
  it("names the types a site actually loads", () => {
    expect(contentTypeFor("index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("css/site.css")).toBe("text/css; charset=utf-8");
    expect(contentTypeFor("app.js")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeFor("logo.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("font.woff2")).toBe("font/woff2");
  });

  it("is case-insensitive about the extension", () => {
    expect(contentTypeFor("INDEX.HTML")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("Photo.PNG")).toBe("image/png");
  });

  it("falls back to octet-stream rather than guessing text/html", () => {
    // With `nosniff` on every response, guessing html here would be the one
    // wrong answer that executes.
    expect(contentTypeFor("LICENSE")).toBe("application/octet-stream");
    expect(contentTypeFor("archive.weird")).toBe("application/octet-stream");
    expect(contentTypeFor(".env")).toBe("application/octet-stream");
  });

  it("ignores a dot in a directory name", () => {
    expect(contentTypeFor("v1.2/README")).toBe("application/octet-stream");
  });
});

describe("isPreviewOriginUrl", () => {
  it("accepts the preview origin, with or without a path", () => {
    expect(isPreviewOriginUrl(`${PREVIEW_ORIGIN}/index.html`)).toBe(true);
    expect(isPreviewOriginUrl(`${PREVIEW_ORIGIN}/a/b/c.css`)).toBe(true);
    expect(isPreviewOriginUrl(PREVIEW_ORIGIN)).toBe(true);
  });

  it("refuses another host on the same scheme", () => {
    // A different host would be a different root; the handler 404s it, and the
    // navigation guard must not wave it through first.
    expect(isPreviewOriginUrl(`${PREVIEW_SCHEME}://elsewhere/index.html`)).toBe(false);
  });

  it("refuses every other scheme, including a lookalike prefix", () => {
    for (const url of [
      "https://example.com/",
      "file:///C:/Windows/win.ini",
      "about:blank",
      "data:text/html,<h1>x</h1>",
      `${PREVIEW_SCHEME}-evil://project/index.html`,
      "not a url",
    ]) {
      expect(isPreviewOriginUrl(url), url).toBe(false);
    }
  });
});

describe("toWholePixels", () => {  it("rounds a fractional rectangle to whole pixels", () => {
    expect(toWholePixels({ x: 10.4, y: 20.6, width: 800.5, height: 599.4 })).toEqual({
      x: 10,
      y: 21,
      width: 801,
      height: 599,
    });
  });

  it("clamps a negative dimension to zero rather than passing it through", () => {
    // Electron answers a negative dimension by ignoring the whole update, which
    // would leave a stale rectangle on screen instead of a hidden one.
    expect(toWholePixels({ x: 0, y: 0, width: -10, height: -1 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it("leaves an already-whole rectangle untouched", () => {
    const bounds = { x: 264, y: 102, width: 882, height: 443 };
    expect(toWholePixels(bounds)).toEqual(bounds);
  });
});

describe("PREVIEW_CSP", () => {  it("allows the project's own files and nothing remote", () => {
    expect(PREVIEW_CSP).toContain(`script-src ${PREVIEW_SCHEME}:`);
    expect(PREVIEW_CSP).toContain(`style-src ${PREVIEW_SCHEME}:`);
    expect(PREVIEW_CSP).not.toMatch(/https?:\/\//);
  });

  it("keeps framing, plugins, base rewriting and form posting closed", () => {
    expect(PREVIEW_CSP).toContain("frame-src 'none'");
    expect(PREVIEW_CSP).toContain("object-src 'none'");
    expect(PREVIEW_CSP).toContain("base-uri 'none'");
    expect(PREVIEW_CSP).toContain("form-action 'none'");
    expect(PREVIEW_CSP).toContain("default-src 'none'");
  });

  it("does not rely on 'self' for its own origin", () => {
    // A sandboxed document has an opaque origin, against which 'self' matches
    // nothing; the scheme expression is what actually works.
    expect(PREVIEW_CSP).not.toContain("'self'");
  });

  it("permits inline and runtime-built scripts, which real sites need", () => {
    // A deliberate choice, not an oversight: the preview holds no privilege to
    // escalate, so `eval` can only run more of the project's own code. See the
    // comment on `PREVIEW_CSP`.
    expect(PREVIEW_CSP).toContain("'unsafe-inline'");
    expect(PREVIEW_CSP).toContain("'unsafe-eval'");
  });

  it("keeps every directive on the preview scheme or a local kind", () => {
    // Nothing outside the project is reachable: no bare host, no other scheme.
    const sources = PREVIEW_CSP.split(";").flatMap((entry) => entry.trim().split(/\s+/).slice(1));
    for (const source of sources) {
      expect(
        /^(astra-preview:|'none'|'unsafe-inline'|'unsafe-eval'|data:|blob:)$/.test(source),
        `${source} is not a project-local source`,
      ).toBe(true);
    }
  });
});
