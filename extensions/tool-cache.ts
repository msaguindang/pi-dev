import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── Session-scoped cache (survives across tool calls, reset on process restart) ──
interface CacheEntry {
  content: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

// Only these tools are eligible for caching
const CACHED_TOOLS = new Set(["bash", "safe_bash"]);

// Safe read-only patterns — commands with no side effects that change rarely mid-session
// find: blocked if it contains -delete, -exec, -execdir, or -ok (destructive flags)
const SAFE_READ_PATTERNS: RegExp[] = [
  /^(cat|head|tail|wc|file|which|type)\s/,
  /^(node|npm|npx\s+tsc)\s+--version/,
  /^ls(\s|$)/,
  /^find\s(?!.*\s(-delete|-exec|-execdir|-ok)\b)/,
];

function isCacheable(cmd: string): boolean {
  return SAFE_READ_PATTERNS.some((p) => p.test(cmd.trimStart()));
}

function cacheKey(toolName: string, cmd: string): string {
  return `${toolName}:${cmd}`;
}

function ageSeconds(ts: number): number {
  return Math.floor((Date.now() - ts) / 1000);
}

function evictExpired(): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.timestamp > TTL_MS) cache.delete(k);
  }
}

export default function (pi: ExtensionAPI): void {
  // ── After tool execution: cache hit → replace content; miss → store ───────
  pi.on("tool_result", (event, ctx) => {
    if (!CACHED_TOOLS.has(event.toolName)) return;
    if (event.isError) return;

    const cmd: string = ((event.input as Record<string, unknown>).command as string) ?? "";
    if (!cmd || !isCacheable(cmd)) return;

    evictExpired();

    const key = cacheKey(event.toolName, cmd);
    const entry = cache.get(key);

    if (entry) {
      // Cache hit — replace result with stored content so LLM sees consistent output
      const age = ageSeconds(entry.timestamp);
      ctx.ui.notify(`[cache hit] ${cmd} (${age}s ago)`);
      return { content: entry.content };
    }

    // Cache miss — store text content for future calls
    const textContent = event.content.filter(
      (c): c is { type: "text"; text: string } => c.type === "text"
    );
    if (textContent.length === 0) return;

    cache.set(key, { content: textContent, timestamp: Date.now() });
  });
}
