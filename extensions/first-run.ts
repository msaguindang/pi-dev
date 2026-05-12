import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const MARKER = join(homedir(), ".agents/.personalized");

const SETUP_PROMPT = `
## FIRST-RUN SETUP

The agent identity has not been configured. Before doing anything else, guide the user through setup.

Ask the user the following questions **one at a time**, waiting for each answer:
1. "What is your name?"
2. "What is your role or title? (e.g. Senior Software Engineer, DevOps Engineer)"
3. "Describe your working style or core principles in 1-3 sentences. (e.g. how you approach problems, what you optimize for, any strong preferences)"

After all answers are collected:
- Write ~/.agents/context/identity.md in this exact format:
\`\`\`
# Identity: <Role>
- **Core Principles**: <principles from answer 3>
- **Operational Constraints**: Always create a plan before execution; use git worktree for implementation work.
- **Output Preferences**: Direct, concise, technical; minimize boilerplate.
- **Behavioral Flags**: Challenge assumptions; verify step-by-step using raw outputs.
\`\`\`
- Create the file ~/.agents/.personalized containing today's date (YYYY-MM-DD)
- Tell the user: "Identity configured. One more step: edit ~/.agents/context/environment.md with your machine paths and aliases. See ~/.agents/PERSONALIZE.md for guidance."

Do NOT do any other work until setup is complete.
`;

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, _ctx) => {
    if (existsSync(MARKER)) return {};
    return {
      systemPrompt: event.systemPrompt + "\n\n" + SETUP_PROMPT,
    };
  });
}
