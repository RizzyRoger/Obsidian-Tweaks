import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isPlaceholderText,
  isRollable,
  normalizeCategoryName,
  parseNote,
} from "../src/parse";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

describe("normalizeCategoryName", () => {
  it("strips trailing colons and ignores case", () => {
    expect(normalizeCategoryName("hw:")).toBe("hw");
    expect(normalizeCategoryName("Scedule:")).toBe("scedule");
    expect(normalizeCategoryName("Later")).toBe("later");
  });
});

describe("isPlaceholderText", () => {
  it("treats empty and bare period slots as placeholders", () => {
    expect(isPlaceholderText("")).toBe(true);
    expect(isPlaceholderText("   ")).toBe(true);
    expect(isPlaceholderText("*nth period:*")).toBe(true);
    expect(isPlaceholderText("*Morning:* ")).toBe(true);
    expect(isPlaceholderText("*Lunch:*")).toBe(true);
  });

  it("keeps period lines that have real text", () => {
    expect(isPlaceholderText("*5th period:* mand quiz")).toBe(false);
    expect(isPlaceholderText("*Morning:* Do math redos")).toBe(false);
  });
});

describe("parseNote", () => {
  it("reads checkbox categories from the Oct 22 daily note", () => {
    const parsed = parseNote(fixture("2026-10-22.md"));
    expect(parsed.categories.map((category) => category.normalizedName)).toEqual([
      "scedule",
      "hw",
      "importaint little",
      "daylies",
      "later",
    ]);

    const later = parsed.categories.find((category) => category.normalizedName === "later");
    expect(later?.children.filter(isRollable).map((child) => child.text)).toEqual([
      "talk to mr.squi abt limits, 0/0, 1/0, 0/1. General rules + if qls considers inf a limit or unbounded and why the f(x) and then g(x)",
      "Talk to drmotgomery abt test taking",
      "work on trig identities relearn and double angle pythogharean",
    ]);

    const scedule = parsed.categories.find((category) => category.normalizedName === "scedule");
    expect(scedule?.children.filter(isRollable)).toEqual([]);

    expect(parsed.uncategorized.map((item) => item.text)).toEqual([
      "Guitar 5 min spractice e, a and g power cord E Minor → A Sus2 → A Major → D Major",
    ]);
  });

  it("does not treat Daylies and Dailies as the same category", () => {
    expect(normalizeCategoryName("Daylies")).not.toBe(normalizeCategoryName("Dailies"));
  });
});
