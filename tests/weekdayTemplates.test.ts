import { describe, expect, it } from "vitest";
import { coreTemplateSetting, markdownPath } from "../src/dailyNotes";
import { mergeRollover } from "../src/merge";
import {
  assignedTemplatePath,
  canReplaceWithWeekdayTemplate,
  readUntilSettled,
  replacementContent,
  resolveTemplatePath,
  weekdayKeyFromDay,
  weekdayTemplateFilePath,
} from "../src/weekdayTemplates";

describe("weekday mapping", () => {
  it("maps 2026-10-26 to Monday and 2026-10-24 to Saturday", () => {
    expect(weekdayKeyFromDay(new Date("2026-10-26T12:00:00Z").getUTCDay())).toBe("monday");
    expect(weekdayKeyFromDay(new Date("2026-10-24T12:00:00Z").getUTCDay())).toBe("saturday");
  });

  it("rejects a day index outside Sunday through Saturday", () => {
    expect(weekdayKeyFromDay(7)).toBeNull();
    expect(weekdayKeyFromDay(-1)).toBeNull();
  });

  it("shares one template across days and leaves an empty day on the core template", () => {
    const templates = {
      wednesday: "daily notes/templates/school-days",
      thursday: "daily notes/templates/school-days",
      friday: "daily notes/templates/school-days",
      saturday: "daily notes/templates/weekend",
      sunday: "daily notes/templates/weekend",
    };
    const core = coreTemplateSetting("daily notes/template.md");

    expect(assignedTemplatePath(templates, "wednesday")).toBe("daily notes/templates/school-days");
    expect(assignedTemplatePath(templates, "friday")).toBe("daily notes/templates/school-days");
    expect(resolveTemplatePath(templates, "saturday", core)).toBe("daily notes/templates/weekend");
    expect(assignedTemplatePath(templates, "monday")).toBeNull();
    expect(resolveTemplatePath(templates, "monday", core)).toBe("daily notes/template");
    expect(markdownPath(resolveTemplatePath(templates, "monday", core))).toBe(
      "daily notes/template.md"
    );
  });
});

describe("fresh note replacement", () => {
  const core = "[[template]]\n- [ ] hw:\n\t- [ ] \n";
  const weekend = "[[template]]\n- [ ] Later\n\t- [ ] \n[[template]]\n";

  it("replaces an empty note or an exact copy of the core template", () => {
    expect(canReplaceWithWeekdayTemplate("", core)).toBe(true);
    expect(canReplaceWithWeekdayTemplate(`\n${core}\r\n`, core)).toBe(true);
    expect(replacementContent(core, core, weekend)).toBe(weekend);
  });

  it("leaves a note that already has extra writing", () => {
    const edited = `${core}- [ ] extra task\n`;
    expect(canReplaceWithWeekdayTemplate(edited, core)).toBe(false);
    expect(replacementContent(edited, core, weekend)).toBeNull();
  });

  it("skips replacement when no weekday template is assigned or it already matches", () => {
    expect(replacementContent(core, core, null)).toBeNull();
    expect(replacementContent(weekend, core, weekend)).toBeNull();
  });

  it("waits while the new note is still empty", async () => {
    const reads = ["", "   ", core];
    const content = await readUntilSettled(
      async () => reads.shift() ?? core,
      async () => undefined,
      5,
      1
    );
    expect(content).toBe(core);
  });
});

describe("rollover into a weekday template", () => {
  it("nests matching tasks and appends missing categories above [[template]]", () => {
    const yesterday = `[[template]]
- [ ] Scedule:
	- [ ] *nth period:* 
	- [ ] *5th period:* mand quiz
- [ ] Later
	- [ ] talk to teacher
- [ ] hw:
	- [ ] leftover packet
[[template]]
`;
    const weekend = `[[template]]
- [ ] Later
	- [ ] 
- [ ] Daylies
	- [ ] study calc
[[template]]
**Long Term Hw**
`;

    const result = mergeRollover(yesterday, weekend);
    const closing = result.content.lastIndexOf("[[template]]");

    expect(result.content).toContain("\t- [ ] talk to teacher");
    expect(result.content).not.toContain("*nth period:*");
    expect(result.content.indexOf("mand quiz")).toBeLessThan(closing);
    expect(result.content.indexOf("leftover packet")).toBeLessThan(closing);
    expect(result.content.indexOf("**Long Term Hw**")).toBeGreaterThan(closing);
  });
});

describe("template file names", () => {
  it("builds a path in the templates folder and rejects an empty name", () => {
    expect(weekdayTemplateFilePath("weekend")).toBe("daily notes/templates/weekend.md");
    expect(weekdayTemplateFilePath("school-days.md")).toBe(
      "daily notes/templates/school-days.md"
    );
    expect(weekdayTemplateFilePath("   ")).toBeNull();
    expect(weekdayTemplateFilePath("../nope")).toBeNull();
  });
});
