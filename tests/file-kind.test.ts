import { describe, expect, it } from "vitest";
import { badgeFor, classifyFile, extensionOf } from "../src/renderer/src/lib/file-kind";

describe("file-kind", () => {
  it("extracts the lower-cased extension", () => {
    expect(extensionOf("README.md")).toBe("md");
    expect(extensionOf("style.CSS")).toBe("css");
    expect(extensionOf("image.PNG")).toBe("png");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf(".gitignore")).toBe("");
    expect(extensionOf("LICENSE")).toBe("");
    expect(extensionOf("src\\app.ts")).toBe("ts");
  });

  it("produces badges up to four characters", () => {
    expect(badgeFor("html")).toBe("HTML");
    expect(badgeFor("css")).toBe("CSS");
    expect(badgeFor("js")).toBe("JS");
    expect(badgeFor("json")).toBe("JSON");
    expect(badgeFor("jpeg")).toBe("JPEG");
    expect(badgeFor("woff2")).toBe("WOFF");
    expect(badgeFor("")).toBe("—");
  });

  it("classifies recognised file types", () => {
    const html = classifyFile("index.html");
    expect(html.id).toBe("html");
    expect(html.textual).toBe(true);
    expect(html.label).toBe("HTML");

    const css = classifyFile("style.css");
    expect(css.id).toBe("css");
    expect(css.textual).toBe(true);

    const js = classifyFile("script.js");
    expect(js.id).toBe("javascript");
    expect(js.textual).toBe(true);

    const mjs = classifyFile("lib.mjs");
    expect(mjs.id).toBe("javascript");

    const cjs = classifyFile("legacy.cjs");
    expect(cjs.id).toBe("javascript");

    const json = classifyFile("config.json");
    expect(json.id).toBe("json");
    expect(json.textual).toBe(true);
  });

  it("treats images as non-textual and SVG as textual image kind", () => {
    const png = classifyFile("logo.png");
    expect(png.id).toBe("image");
    expect(png.textual).toBe(false);

    const jpg = classifyFile("photo.jpg");
    expect(jpg.id).toBe("image");
    expect(jpg.textual).toBe(false);

    const svg = classifyFile("icon.svg");
    expect(svg.id).toBe("image");
    expect(svg.textual).toBe(true);
  });

  it("treats fonts as non-textual and others as textual", () => {
    const woff = classifyFile("font.woff");
    expect(woff.id).toBe("font");
    expect(woff.textual).toBe(false);

    const ttf = classifyFile("font.ttf");
    expect(ttf.id).toBe("font");
    expect(ttf.textual).toBe(false);

    const unknown = classifyFile("README");
    expect(unknown.id).toBe("other");
    expect(unknown.textual).toBe(true);

    const ts = classifyFile("app.ts");
    expect(ts.id).toBe("other");
    expect(ts.textual).toBe(true);
  });
});
