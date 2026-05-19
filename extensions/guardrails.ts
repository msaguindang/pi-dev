import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // ── Edit tool — confirm before modifying config files ──────────────────
  // Guards against ask-then-execute: agent proposes a change in prose,
  // then immediately writes it without waiting for user confirmation.
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "edit" || event.toolName === "write") {
      const path: string = event.input.path ?? "";
      const configPatterns = [
        /dotfiles\/wm\//,          // all WM configs (hyprland, i3, picom, polybar, waybar)
        /\.config\/hypr\//,        // live hyprland config dir
        /\.config\/waybar\//,      // waybar
        /dotfiles\/wm\/i3\//,      // i3 config
        /guardrails\.ts/,          // this file itself
        /AGENTS\.md/,              // agent instructions
        /long-term\.md/,           // long-term context
        /\.pi\/agent\/extensions\//,  // pi agent extensions — code changes must go to worker
        /\.pi\/agent\/AGENTS\.md/,    // pi agent instructions
        /\.agents\/context\//,        // agent context files
        /\.agents\/standards\//,      // agent standards
        /\.agents\/roles\//,          // agent role definitions
      ];
      if (configPatterns.some(p => p.test(path))) {
        const ok = await ctx.ui.confirm(
          "GUARDRAIL",
          `Agent is about to edit a config file:\n${path}\n\nApply change?`
        );
        if (!ok) return { block: true, reason: "Blocked: config file edit denied by user" };
      }
      return;
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const cmd = event.input.command ?? "";

    // ── Principle 2: Never rm -rf a directory a running process watches ────
    // Compositor, WM, and service config directories — deleting them mid-session
    // causes inotify watchers to reload into empty state (lost 80 Hyprland binds).
    const watchedConfigDirs = [
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/hypr/,
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/waybar/,
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/i3/,
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/sway/,
    ];
    if (watchedConfigDirs.some(p => p.test(cmd))) {
      const ok = await ctx.ui.confirm(
        "GUARDRAIL",
        `rm -rf on a compositor/WM config directory detected:\n${cmd}\n\nA running compositor watches this path via inotify.\nDeleting it mid-session causes it to reload empty.\n\nSafe order: write new files → swap symlink → reload.\n\nProceed anyway?`
      );
      if (!ok) return { block: true, reason: "Blocked: rm -rf on watched compositor config directory" };
    }

    // ── Principle 6: Confirm before mutating live system config ──────────────
    // Any in-place overwrite of a running service's config file requires
    // confirmation — the file is only a proposal until the process accepts it.
    const liveServiceConfigs = [
      /tee\s+.*\/(systemd|hypr|waybar|i3|sway|picom)\/.*\.conf/,
      /tee\s+.*\.service$/,
      />\s*~?\/?etc\/systemd/,
    ];
    if (liveServiceConfigs.some(p => p.test(cmd))) {
      const ok = await ctx.ui.confirm(
        "GUARDRAIL",
        `Live service config overwrite detected:\n${cmd}\n\nThis writes directly to a config a running process owns.\nAlways validate with a runtime check after applying.\n\nProceed?`
      );
      if (!ok) return { block: true, reason: "Blocked: live service config overwrite denied" };
    }

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
