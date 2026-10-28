import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  type SettingDefinitionItem,
} from "obsidian";
import {
  TEMPLATES_FOLDER,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  weekdayTemplateFilePath,
  type WeekdayTemplates,
} from "./weekdayTemplates";

export interface RolloverPluginData {
  lastRolledDate?: string;
  weekdayTemplates?: WeekdayTemplates;
}

export interface WeekdaySettingsHost {
  data: RolloverPluginData;
  saveData(data: RolloverPluginData): Promise<void>;
  createWeekdayTemplate(name: string): Promise<boolean>;
}

export class WeekdayTemplateSettingTab extends PluginSettingTab {
  private readonly host: WeekdaySettingsHost;

  constructor(app: App, plugin: Plugin & WeekdaySettingsHost) {
    super(app, plugin);
    this.host = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Weekday templates" });
    containerEl.createEl("p", {
      text: "Pick a note from daily notes/templates for each weekday. The same note can be used on more than one day. A blank day keeps the core Daily Notes template. The chosen template is written only when today's note is first created.",
    });

    const choices = this.templateChoices();
    for (const key of WEEKDAY_KEYS) {
      new Setting(containerEl).setName(WEEKDAY_LABELS[key]).addDropdown((dropdown) => {
        dropdown.addOption("", "(core daily template)");
        for (const [value, label] of choices) {
          dropdown.addOption(value, label);
        }
        const current = this.host.data.weekdayTemplates?.[key] ?? "";
        if (current && !choices.some(([value]) => value === current)) {
          dropdown.addOption(current, current);
        }
        dropdown.setValue(current);
        dropdown.onChange(async (value) => {
          this.host.data.weekdayTemplates = {
            ...this.host.data.weekdayTemplates,
            [key]: value,
          };
          await this.host.saveData(this.host.data);
        });
      });
    }

    new Setting(containerEl)
      .setName("Create weekday template")
      .setDesc("Copy the current daily note template into daily notes/templates. Edit that note, then choose it above.")
      .addButton((button) => {
        button.setButtonText("Create weekday template").setCta().onClick(() => {
          new CreateWeekdayTemplateModal(this.app, (name) => {
            void this.host.createWeekdayTemplate(name).then((created) => {
              if (created) this.display();
            });
          }).open();
        });
      });
  }

  private templateChoices(): [string, string][] {
    const folder = this.app.vault.getAbstractFileByPath(TEMPLATES_FOLDER);
    if (!(folder instanceof TFolder)) return [];
    return folder.children
      .filter((child): child is TFile => child instanceof TFile && child.extension === "md")
      .map((file) => [file.path.replace(/\.md$/i, ""), file.basename] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }
}

class CreateWeekdayTemplateModal extends Modal {
  private name = "";

  constructor(app: App, private readonly onSubmit: (name: string) => void) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Create weekday template");
    new Setting(this.contentEl).setName("Name").addText((text) => {
      text.setPlaceholder("weekend");
      text.onChange((value) => {
        this.name = value;
      });
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.submit();
        }
      });
    });
    new Setting(this.contentEl).addButton((button) => {
      button.setButtonText("Create").setCta().onClick(() => this.submit());
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private submit(): void {
    if (!weekdayTemplateFilePath(this.name)) {
      new Notice("Enter a template name.");
      return;
    }
    this.onSubmit(this.name);
    this.close();
  }
}
