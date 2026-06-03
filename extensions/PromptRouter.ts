import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { classifyPrompt } from "./PromptClassifier";

export default function (pi: ExtensionAPI) {
  // We remove the prompt-transformation enforcement block from the input event
  pi.on("input", async (event, ctx) => {
    // Skip extension-injected messages
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const decision = classifyPrompt(event.text);
    
    // Auto-route model based on classification to optimize cost vs capability
    if (decision === "DIRECT") {
      // Find and switch to Gemini Flash for simple Q&A
      const model = ctx.modelRegistry.find("google", "gemini-3.1-flash-lite") ||
                    ctx.modelRegistry.find("google", "gemini-3.5-flash") ||
                    ctx.modelRegistry.find("google", "gemini-3.1-pro-preview-customtools");
      if (model && ctx.model?.id !== model.id) {
        const success = await pi.setModel(model);
        if (success) {
          ctx.ui.notify(`Routed to ${model.name || model.id} (low-cost Q&A)`, "info");
        }
      }
    } else if (decision === "DELEGATE") {
      // Find and switch to Claude Sonnet for delegation tasks
      const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-6") ||
                    ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5") ||
                    ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5-20250929");
      if (model && ctx.model?.id !== model.id) {
        const ok = await ctx.ui.confirm(
          "MODEL UPGRADE",
          `This task is classified as complex (${decision}).\nDo you want to temporarily upgrade to Claude Sonnet?\n\n(Selecting Cancel will keep the session on Gemini)`
        );
        if (ok) {
          const success = await pi.setModel(model);
          if (success) {
            ctx.ui.notify(`Upgraded to ${model.name || model.id} (high-capability)`, "success");
          }
        } else {
          ctx.ui.notify(`Staying on ${ctx.model?.id} as requested`, "info");
        }
      }
      ctx.ui.notify(`Use subagent({ agent, task }) or subagent({ tasks: [...] }) for parallel dispatch`, "info");
      return {
        action: "transform",
        text: `[DELEGATE: dispatch with subagent({ agent, task })] ${event.text}`
      };
    } else if (decision === "CHAIN") {
      // Find and switch to Claude Sonnet for pipeline tasks
      const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-6") ||
                    ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5") ||
                    ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5-20250929");
      if (model && ctx.model?.id !== model.id) {
        const ok = await ctx.ui.confirm(
          "MODEL UPGRADE",
          `This task is classified as complex (${decision}).\nDo you want to temporarily upgrade to Claude Sonnet?\n\n(Selecting Cancel will keep the session on Gemini)`
        );
        if (ok) {
          const success = await pi.setModel(model);
          if (success) {
            ctx.ui.notify(`Upgraded to ${model.name || model.id} (high-capability)`, "success");
          }
        } else {
          ctx.ui.notify(`Staying on ${ctx.model?.id} as requested`, "info");
        }
      }
      ctx.ui.notify(`Use subagent({ chain: [...] }) — multi-step pipeline with {previous} context handoff`, "info");
      return {
        action: "transform",
        text: `[CHAIN: pipeline with subagent({ chain: [...] })] ${event.text}`
      };
    }

    return { action: "continue" };
  });
}