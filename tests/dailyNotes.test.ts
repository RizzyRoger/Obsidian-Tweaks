import { describe, expect, it } from "vitest";
import {
  findPreviousDailyNote,
  findTodayDailyNote,
  isDailyNotePath,
  type MomentLike,
} from "../src/dailyNotes";

class FakeDate {
  constructor(private readonly iso: string) {}
  isValid() {
    return /^\d{4}-\d{2}-\d{2}$/.test(this.iso);
  }
  isBefore(other: { valueOf(): number }, unit?: string) {
    if (unit === "day") {
      return this.iso < new Date(other.valueOf()).toISOString().slice(0, 10);
    }
    return this.valueOf() < other.valueOf();
  }
  format() {
    return this.iso;
  }
  valueOf() {
    return new Date(`${this.iso}T00:00:00Z`).valueOf();
  }
  day() {
    return new Date(`${this.iso}T00:00:00Z`).getUTCDay();
  }
}

const moment: MomentLike = ((input?: string) => {
  return new FakeDate(input ?? "2026-10-23");
}) as MomentLike;

function file(path: string) {
  return { path } as import("obsidian").TFile;
}

describe("daily note lookup", () => {
  const folder = "daily notes";
  const format = "YYYY-MM-DD";
  const files = [
    file("daily notes/template.md"),
    file("daily notes/Scedule.md"),
    file("daily notes/2026-10-21.md"),
    file("daily notes/2026-10-22.md"),
    file("daily notes/2026-10-23.md"),
    file("daily notes/2026-11-05.md"),
  ];

  it("accepts dated notes and ignores template files", () => {
    expect(isDailyNotePath("daily notes/2026-10-22.md", folder, format, moment)).toBe(true);
    expect(isDailyNotePath("daily notes/template.md", folder, format, moment)).toBe(false);
    expect(isDailyNotePath("daily notes/Scedule.md", folder, format, moment)).toBe(false);
  });

  it("finds today and the most recent earlier note, ignoring future pre-created notes", () => {
    const today = findTodayDailyNote(files, folder, format, moment);
    const previous = findPreviousDailyNote(files, folder, format, moment);
    expect(today?.path).toBe("daily notes/2026-10-23.md");
    expect(previous?.path).toBe("daily notes/2026-10-22.md");
  });
});
