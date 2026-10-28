import { Notice, Plugin, TFile, TFolder } from "obsidian";
import {
  getDailyNoteSettings,
  getNoteMoment,
  isTodayDailyNote,
  markdownPath,
  findPreviousDailyNote,
  findTodayDailyNote,
  type MomentLike,
} from "./src/dailyNotes";
import { formatRolloverNotice, mergeRollover } from "./src/merge";
import {
  WeekdayTemplateSettingTab,
  type RolloverPluginData,
  type WeekdaySettingsHost,
} from "./src/settings";
import {
  TEMPLATES_FOLDER,
  readUntilSettled,
  replacementContent,
  weekdayKeyFromDay,
  weekdayTemplateFilePath,
} from "./src/weekdayTemplates";

export default class RolloverCategoricalTodosPlugin
  extends Plugin
  implements WeekdaySettingsHost
{
  data: RolloverPluginData = {};

  async onload() {
    this.data = Object.assign({ weekdayTemplates: {} }, await this.loadData());

    this.addSettingTab(new WeekdayTemplateSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      void this.maybeRollover(false);
    });

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (!(file instanceof TFile)) return;
        const { folder, format } = getDailyNoteSettings(this.app);
        if (!isTodayDailyNote(file, folder, format, this.moment())) return;
        void this.onTodayNoteCreated(file);
      })
    );

    this.addCommand({
      id: "rollover-categorical-todos-now",
      name: "Rollover categorical todos now",
      callback: () => {
        void this.maybeRollover(true);
      },
    });
  }

  async createWeekdayTemplate(name: string): Promise<boolean> {
    const path = weekdayTemplateFilePath(name);
    if (!path) {
      new Notice("Enter a template name.");
      return false;
    }
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(`Template already exists: ${path}`);
      return false;
    }

    const { template } = getDailyNoteSettings(this.app);
    const core = this.app.vault.getAbstractFileByPath(markdownPath(template));
    const content = core instanceof TFile ? await this.app.vault.read(core) : "";
    if (!(this.app.vault.getAbstractFileByPath(TEMPLATES_FOLDER) instanceof TFolder)) {
      await this.app.vault.createFolder(TEMPLATES_FOLDER);
    }
    await this.app.vault.create(path, content);
    new Notice(`Created ${path}`);
    return true;
  }

  private moment(): MomentLike {
    return (window as unknown as { moment: MomentLike }).moment;
  }

  private todayKey(): string {
    const { format } = getDailyNoteSettings(this.app);
    return this.moment()().format(format);
  }

  private async onTodayNoteCreated(file: TFile): Promise<void> {
    await this.applyWeekdayTemplate(file);
    await this.maybeRollover(false);
  }

  private async applyWeekdayTemplate(file: TFile): Promise<void> {
    const { folder, format, template } = getDailyNoteSettings(this.app);
    const weekday = weekdayKeyFromDay(getNoteMoment(file.path, folder, format, this.moment()).day());
    if (!weekday) return;

    const assigned = this.data.weekdayTemplates?.[weekday]?.trim() ?? "";
    if (!assigned) return;

    const assignedFile = this.app.vault.getAbstractFileByPath(markdownPath(assigned));
    if (!(assignedFile instanceof TFile)) {
      new Notice(`Weekday template not found: ${assigned}`);
      return;
    }

    let current = "";
    try {
      current = await readUntilSettled(
        () => this.app.vault.read(file),
        (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
      );
    } catch {
      return;
    }

    const coreFile = this.app.vault.getAbstractFileByPath(markdownPath(template));
    const coreContent = coreFile instanceof TFile ? await this.app.vault.read(coreFile) : "";
    const weekdayContent = await this.app.vault.read(assignedFile);
    const next = replacementContent(current, coreContent, weekdayContent);
    if (next === null) return;

    await this.app.vault.modify(file, next);
  }

  private async maybeRollover(force: boolean): Promise<void> {
    const todayKey = this.todayKey();
    if (!force && this.data.lastRolledDate === todayKey) {
      return;
    }

    const outcome = await this.rollover();
    if (outcome === "no-today") {
      return;
    }

    this.data.lastRolledDate = todayKey;
    await this.saveData(this.data);
  }

  private async rollover(): Promise<"ok" | "no-today" | "no-yesterday"> {
    const { folder, format } = getDailyNoteSettings(this.app);
    const moment = this.moment();
    const files = this.app.vault.getMarkdownFiles();

    const todayFile = findTodayDailyNote(files, folder, format, moment);
    if (!todayFile) {
      return "no-today";
    }

    const yesterdayFile = findPreviousDailyNote(files, folder, format, moment);
    if (!yesterdayFile) {
      new Notice("No previous daily note to roll over from.");
      return "no-yesterday";
    }

    const yesterdayContent = await this.app.vault.read(yesterdayFile);
    const todayContent = await this.app.vault.read(todayFile);
    const result = mergeRollover(yesterdayContent, todayContent);

    if (result.changed) {
      await this.app.vault.modify(todayFile, result.content);
    }

    new Notice(formatRolloverNotice(result));
    return "ok";
  }
}
