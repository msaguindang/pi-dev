import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { classifyPrompt } from "./PromptClassifier";

function loadWorkerModel(): string {
  try {
    const raw = readFileSync(join(homedir(), ".pi", "agent", "routing.json"), "utf-8");
    const config = JSON.parse(raw);
    return config?.worker?.model ?? "gpt-5.5";
  } catch {
    return "gpt-5.5";
  }
}

const workerModel = loadWorkerModel();

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const decision = classifyPrompt(event.text);

    if (decision === "DELEGATE") {
      ctx.ui.notify(
        `Dispatch with subagent({ agent, task, model: "${workerModel}" }) or subagent({ tasks: [...], model: "${workerModel}" })`,
        "info"
      );
      return {
        action: "transform",
        text: `[DELEGATE: dispatch with subagent({ agent, task, model: "${workerModel}" })] ${event.text}`,
      };
    } else if (decision === "CHAIN") {
      ctx.ui.notify(
        `Pipeline with subagent({ chain: [...], model: "${workerModel}" }) — use {previous} for context handoff`,
        "info"
      );
      return {
        action: "transform",
        text: `[CHAIN: pipeline with subagent({ chain: [...], model: "${workerModel}" })] ${event.text}`,
      };
    }

    return { action: "continue" };
  });
}
