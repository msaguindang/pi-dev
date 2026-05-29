import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function init(pi: ExtensionAPI): void {
  // Helper function to update the status indicator
  function updateStatus(ctx: ExtensionContext) {
    if (!ctx.hasUI) return;
    const sessionName = pi.getSessionName();
    if (sessionName) {
      // Create a beautiful theme-supported inverse pill with accent color brackets
      const thm = ctx.ui.theme;
      const pillText = thm.inverse(` ${sessionName} `);
      const themedText = thm.fg("accent", `[${pillText}]`);
      ctx.ui.setStatus("session-name", themedText);
    } else {
      ctx.ui.setStatus("session-name", undefined);
    }
  }

  // Reactive Event Listeners
  pi.on("session_start", (_event, ctx) => {
    // Intercept both built-in /name and custom /name-session commands by wrapping appendSessionInfo
    const sm = ctx.sessionManager as any;
    if (sm && typeof sm.appendSessionInfo === "function" && !sm.__patched) {
      const originalAppend = sm.appendSessionInfo.bind(sm);
      sm.appendSessionInfo = (name: string) => {
        originalAppend(name);
        // Update TUI immediately when the session name is appended
        updateStatus(ctx);
      };
      sm.__patched = true;
    }
    updateStatus(ctx);
  });

  pi.on("turn_start", (_event, ctx) => {
    updateStatus(ctx);
  });

  // Register Custom Command "name-session"
  pi.registerCommand("name-session", {
    description: "Set a name for the current active session (usage: /name-session <name>)",
    handler: async (args, ctx) => {
      const newName = args.trim();
      if (newName) {
        pi.setSessionName(newName);
        ctx.ui.notify(`Session name set to: "${newName}"`, "success");
      } else {
        const current = pi.getSessionName();
        ctx.ui.notify(current ? `Session name: "${current}"` : "No session name set", "info");
      }
    },
  });
}
