import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

interface ExpandResult {
  prompt: string;
  resolved: string[];
  failed: string[];
}

function expandSystemPrompt(prompt: string): ExpandResult {
  const lines = prompt.split("\n");
  const expanded: string[] = [];
  const resolved: string[] = [];
  const failed: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("@")) {
      const relPath = line.trim().slice(1);
      const absPath = relPath.startsWith("~")
        ? relPath.replace(/^~/, homedir())
        : resolve(relPath);

      if (existsSync(absPath)) {
        expanded.push(`\n<!-- BEGIN DYNAMIC RESOLUTION: ${relPath} -->\n`);
        expanded.push(readFileSync(absPath, "utf-8"));
        expanded.push(`\n<!-- END DYNAMIC RESOLUTION: ${relPath} -->\n`);
        resolved.push(relPath);
      } else {
        expanded.push(line);
        failed.push(relPath);
      }
    } else {
      expanded.push(line);
    }
  }

  return { prompt: expanded.join("\n"), resolved, failed };
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const { prompt: resolvedPrompt, resolved, failed } = expandSystemPrompt(event.systemPrompt);

    if (resolved.length || failed.length) {
      const lines: string[] = [];
      if (resolved.length) lines.push(`✓ ${resolved.join(", ")}`);
      if (failed.length) lines.push(`✗ MISSING: ${failed.join(", ")}`);
      ctx.ui.notify(lines.join(" | "), failed.length > 0 ? "warning" : "info");
    }

    return {
      systemPrompt: resolvedPrompt,
    };
  });
}
