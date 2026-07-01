import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { classifyPrompt } from "./prompt-classifier";

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const decision = classifyPrompt(event.text);

    if (decision === "DELEGATE") {
      ctx.ui.notify(
        `Dispatch with subagent({ agent, task }) or subagent({ tasks: [...] })`,
        "info"
      );
      return {
        action: "transform",
        text: `[DELEGATE: dispatch with subagent({ agent, task })] ${event.text}`,
      };
    } else if (decision === "CHAIN") {
      ctx.ui.notify(
        `Pipeline with subagent({ chain: [...] }) — use {previous} for context handoff`,
        "info"
      );
      return {
        action: "transform",
        text: `[CHAIN: pipeline with subagent({ chain: [...] })] ${event.text}`,
      };
    }

    return { action: "continue" };
  });
}
