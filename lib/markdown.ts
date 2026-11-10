export type Align = "left" | "center" | "right" | null;

export interface ListItem {
  blocks: Block[];
}

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; blocks: Block[] }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "table"; header: string[]; align: Align[]; rows: string[][] }
  | { type: "hr" };

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_MARKER = /^(\s*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

function indentOf(line: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === " ") count += 1;
    else if (ch === "\t") count += 4;
    else break;
  }
  return count;
}

export function splitRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "|") {
      current += "|";
      i += 1;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseAlign(cell: string): Align {
  const t = cell.trim();
  const left = t.startsWith(":");
  const right = t.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function isTableStart(lines: string[], i: number): boolean {
  const header = lines[i];
  const sep = lines[i + 1];
  if (header === undefined || sep === undefined) return false;
  if (!header.includes("|") || !sep.includes("-") || !TABLE_SEP.test(sep)) return false;
  return splitRow(header).length === splitRow(sep).length;
}

function startsListItem(line: string, interrupting: boolean): boolean {
  const m = LIST_MARKER.exec(line);
  if (!m) return false;
  if (!interrupting) return true;
  if (HR.test(line)) return false;
  const marker = m[2];
  if (/^\d/.test(marker)) return parseInt(marker, 10) === 1;
  return true;
}

function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HR.test(line) ||
    /^ {0,3}>/.test(line) ||
    startsListItem(line, true) ||
    isTableStart(lines, i)
  );
}

function parseList(lines: string[], start: number): { block: Block; next: number } {
  const first = LIST_MARKER.exec(lines[start]) as RegExpExecArray;
  const baseIndent = indentOf(first[1]);
  const ordered = /^\d/.test(first[2]);
  const startNumber = ordered ? parseInt(first[2], 10) : 1;
  const items: ListItem[] = [];

  let i = start;
  while (i < lines.length) {
    const m = LIST_MARKER.exec(lines[i]);
    if (!m || indentOf(m[1]) > baseIndent + 1 || indentOf(m[1]) < baseIndent - 1) break;
    if (/^\d/.test(m[2]) !== ordered) break;

    const contentIndent = indentOf(m[1]) + m[2].length + 1;
    const body: string[] = [m[3]];
    i += 1;

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === "") j += 1;
        if (j >= lines.length) {
          i = j;
          break;
        }
        const nextLine = lines[j];
        const nextIndent = indentOf(nextLine);
        const nextIsSibling = LIST_MARKER.test(nextLine) && nextIndent <= baseIndent + 1;
        if (nextIsSibling) {
          i = j;
          break;
        }
        if (nextIndent > baseIndent + 1) {
          for (let k = i; k < j; k += 1) body.push("");
          i = j;
          continue;
        }
        break;
      }
      const indent = indentOf(line);
      const isMarker = LIST_MARKER.test(line);
      if (isMarker && indent <= baseIndent + 1) break;
      if (!isMarker && indent <= baseIndent && (FENCE.test(line) || HEADING.test(line) || HR.test(line))) break;
      body.push(stripIndent(line, Math.min(contentIndent, indent)));
      i += 1;
    }
    items.push({ blocks: parseBlocks(body) });
  }

  return { block: { type: "list", ordered, start: startNumber, items }, next: i };
}

function stripIndent(line: string, amount: number): string {
  let removed = 0;
  let index = 0;
  while (index < line.length && removed < amount) {
    if (line[index] === " ") removed += 1;
    else if (line[index] === "\t") removed += 4;
    else break;
    index += 1;
  }
  return line.slice(index);
}

export function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const indent = indentOf(line);
      const body: string[] = [];
      i += 1;
      while (i < lines.length) {
        const candidate = lines[i].trim();
        if (candidate.startsWith(marker[0].repeat(marker.length)) && /^(`+|~+)$/.test(candidate)) {
          i += 1;
          break;
        }
        body.push(stripIndent(lines[i], indent));
        i += 1;
      }
      blocks.push({ type: "code", lang: fence[2] || "", code: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
        inner.push(lines[i].replace(/^ {0,3}> ?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", blocks: parseBlocks(inner) });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i]);
      const align = splitRow(lines[i + 1]).map(parseAlign);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        const cells = splitRow(lines[i]);
        while (cells.length < header.length) cells.push("");
        rows.push(cells.slice(0, header.length));
        i += 1;
      }
      blocks.push({ type: "table", header, align, rows });
      continue;
    }

    if (startsListItem(line, false)) {
      const result = parseList(lines, i);
      blocks.push(result.block);
      i = result.next;
      continue;
    }

    const paragraph: string[] = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines, i)) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}

export function parseMarkdown(source: string): Block[] {
  return parseBlocks(source.replace(/\r\n?/g, "\n").split("\n"));
}

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "br" }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "del"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

const ESCAPABLE = "\\`*_{}[]()#+-.!|~<>";

export function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return trimmed;
  return null;
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

function findSingleClose(text: string, marker: string, from: number): number {
  for (let j = from; j < text.length; j += 1) {
    if (text[j] === "\\") {
      j += 1;
      continue;
    }
    if (text[j] !== marker) continue;
    if (text[j + 1] === marker || text[j - 1] === marker) continue;
    if (/\s/.test(text[j - 1] ?? " ")) continue;
    if (marker === "_" && isWordChar(text[j + 1])) continue;
    return j;
  }
  return -1;
}

function findDoubleClose(text: string, marker: string, from: number): number {
  for (let j = from; j < text.length - 1; j += 1) {
    if (text[j] === "\\") {
      j += 1;
      continue;
    }
    if (text[j] === marker[0] && text[j + 1] === marker[1] && !/\s/.test(text[j - 1] ?? " ")) return j;
  }
  return -1;
}

function findLinkEnd(text: string, open: number): { textEnd: number; urlEnd: number } | null {
  let depth = 0;
  let close = -1;
  for (let j = open; j < text.length; j += 1) {
    if (text[j] === "\\") {
      j += 1;
      continue;
    }
    if (text[j] === "[") depth += 1;
    else if (text[j] === "]") {
      depth -= 1;
      if (depth === 0) {
        close = j;
        break;
      }
    }
  }
  if (close < 0 || text[close + 1] !== "(") return null;
  let parens = 0;
  for (let j = close + 1; j < text.length; j += 1) {
    if (text[j] === "(") parens += 1;
    else if (text[j] === ")") {
      parens -= 1;
      if (parens === 0) return { textEnd: close, urlEnd: j };
    }
  }
  return null;
}

export function parseInline(text: string, depth = 0): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      out.push({ type: "text", value: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\" && i + 1 < text.length) {
      if (text[i + 1] === "\n") {
        flush();
        out.push({ type: "br" });
        i += 2;
        continue;
      }
      if (ESCAPABLE.includes(text[i + 1])) {
        buf += text[i + 1];
        i += 2;
        continue;
      }
    }

    if (ch === "\n") {
      if (buf.endsWith("  ")) {
        buf = buf.replace(/ +$/, "");
        flush();
        out.push({ type: "br" });
      } else {
        buf += " ";
      }
      i += 1;
      continue;
    }

    if (ch === "`") {
      let run = 1;
      while (text[i + run] === "`") run += 1;
      const fence = "`".repeat(run);
      let end = text.indexOf(fence, i + run);
      while (end !== -1 && text[end + run] === "`") end = text.indexOf(fence, end + run + 1);
      if (end !== -1) {
        flush();
        let value = text.slice(i + run, end);
        if (value.length > 2 && value.startsWith(" ") && value.endsWith(" ")) value = value.slice(1, -1);
        out.push({ type: "code", value });
        i = end + run;
        continue;
      }
      buf += fence;
      i += run;
      continue;
    }

    if (depth < 8) {
      if ((ch === "*" || ch === "_") && text[i + 1] === ch && text[i + 2] !== undefined && !/\s/.test(text[i + 2])) {
        const canOpen = ch === "*" || !isWordChar(text[i - 1]);
        const end = canOpen ? findDoubleClose(text, ch + ch, i + 2) : -1;
        if (end > i + 2 && (ch === "*" || !isWordChar(text[end + 2]))) {
          flush();
          out.push({ type: "strong", children: parseInline(text.slice(i + 2, end), depth + 1) });
          i = end + 2;
          continue;
        }
      }

      if ((ch === "*" || ch === "_") && text[i + 1] !== ch && text[i + 1] !== undefined && !/\s/.test(text[i + 1])) {
        const canOpen = ch === "*" || !isWordChar(text[i - 1]);
        const end = canOpen ? findSingleClose(text, ch, i + 1) : -1;
        if (end > i + 1) {
          flush();
          out.push({ type: "em", children: parseInline(text.slice(i + 1, end), depth + 1) });
          i = end + 1;
          continue;
        }
      }

      if (ch === "~" && text[i + 1] === "~" && text[i + 2] !== undefined && !/\s/.test(text[i + 2])) {
        const end = findDoubleClose(text, "~~", i + 2);
        if (end > i + 2) {
          flush();
          out.push({ type: "del", children: parseInline(text.slice(i + 2, end), depth + 1) });
          i = end + 2;
          continue;
        }
      }

      if (ch === "[") {
        const link = findLinkEnd(text, i);
        if (link) {
          const label = text.slice(i + 1, link.textEnd);
          const target = text.slice(link.textEnd + 2, link.urlEnd).trim().split(/\s+/)[0] ?? "";
          const href = safeUrl(target.replace(/^<|>$/g, ""));
          flush();
          if (href) out.push({ type: "link", href, children: parseInline(label, depth + 1) });
          else out.push(...parseInline(label, depth + 1));
          i = link.urlEnd + 1;
          continue;
        }
      }
    }

    if ((ch === "h" || ch === "H") && /^https?:\/\//i.test(text.slice(i, i + 8)) && !isWordChar(text[i - 1])) {
      const match = /^https?:\/\/[^\s<>[\]]+/i.exec(text.slice(i));
      if (match) {
        let url = match[0];
        while (/[.,;:!?'")*_]$/.test(url)) {
          if (url.endsWith(")") && (url.match(/\(/g) ?? []).length >= (url.match(/\)/g) ?? []).length) break;
          url = url.slice(0, -1);
        }
        if (url.length > 8) {
          flush();
          out.push({ type: "link", href: url, children: [{ type: "text", value: url }] });
          i += url.length;
          continue;
        }
      }
    }

    buf += ch;
    i += 1;
  }

  flush();
  return out;
}
