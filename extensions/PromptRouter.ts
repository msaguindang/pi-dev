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