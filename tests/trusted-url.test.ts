import { describe, expect, it } from "vitest";
import { isTrustedRendererUrl, type TrustedRendererTarget } from "../src/main/trusted-url";

const FILE_URL = "file:///D:/code-web/Astra/out/renderer/index.html";

const packaged: TrustedRendererTarget = { fileUrl: FILE_URL };
const development: TrustedRendererTarget = {
  devServerUrl: "http://localhost:5173",
  fileUrl: FILE_URL,
};

describe("isTrustedRendererUrl — packaged build", () => {
  it("trusts the renderer document itself", () => {
    expect(isTrustedRendererUrl(FILE_URL, packaged)).toBe(true);
  });

  it("trusts the same document carrying a hash", () => {
    expect(isTrustedRendererUrl(`${FILE_URL}#layer-3`, packaged)).toBe(true);
  });

  it("refuses a sibling file on disk", () => {
    expect(isTrustedRendererUrl("file:///D:/code-web/Astra/out/renderer/secrets.html", packaged)).toBe(false);
  });

  it("refuses an unrelated file anywhere on the machine", () => {
    expect(isTrustedRendererUrl("file:///C:/Users/victim/Documents/notes.html", packaged)).toBe(false);
  });

  it("refuses the renderer directory itself", () => {
    expect(isTrustedRendererUrl("file:///D:/code-web/Astra/out/renderer/", packaged)).toBe(false);
  });

  it("refuses remote origins outright, including the dev server", () => {
    expect(isTrustedRendererUrl("https://evil.example.com/", packaged)).toBe(false);
    expect(isTrustedRendererUrl("http://localhost:5173/", packaged)).toBe(false);
  });

  it("refuses javascript: and data: URLs", () => {
    expect(isTrustedRendererUrl("javascript:alert(1)", packaged)).toBe(false);
    expect(isTrustedRendererUrl("data:text/html,<script>alert(1)</script>", packaged)).toBe(false);
  });
});

describe("isTrustedRendererUrl — development", () => {
  it("trusts the dev server origin", () => {
    expect(isTrustedRendererUrl("http://localhost:5173/", development)).toBe(true);
    expect(isTrustedRendererUrl("http://localhost:5173/src/renderer/index.html", development)).toBe(true);
  });

  it("refuses a different port on the same machine", () => {
    expect(isTrustedRendererUrl("http://localhost:8080/", development)).toBe(false);
  });

  it("refuses a different host", () => {
    expect(isTrustedRendererUrl("http://evil.example.com/", development)).toBe(false);
    expect(isTrustedRendererUrl("http://192.168.1.5:5173/", development)).toBe(false);
  });

  it("refuses a scheme downgrade back to file://", () => {
    expect(isTrustedRendererUrl(FILE_URL, development)).toBe(false);
  });
});

describe("isTrustedRendererUrl — malformed input", () => {
  it("returns false rather than throwing on strings that are not URLs", () => {
    for (const candidate of ["", " ", "not a url", "//localhost:5173", "http://"]) {
      expect(isTrustedRendererUrl(candidate, packaged), candidate).toBe(false);
      expect(isTrustedRendererUrl(candidate, development), candidate).toBe(false);
    }
  });

  it("returns false when the configured target is itself malformed", () => {
    const broken: TrustedRendererTarget = { fileUrl: "not a url" };
    expect(isTrustedRendererUrl(FILE_URL, broken)).toBe(false);
  });
});
