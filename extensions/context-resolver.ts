import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

function expandSystemPrompt(prompt: string): string {
  const lines = prompt.split("\n");
  const expanded: string[] = [];

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
      } else {
        expanded.push(line);
      }
    } else {
      expanded.push(line);
    }
  }

  return expanded.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, _ctx) => {
    const resolvedPrompt = expandSystemPrompt(event.systemPrompt);
    return {
      systemPrompt: resolvedPrompt,
    };
  });
}
