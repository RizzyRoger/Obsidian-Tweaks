export interface TodoItem {
  lineIndex: number;
  raw: string;
  indent: string;
  checked: boolean;
  text: string;
}

export interface Category {
  name: string;
  normalizedName: string;
  header: TodoItem;
  children: TodoItem[];
  lastLineIndex: number;
}

export interface ParsedNote {
  lines: string[];
  categories: Category[];
  uncategorized: TodoItem[];
  todos: TodoItem[];
}

const TODO_RE = /^(\s*)- \[([^\]])\]\s*(.*)$/;

export function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

export function parseTodoLine(line: string, lineIndex: number): TodoItem | null {
  const match = line.match(TODO_RE);
  if (!match) return null;
  return {
    lineIndex,
    raw: line,
    indent: match[1],
    checked: match[2].toLowerCase() === "x",
    text: match[3],
  };
}

export function normalizeCategoryName(text: string): string {
  return text.replace(/:+\s*$/, "").trim().toLowerCase();
}

export function isPlaceholderText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const italicLabel = trimmed.match(/^\*([^*]+):\*\s*$/);
  return italicLabel !== null;
}

export function isRollable(item: TodoItem): boolean {
  return !item.checked && !isPlaceholderText(item.text);
}

export function indentLevel(indent: string): number {
  return indent.length;
}

export function parseNote(content: string): ParsedNote {
  const lines = splitLines(content);
  const todos: TodoItem[] = [];
  const categories: Category[] = [];
  const uncategorized: TodoItem[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const todo = parseTodoLine(lines[i], i);
    if (todo) todos.push(todo);
  }

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const header = parseTodoLine(lines[i], i);
    if (!header) continue;

    const childTodos: TodoItem[] = [];
    let lastLineIndex = i;
    const headerLevel = indentLevel(header.indent);

    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") {
        continue;
      }
      const leading = line.match(/^(\s*)/)?.[1] ?? "";
      if (indentLevel(leading) <= headerLevel) {
        break;
      }
      lastLineIndex = j;
      const child = parseTodoLine(line, j);
      if (child) {
        childTodos.push(child);
        consumed.add(j);
      }
    }

    if (childTodos.length > 0) {
      categories.push({
        name: header.text,
        normalizedName: normalizeCategoryName(header.text),
        header,
        children: childTodos,
        lastLineIndex,
      });
    } else {
      uncategorized.push(header);
    }
  }

  return { lines, categories, uncategorized, todos };
}

export function findCategory(
  parsed: ParsedNote,
  normalizedName: string
): Category | undefined {
  return parsed.categories.find((category) => category.normalizedName === normalizedName);
}

export function findCheckboxByName(
  parsed: ParsedNote,
  normalizedName: string
): TodoItem | undefined {
  const category = findCategory(parsed, normalizedName);
  if (category) return category.header;

  return parsed.uncategorized.find(
    (item) => normalizeCategoryName(item.text) === normalizedName
  );
}

export function childTexts(category: Category): Set<string> {
  return new Set(category.children.map((child) => child.text.trim()));
}

export function allTodoTexts(parsed: ParsedNote): Set<string> {
  return new Set(parsed.todos.map((todo) => todo.text.trim()));
}
