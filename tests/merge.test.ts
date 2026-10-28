import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatRolloverNotice, mergeRollover } from "../src/merge";
import { parseNote } from "../src/parse";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

function laterChildren(content: string): string[] {
  return (
    parseNote(content).categories.find((category) => category.normalizedName === "later")
      ?.children.map((child) => child.text) ?? []
  );
}

describe("mergeRollover", () => {
  it("rolls only the missing Later task from Oct 22 into Oct 23", () => {
    const result = mergeRollover(fixture("2026-10-22.md"), fixture("2026-10-23.md"));

    expect(result.changed).toBe(true);
    expect(result.rolled).toEqual([{ category: "Later", count: 1 }]);
    expect(laterChildren(result.content)).toEqual([
      "talk to mr.squi abt limits, 0/0, 1/0, 0/1. General rules + if qls considers inf a limit or unbounded and why the f(x) and then g(x)",
      "Talk to drmotgomery abt test taking",
      "work on trig identities relearn and double angle pythogharean",
    ]);
    expect(result.content.match(/Guitar 5 min spractice/g)).toHaveLength(1);
    expect(result.content).toMatch(
      /work on trig identities relearn and double angle pythogharean\nExtra/
    );
    expect(result.content).toContain("[[template]]\n**Long Term Hw**");
    expect(formatRolloverNotice(result)).toBe("Rolled 1 task into Later.");
  });

  it("is idempotent after the first rollover", () => {
    const first = mergeRollover(fixture("2026-10-22.md"), fixture("2026-10-23.md"));
    const second = mergeRollover(fixture("2026-10-22.md"), first.content);
    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it("skips completed items, empty checkboxes, and bare period placeholders", () => {
    const yesterday = `**Schedule**
- [ ] hw:
	- [x] finished
	- [ ] 
	- [ ] leftover packet
- [ ] Scedule:
	- [ ] *Morning:* 
	- [ ] *nth period:* 
`;
    const today = `**Schedule**
- [ ] hw:
	- [ ] 
- [ ] Scedule:
	- [ ] *Morning:* 
	- [ ] *nth period:* 
`;
    const result = mergeRollover(yesterday, today);
    expect(result.rolled).toEqual([{ category: "hw", count: 1 }]);
    expect(result.content).toContain("- [ ] leftover packet");
    expect((result.content.match(/\*nth period:\*/g) ?? []).length).toBe(1);
  });

  it("rolls a period slot with real text into Scedule", () => {
    const yesterday = `- [ ] Scedule:
	- [ ] *nth period:* 
	- [ ] *5th period:* mand quiz
`;
    const today = `- [ ] Scedule:
	- [ ] *Morning:* 
	- [ ] *nth period:* 
`;
    const result = mergeRollover(yesterday, today);
    expect(result.rolled).toEqual([{ category: "Scedule", count: 1 }]);
    expect(result.content).toContain("*5th period:* mand quiz");
  });

  it("matches hw: to hw and skips exact duplicates", () => {
    const yesterday = `- [ ] hw:
	- [ ] Jazz
	- [ ] unique worksheet
`;
    const today = `- [ ] hw
	- [ ] Jazz
`;
    const result = mergeRollover(yesterday, today);
    expect(result.rolled).toEqual([{ category: "hw", count: 1 }]);
    expect(result.content.match(/Jazz/g)).toHaveLength(1);
    expect(result.content).toContain("unique worksheet");
  });

  it("appends unmatched categories before the closing [[template]]", () => {
    const yesterday = `${fixture("2026-10-22.md").replace(
      "[[template]]\n**Long-term HW**",
      `- [ ] RandomCat
	- [ ] leftover task
[[template]]
**Long-term HW**`
    )}`;
    const result = mergeRollover(yesterday, fixture("2026-10-23.md"));
    expect(result.unmatchedCount).toBe(1);
    expect(result.content).toMatch(
      /- \[ \] RandomCat\n\t- \[ \] leftover task\n\n\[\[template\]\]\n\*\*Long Term Hw\*\*/
    );
  });

  it("appends unmatched work at the end when there is no closing template", () => {
    const yesterday = `- [ ] RandomCat
	- [ ] leftover task
`;
    const today = `- [ ] hw:
	- [ ] Jazz
`;
    const result = mergeRollover(yesterday, today);
    expect(result.content.trimEnd().endsWith("- [ ] leftover task")).toBe(true);
    expect(result.content).toContain("- [ ] RandomCat");
  });

  it("does not merge Daylies into Dailies", () => {
    const yesterday = `- [ ] Daylies
	- [ ] extra drill
`;
    const today = `- [ ] Dailies
	- [ ] study calc
[[template]]
**Idea**
`;
    const result = mergeRollover(yesterday, today);
    expect(result.unmatchedCount).toBe(1);
    expect(result.content).toContain("- [ ] Daylies");
    expect(result.content).toContain("- [ ] Dailies");
  });

  it("returns no change when everything is done or already present", () => {
    const yesterday = `- [x] Later
	- [x] done already
Extra
- [ ] Guitar 5 min spractice e, a and g power cord E Minor → A Sus2 → A Major → D Major
`;
    const today = fixture("2026-10-23.md");
    const result = mergeRollover(yesterday, today);
    expect(result.changed).toBe(false);
    expect(formatRolloverNotice(result)).toBe("Nothing to roll over.");
  });
});
