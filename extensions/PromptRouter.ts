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
      const model = ctx.modelRegistry.find("google", "gemini-3.5-flash") || 
                    ctx.modelRegistry.find("google", "gemini-3.1-flash-lite") ||
                    ctx.modelRegistry.find("google", "gemini-3.1-pro-preview-customtools");
      if (model && ctx.model?.id !== model.id) {
        const success = await pi.setModel(model);
        if (success) {
          ctx.ui.notify(`Routed to ${model.name || model.id} (low-cost Q&A)`, "info");
        }
      }
    } else if (decision === "DELEGATE" || decision === "CHAIN") {
      // Find and switch to Claude Sonnet for complex coding/pipelines
      const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-6") || 
                    ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5") ||
                    ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5-20250929");
      if (model && ctx.model?.id !== model.id) {
        const success = await pi.setModel(model);
        if (success) {
          ctx.ui.notify(`Routed to ${model.name || model.id} (high-capability)`, "info");
        }
      }
    }
    
    if (decision === "DELEGATE" || decision === "CHAIN") {
      ctx.ui.notify(`Prompt routed as ${decision}`, "info");
      return { 
        action: "transform", 
        text: `[ROUTER CLASSIFICATION: ${decision}] ${event.text}` 
      };
    }

    return { action: "continue" };
  });

  // Inject the style enforcement silently at the bottom of the system prompt
  // instead of appending it to every user message in the chat history.
  pi.on("before_agent_start", (event) => {
    const enforcementBlock = `\n\n[ENFORCEMENT]: You MUST format your response using exactly the 'Diagnosis', 'Applied', and 'Next' sections. Use the Unicode bullet character (•) for lists. Leave a blank line between every list item. No chitchat or filler phrases. 'Next' MUST NOT contain actions you have already executed; they are strictly for proposing immediate next steps, unresolved issues, or follow-up actions required.`;
    
    return {
      systemPrompt: event.systemPrompt + enforcementBlock
    };
  });
}