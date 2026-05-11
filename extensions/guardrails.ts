import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const cmd = event.input.command ?? "";

    // ── Destructive filesystem ────────────────────────────────────────────
    if (/rm\s+-rf?\s+\/var\/www\/html/.test(cmd)) {
      const ok = await ctx.ui.confirm("GUARDRAIL", "rm -rf on NTV asset dir — allow?");
      if (!ok) return { block: true, reason: "Blocked: destructive op on NTV asset directory" };
    }

    if (/rm\s+-rf?\s+\/data\/dev\/work\/ntv/.test(cmd)) {
      const ok = await ctx.ui.confirm("GUARDRAIL", "rm -rf inside NTV workspace — allow?");
      if (!ok) return { block: true, reason: "Blocked: destructive op on NTV workspace" };
    }

    // ── Sensitive files ───────────────────────────────────────────────────
    if (/>\s*(\.env|auth\.json|\.runner\/\.env|ec2_key\.pem)/.test(cmd)) {
      return { block: true, reason: "Blocked: write redirect to sensitive file detected" };
    }

    // ── Git push guardrails ───────────────────────────────────────────────
    if (/git\s+push/.test(cmd)) {
      // Force push — always block
      if (/--force|-f/.test(cmd)) {
        return { block: true, reason: "Blocked: force push not allowed" };
      }

      // Push to production branches — confirm
      if (/\b(main|master|dev-deploy-environment)\b/.test(cmd)) {
        const ok = await ctx.ui.confirm("GUARDRAIL", `git push to production branch detected:\n${cmd}\n\nAllow?`);
        if (!ok) return { block: true, reason: "Blocked: push to production branch denied" };
      }
    }

    // ── SSH to production RPi — confirm ───────────────────────────────────
    if (/ssh|scp|sshpass/.test(cmd)) {
      const ok = await ctx.ui.confirm("GUARDRAIL", `SSH/SCP operation detected:\n${cmd}\n\nAllow?`);
      if (!ok) return { block: true, reason: "Blocked: SSH operation denied" };
    }

    // ── npm publish / dangerous global installs ───────────────────────────
    if (/npm\s+publish/.test(cmd)) {
      return { block: true, reason: "Blocked: npm publish requires manual execution" };
    }

    // ── v2 deploy pipeline — confirm ──────────────────────────────────────
    if (/forgejo|aptly|electron-builder/.test(cmd)) {
      const ok = await ctx.ui.confirm("GUARDRAIL", `v2 deploy operation detected:\n${cmd}\n\nAllow?`);
      if (!ok) return { block: true, reason: "Blocked: v2 deploy operation denied" };
    }

    // ── Local tarball protection ───────────────────────────────────────────
    if (/npm\s+install.*nct-vistar/.test(cmd)) {
      return { block: true, reason: "Blocked: nct-vistar must use local tarball — never fetch from npm" };
    }

    // ── Worktree enforcement ───────────────────────────────────────────────
    if (/git\s+(checkout\s+-b|switch\s+-c)/.test(cmd) && !/git\s+worktree\s+add/.test(cmd)) {
      const ok = await ctx.ui.confirm(
        "GUARDRAIL",
        `Branch creation without worktree detected:\n${cmd}\n\nUse 'git worktree add' for implementation work. Allow anyway?`
      );
      if (!ok) return { block: true, reason: "Blocked: use git worktree add for isolated branch work" };
    }
  });
}
