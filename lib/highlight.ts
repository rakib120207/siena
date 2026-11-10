export type TokenType = "k" | "s" | "c" | "n" | "f" | "t";

export interface Token {
  type: TokenType | null;
  value: string;
}

const KEYWORDS = new Set(
  (
    "abstract and as assert async await break case catch class const continue def default defer del do elif else enum except " +
    "export extends false final finally fn for from func function go if impl implements import in instanceof interface is lambda " +
    "let loop match mut namespace new nil not null of or package pass private protected pub public raise return select self " +
    "static struct super switch this throw throws trait true try type typeof undefined unsafe use using var void where while " +
    "with yield True False None"
  ).split(" ")
);

const HASH_LANGS = new Set([
  "python", "py", "bash", "sh", "shell", "zsh", "yaml", "yml", "ruby", "rb", "toml",
  "dockerfile", "r", "perl", "makefile", "make", "ini", "conf", "powershell", "ps1", "env",
]);
const SQL_LANGS = new Set(["sql", "mysql", "postgres", "postgresql", "sqlite", "lua", "haskell"]);
const PLAIN_LANGS = new Set([
  "json", "html", "xml", "text", "txt", "plaintext", "markdown", "md", "csv", "diff", "log", "svg",
]);

const patternCache = new Map<string, RegExp>();

function buildPattern(lang: string): RegExp {
  const cached = patternCache.get(lang);
  if (cached) return new RegExp(cached.source, "g");

  let comment: string;
  if (HASH_LANGS.has(lang)) comment = "#[^\\n]*";
  else if (SQL_LANGS.has(lang)) comment = "--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";
  else if (PLAIN_LANGS.has(lang)) comment = "(?!)";
  else comment = "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";

  const string =
    "\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`";
  const number = "\\b0x[0-9a-fA-F]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b";
  const word = "[A-Za-z_$][\\w$]*";

  const regex = new RegExp(`(${comment})|(${string})|(${number})|(${word})`, "g");
  patternCache.set(lang, regex);
  return new RegExp(regex.source, "g");
}

export function highlight(code: string, rawLang: string): Token[] {
  const lang = rawLang.toLowerCase();
  if (code.length > 20000) return [{ type: null, value: code }];

  const regex = buildPattern(lang);
  const tokens: Token[] = [];
  let last = 0;
  let match: RegExpExecArray | null = regex.exec(code);

  const push = (type: TokenType | null, value: string) => {
    if (!value) return;
    const prev = tokens[tokens.length - 1];
    if (prev && prev.type === type) prev.value += value;
    else tokens.push({ type, value });
  };

  while (match !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      match = regex.exec(code);
      continue;
    }
    if (match.index > last) push(null, code.slice(last, match.index));
    const text = match[0];
    if (match[1] !== undefined) push("c", text);
    else if (match[2] !== undefined) push("s", text);
    else if (match[3] !== undefined) push("n", text);
    else if (KEYWORDS.has(text)) push("k", text);
    else if (code[match.index + text.length] === "(") push("f", text);
    else if (/^[A-Z][a-z]/.test(text)) push("t", text);
    else push(null, text);
    last = match.index + text.length;
    match = regex.exec(code);
  }
  if (last < code.length) push(null, code.slice(last));
  return tokens;
}
