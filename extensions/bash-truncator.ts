import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MAX_LINES  = 150;
const HEAD_LINES = 100;
const TAIL_LINES = 20;

const ERROR_PATTERNS = [
  /^(Error|ERROR|error):/m,
  /^npm ERR!/m,
  /\bexited with code [1-9]/i,
  /\breturn code [1-9]/i,
  /^Command failed:/m,
  /^Action blocked:/m,
  /^FAILED$/m,
  /\bfatal:/im,
  /\bTraceback \(most recent call last\)/m,
  /\bSyntaxError:/m,
  /\bTypeError:/m,
  /\bReferenceError:/m,
];

function looksLikeError(text: string): boolean {
  return ERROR_PATTERNS.some((p) => p.test(text));
}

function summarizeJson(parsed: unknown): string {
  if (Array.isArray(parsed)) {
    const preview = JSON.stringify(parsed[0] ?? null).slice(0, 120);
    return `[JSON Array — ${parsed.length} items]\nFirst item: ${preview}`;
  }
  if (parsed !== null && typeof parsed === "object") {
    const keys = Object.keys(parsed as object);
    const summary = keys
      .slice(0, 20)
      .map((k) => {
        const v = (parsed as Record<string, unknown>)[k];
        const t = Array.isArray(v) ? `Array(${(v as unknown[]).length})` : typeof v;
        return `  ${k}: ${t}`;
      })
      .join("\n");
    const extra = keys.length > 20 ? `\n  ... ${keys.length - 20} more keys` : "";
    return `[JSON Object — ${keys.length} keys]\n${summary}${extra}`;
  }
  return JSON.stringify(parsed);
}

function truncatePlainText(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= MAX_LINES) return text;
  const head = lines.slice(0, HEAD_LINES);
  const tail = lines.slice(lines.length - TAIL_LINES);
  const dropped = lines.length - HEAD_LINES - TAIL_LINES;
  return [...head, `[... ${dropped} lines truncated ...]`, ...tail].join("\n");
}

function processOutput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== "object") {
        return truncatePlainText(raw);
      }
      return summarizeJson(parsed);
    } catch {
      // not valid JSON — fall through
    }
  }
  return truncatePlainText(raw);
}

export default function (pi: ExtensionAPI): void {
  pi.on("tool_result", (event, _ctx) => {
    if (event.toolName !== "bash" && event.toolName !== "safe_bash") return;
    if (event.isError) return;

    const firstText = event.content.find((c) => c.type === "text");
    if (!firstText || firstText.type !== "text") return;

    const rawText: string = firstText.text;
    if (!rawText) return;
    if (looksLikeError(rawText)) return;

    const processed = processOutput(rawText);
    if (processed === rawText) return;

    const idx = event.content.indexOf(firstText);
    const newContent = [...event.content];
    newContent[idx] = { type: "text" as const, text: processed };
    return { content: newContent };
  });
}
