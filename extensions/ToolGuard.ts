import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    // Only enforce confirmation if there is an active UI (i.e. Interactive mode)
    if (!ctx.hasUI) return;

    // We no longer block edit and write, allowing standard autonomous coding.
    // We only block raw bash if it contains explicitly destructive commands, 
    // delegating safe infrastructure changes to safe_bash (which is unblocked).
    if (event.toolName === "bash" && event.input.command) {
        const cmd = event.input.command.toLowerCase();
        
        // Define explicitly destructive signatures based on policy
        const isDestructive = 
            cmd.includes("rm -rf") || 
            cmd.includes("git reset --hard") || 
            cmd.includes("push --force") || 
            cmd.includes("apt remove") || 
            cmd.includes("apt purge");

        // Allow execution in isolated /tmp directories without prompting
        const isIsolated = cmd.includes("/tmp/") && !cmd.includes("~") && !cmd.includes("/home/");

        if (isDestructive && !isIsolated) {
          const confirmed = await ctx.ui.confirm(
            "Destructive Action Blocked",
            `A destructive command was detected: '${event.input.command}'.\n\nAccording to the tool policy, this requires explicit manual approval. Allow execution?`
          );

          if (!confirmed) {
            return { block: true, reason: "User denied execution." };
          }
        }
    }
  });
}