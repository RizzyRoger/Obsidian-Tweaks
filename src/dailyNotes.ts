import type { App, TFile } from "obsidian";

export interface DailyNoteSettings {
  folder: string;
  format: string;
  template: string;
}

export interface MomentLike {
  (input?: string, format?: string, strict?: boolean): {
    isValid(): boolean;
    isBefore(other: { valueOf(): number }, unit?: string): boolean;
    format(format: string): string;
    valueOf(): number;
    day(): number;
  };
}

function trimFolder(folder: string): string {
  return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function getDailyNoteSettings(app: App): DailyNoteSettings {
  try {
    const internalPlugins = (
      app as unknown as {
        internalPlugins: {
          getPluginById: (id: string) =>
            | {
                instance?: {
                  options?: { folder?: string; format?: string; template?: string };
                };
              }
            | undefined;
        };
      }
    ).internalPlugins;
    const options = internalPlugins.getPluginById("daily-notes")?.instance?.options ?? {};
    return {
      folder: trimFolder(options.folder || "daily notes"),
      format: options.format || "YYYY-MM-DD",
      template: coreTemplateSetting(options.template),
    };
  } catch {
    return {
      folder: "daily notes",
      format: "YYYY-MM-DD",
      template: coreTemplateSetting(),
    };
  }
}

export function coreTemplateSetting(template?: string): string {
  const trimmed = (template ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.md$/i, "");
  return trimmed || "daily notes/template";
}

export function markdownPath(templatePath: string): string {
  const trimmed = templatePath.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
}

export function dailyNotePrefix(folder: string): string {
  return folder.length === 0 ? "" : `${folder}/`;
}

export function getNoteMoment(
  path: string,
  folder: string,
  format: string,
  moment: MomentLike
) {
  const prefix = dailyNotePrefix(folder);
  const relative = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  const basename = relative.replace(/\.md$/i, "");
  return moment(basename, format, true);
}

export function isDailyNotePath(
  path: string,
  folder: string,
  format: string,
  moment: MomentLike
): boolean {
  const prefix = dailyNotePrefix(folder);
  if (prefix && !path.startsWith(prefix)) return false;
  if (!path.toLowerCase().endsWith(".md")) return false;
  const relative = prefix ? path.slice(prefix.length) : path;
  if (relative.includes("/")) return false;
  return getNoteMoment(path, folder, format, moment).isValid();
}

export function findTodayDailyNote(
  files: TFile[],
  folder: string,
  format: string,
  moment: MomentLike,
  today = moment()
): TFile | null {
  const todayKey = today.format(format);
  return (
    files.find((file) => {
      if (!isDailyNotePath(file.path, folder, format, moment)) return false;
      return getNoteMoment(file.path, folder, format, moment).format(format) === todayKey;
    }) ?? null
  );
}

export function findPreviousDailyNote(
  files: TFile[],
  folder: string,
  format: string,
  moment: MomentLike,
  today = moment()
): TFile | null {
  const prior = files
    .filter((file) => isDailyNotePath(file.path, folder, format, moment))
    .map((file) => ({
      file,
      date: getNoteMoment(file.path, folder, format, moment),
    }))
    .filter(({ date }) => date.isValid() && date.isBefore(today, "day"))
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());

  return prior[0]?.file ?? null;
}

export function isTodayDailyNote(
  file: TFile,
  folder: string,
  format: string,
  moment: MomentLike,
  today = moment()
): boolean {
  if (!isDailyNotePath(file.path, folder, format, moment)) return false;
  return getNoteMoment(file.path, folder, format, moment).format(format) === today.format(format);
}
