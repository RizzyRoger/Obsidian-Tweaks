import {
  allTodoTexts,
  childTexts,
  findCategory,
  findCheckboxByName,
  isRollable,
  parseNote,
  type Category,
  type TodoItem,
} from "./parse";

export interface RolledCategory {
  category: string;
  count: number;
}

export interface RolloverResult {
  content: string;
  changed: boolean;
  rolled: RolledCategory[];
  unmatchedCount: number;
}

interface Insertion {
  index: number;
  position: "after" | "before";
  lines: string[];
}

function formatTodo(indent: string, text: string): string {
  return `${indent}- [ ] ${text}`;
}

function childIndentFor(header: TodoItem, category?: Category): string {
  if (category?.children.length) {
    return category.children[0].indent;
  }
  return `${header.indent}\t`;
}

function rollableChildren(category: Category): TodoItem[] {
  return category.children.filter(isRollable);
}

function findClosingTemplateIndex(lines: string[]): number | null {
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "[[template]]") {
      indices.push(i);
    }
  }
  if (indices.length >= 2) {
    return indices[indices.length - 1];
  }
  return null;
}

function applyInsertions(lines: string[], insertions: Insertion[]): string[] {
  const next = [...lines];
  const ordered = [...insertions].sort((a, b) => b.index - a.index);
  for (const insertion of ordered) {
    const at = insertion.position === "after" ? insertion.index + 1 : insertion.index;
    next.splice(at, 0, ...insertion.lines);
  }
  return next;
}

function unmatchedBlock(category: Category, children: TodoItem[]): string[] {
  return [
    formatTodo(category.header.indent, category.header.text),
    ...children.map((child) => formatTodo(child.indent, child.text)),
  ];
}

export function mergeRollover(yesterdayContent: string, todayContent: string): RolloverResult {
  const yesterday = parseNote(yesterdayContent);
  const today = parseNote(todayContent);
  const insertions: Insertion[] = [];
  const rolled: RolledCategory[] = [];
  const unmatchedLines: string[] = [];
  let unmatchedCount = 0;
  const todayTexts = allTodoTexts(today);

  for (const category of yesterday.categories) {
    const pending = rollableChildren(category);
    if (pending.length === 0) continue;

    const todayCategory = findCategory(today, category.normalizedName);
    const todayHeader = findCheckboxByName(today, category.normalizedName);

    if (todayHeader) {
      const existing = todayCategory ? childTexts(todayCategory) : new Set<string>();
      const toAdd = pending.filter((child) => !existing.has(child.text.trim()));
      if (toAdd.length === 0) continue;

      const indent = childIndentFor(todayHeader, todayCategory);
      const insertAfter = todayCategory ? todayCategory.lastLineIndex : todayHeader.lineIndex;
      insertions.push({
        index: insertAfter,
        position: "after",
        lines: toAdd.map((child) => formatTodo(indent, child.text)),
      });
      rolled.push({ category: todayHeader.text.replace(/:+\s*$/, "") || category.name, count: toAdd.length });
    } else {
      unmatchedLines.push(...unmatchedBlock(category, pending));
      unmatchedCount += pending.length;
      rolled.push({ category: category.name.replace(/:+\s*$/, ""), count: pending.length });
    }
  }

  for (const item of yesterday.uncategorized) {
    if (!isRollable(item)) continue;
    if (todayTexts.has(item.text.trim())) continue;
    unmatchedLines.push(formatTodo(item.indent, item.text));
    unmatchedCount += 1;
    rolled.push({ category: "uncategorized", count: 1 });
  }

  if (unmatchedLines.length > 0) {
    const closing = findClosingTemplateIndex(today.lines);
    if (closing !== null) {
      const needsLeadingBlank = closing > 0 && today.lines[closing - 1].trim() !== "";
      const block = [
        ...(needsLeadingBlank ? [""] : []),
        ...unmatchedLines,
        "",
      ];
      insertions.push({ index: closing, position: "before", lines: block });
    } else {
      const block =
        today.lines.length > 0 && today.lines[today.lines.length - 1].trim() !== ""
          ? ["", ...unmatchedLines]
          : unmatchedLines;
      insertions.push({
        index: today.lines.length,
        position: "before",
        lines: block,
      });
    }
  }

  if (insertions.length === 0) {
    return { content: todayContent, changed: false, rolled: [], unmatchedCount: 0 };
  }

  const nextLines = applyInsertions(today.lines, insertions);
  return {
    content: nextLines.join("\n"),
    changed: true,
    rolled,
    unmatchedCount,
  };
}

export function formatRolloverNotice(result: RolloverResult): string {
  if (!result.changed) {
    return "Nothing to roll over.";
  }

  const parts = result.rolled.map((entry) => {
    const noun = entry.count === 1 ? "task" : "tasks";
    if (entry.category === "uncategorized") {
      return `${entry.count} ${noun} to the bottom`;
    }
    return `${entry.count} ${noun} into ${entry.category}`;
  });

  if (parts.length === 1) {
    return `Rolled ${parts[0]}.`;
  }
  const last = parts.pop();
  return `Rolled ${parts.join(", ")} and ${last}.`;
}
