# Rollover Categorical Todos

Obsidian plugin that copies unfinished todos from the previous daily note into **today's matching checkbox categories**, instead of dumping them at the bottom.

Disable **Rollover Daily Todos** before enabling this plugin. If both run, unfinished items will be copied twice.

## What counts as a category

A checkbox with indented checkbox children:

```
- [ ] Later
	- [ ] talk to mr.squi...
	- [ ] Talk to drmotgomery...
```

`hw:` matches `hw`. `Daylies` does not match `Dailies`.

## What rolls

- Unchecked children that have real text
- School-period lines only if they have text after the label (`*5th period:* mand quiz`)
- Not empty `- [ ]` lines, not bare `*nth period:*` / `*Morning:*` / `*Lunch:*` placeholders
- Not items whose exact text is already in today's matching category
- Yesterday's note is never edited

Unmatched categories (and leftover top-level todos) go just before the closing `[[template]]` marker, or at the end of the file if that marker is missing.

## When it runs

- When Obsidian opens, if today's daily note already exists (rollover only; an existing note is not rewritten)
- When today's daily note is created: the weekday template is applied first, then unfinished todos are rolled into it
- Command palette: **Rollover categorical todos now** (safe to re-run)

It uses the core Daily Notes folder (`daily notes`) and `YYYY-MM-DD` filenames, and reads from the most recent daily note before today.

## Weekday templates

Obsidian still has one Daily Notes template. This plugin can use a different note for each weekday. The assignment stays in place for every future week.

1. Settings → Rollover Categorical Todos → **Create weekday template**.
2. That copies `daily notes/template` to `daily notes/templates/<name>.md`. Edit the copy.
3. Choose that note for one or more weekdays. Several days can share one note. A blank day keeps the core template.

The weekday template is written only when today's daily note is first created, and only if that new file is still empty or still the core template. Opening a note that already exists leaves it as it is.

Keep the closing `[[template]]` line on templates that should hold **Long Term Hw** and **Idea**. A category the weekday template does not have is appended above that line.

## Install

From this folder:

```bash
npm install
npm test
npm run build
```

Then symlink the built plugin into the vault:

```bash
mkdir -p "/Users/rogerwei/Documents/Obsidian Vault/.obsidian/plugins/rollover-categorical-todos"
ln -sf "/Users/rogerwei/Documents/Obsidian Vault/Projects/rollover daily notes/main.js" "/Users/rogerwei/Documents/Obsidian Vault/.obsidian/plugins/rollover-categorical-todos/main.js"
ln -sf "/Users/rogerwei/Documents/Obsidian Vault/Projects/rollover daily notes/manifest.json" "/Users/rogerwei/Documents/Obsidian Vault/.obsidian/plugins/rollover-categorical-todos/manifest.json"
```

In Obsidian: Settings → Community plugins → enable **Rollover Categorical Todos**, and turn off **Rollover Daily Todos**.
