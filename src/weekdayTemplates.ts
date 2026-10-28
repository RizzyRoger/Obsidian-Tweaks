export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type WeekdayTemplates = Partial<Record<WeekdayKey, string>>;

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export const TEMPLATES_FOLDER = "daily notes/templates";

export function weekdayKeyFromDay(day: number): WeekdayKey | null {
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  return WEEKDAY_KEYS[day];
}

export function assignedTemplatePath(
  templates: WeekdayTemplates,
  weekday: WeekdayKey
): string | null {
  const path = templates[weekday]?.trim() ?? "";
  return path.length > 0 ? path : null;
}

export function resolveTemplatePath(
  templates: WeekdayTemplates,
  weekday: WeekdayKey,
  coreTemplatePath: string
): string {
  return assignedTemplatePath(templates, weekday) ?? coreTemplatePath;
}

export function normalizeNote(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

export function canReplaceWithWeekdayTemplate(
  currentContent: string,
  coreTemplateContent: string
): boolean {
  const current = normalizeNote(currentContent);
  if (current.length === 0) return true;
  return current === normalizeNote(coreTemplateContent);
}

export function replacementContent(
  currentContent: string,
  coreTemplateContent: string,
  weekdayTemplateContent: string | null
): string | null {
  if (weekdayTemplateContent === null) return null;
  if (!canReplaceWithWeekdayTemplate(currentContent, coreTemplateContent)) return null;
  if (normalizeNote(currentContent) === normalizeNote(weekdayTemplateContent)) return null;
  return weekdayTemplateContent;
}

export function weekdayTemplateFilePath(
  name: string,
  folder = TEMPLATES_FOLDER
): string | null {
  const cleaned = name.trim().replace(/\.md$/i, "").trim();
  if (!cleaned || cleaned === "." || cleaned === ".." || /[\\/]/.test(cleaned)) return null;
  return `${folder}/${cleaned}.md`;
}

export async function readUntilSettled(
  read: () => Promise<string>,
  wait: (ms: number) => Promise<void>,
  attempts = 10,
  intervalMs = 50
): Promise<string> {
  let content = await read();
  for (let i = 0; i < attempts && normalizeNote(content).length === 0; i++) {
    await wait(intervalMs);
    content = await read();
  }
  return content;
}
