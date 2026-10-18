import { describe, expect, it } from "vitest";
import { detectEntryPoint, ENTRY_POINT_CANDIDATES } from "../src/shared/entry-point";
import type { ProjectListEntry } from "../src/shared/ipc";

/**
 * Entry detection is a verdict two processes may both want to reach, so it
 * lives in `shared` as a pure function — and that purity is what these tests
 * pin: given a listing, the answer is exact, case-tolerant, and never confused
 * by directories or nested pages.
 */

function file(name: string, relativePath = name): ProjectListEntry {
  return { name, relativePath, kind: "file" };
}

function directory(name: string, relativePath = name): ProjectListEntry {
  return { name, relativePath, kind: "directory" };
}

describe("detectEntryPoint", () => {
  it("picks index.html from a typical listing", () => {
    const entries = [file("style.css"), file("index.html"), directory("assets")];
    expect(detectEntryPoint(entries)).toBe("index.html");
  });

  it("prefers index.html over index.htm when both exist", () => {
    const entries = [file("index.htm"), file("index.html")];
    expect(detectEntryPoint(entries)).toBe("index.html");
  });

  it("falls back to index.htm when there is no index.html", () => {
    const entries = [file("style.css"), file("index.htm")];
    expect(detectEntryPoint(entries)).toBe("index.htm");
  });

  it("matches case-insensitively, as a Windows filesystem would", () => {
    expect(detectEntryPoint([file("Index.HTML")])).toBe("Index.HTML");
    expect(detectEntryPoint([file("INDEX.HTM")])).toBe("INDEX.HTM");
  });

  it("refuses a directory wearing the entry's name", () => {
    const entries = [directory("index.html")];
    expect(detectEntryPoint(entries)).toBeNull();
  });

  it("consults only the listing it is given — a nested page is not the entry", () => {
    // A root listing never contains nested paths; what it can contain is a
    // directory that happens to hold its own index.html. That directory is not
    // an entry — only files in this listing compete.
    const entries = [directory("pages"), file("default.html")];
    expect(detectEntryPoint(entries)).toBeNull();
  });

  it("returns null for a project without any entry candidate", () => {
    const entries = [file("about.html"), file("main.js"), directory("src")];
    expect(detectEntryPoint(entries)).toBeNull();
  });

  it("returns null for an empty root", () => {
    expect(detectEntryPoint([])).toBeNull();
  });

  it("keeps the documented candidate order", () => {
    expect([...ENTRY_POINT_CANDIDATES]).toEqual(["index.html", "index.htm"]);
  });
});
