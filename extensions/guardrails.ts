import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execSync } from "child_process";

const pendingBackups = new Map<string, string | "NEW_FILE">();

export default function (pi: ExtensionAPI) {
  // ── Universal Dry-Run/Validation Gateway ──────────────────────────────
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "edit" || event.toolName === "write") {
      const targetFile = event.input.path as string;
      if (!targetFile) return;

      if (fs.existsSync(targetFile)) {
        const hash = crypto.randomBytes(8).toString("hex");
        const tmpPath = `/tmp/backup_${hash}_${path.basename(targetFile)}`;
        fs.copyFileSync(targetFile, tmpPath);
        pendingBackups.set(event.callId, tmpPath);
      } else {
        pendingBackups.set(event.callId, "NEW_FILE");
      }
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName === "edit" || event.toolName === "write") {
      const backupPath = pendingBackups.get(event.callId);
      if (!backupPath) return;

      const targetFile = event.input.path as string;
      const ext = path.extname(targetFile);
      const fileName = path.basename(targetFile);

      let validator: string | null = null;
      if (ext === ".sh") validator = `bash -n ${targetFile}`;
      else if (ext === ".js") validator = `node -c ${targetFile}`;
      else if (ext === ".json") validator = `jq empty ${targetFile}`;
      else if (fileName === "config" && targetFile.includes("i3")) validator = `i3 -C -c ${targetFile}`;

      if (validator) {
        try {
          execSync(validator, { stdio: "pipe" });
        } catch (e: any) {
          // Validation failed: revert
          if (backupPath === "NEW_FILE") {
            if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
          } else {
            fs.copyFileSync(backupPath, targetFile);
          }

          // Override the tool result so the LLM sees the error
          const stderr = e.stderr ? e.stderr.toString() : e.message;
          const newResult = {
            error: "Validation failed, file reverted.",
            validator: validator,
            details: stderr
          };
          
          if (typeof event.result === "string") {
            event.result = JSON.stringify(newResult);
          } else {
            // Assume object format
            (event.result as any).data = newResult;
          }
        }
      }

      // Cleanup
      if (backupPath !== "NEW_FILE" && fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      pendingBackups.delete(event.callId);
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const cmd = event.input.command ?? "";
    let rmHandled = false;

    // Protected paths and dangerous bash ops...
    const watchedConfigDirs = [
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/hypr/,
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/waybar/,
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/i3/,
      /rm\s+-rf?\s+~?\/?home\/[^/]+\/\.config\/sway/,
    ];
    if (watchedConfigDirs.some(p => p.test(cmd))) {
      const ok = await ctx.ui.confirm("GUARDRAIL", `rm -rf on a compositor config detected. Proceed anyway?`);
      rmHandled = true;
      if (!ok) return { block: true, reason: "Blocked" };
    }
    const liveServiceConfigs = [
      /tee\s+.*\/(systemd|hypr|waybar|i3|sway|picom)\/.*\.conf/,
      /tee\s+.*\.service$/,
      />\s*~?\/?etc\/systemd/,
    ];
    if (liveServiceConfigs.some(p => p.test(cmd))) {
      const ok = await ctx.ui.confirm("GUARDRAIL", `Live service config overwrite detected. Proceed?`);
      if (!ok) return { block: true, reason: "Blocked" };
    }
    const projectPaths = [
      process.env.NTV_DIR ?? "/data/dev/work/ntv",
      "/var/www/html",
    ].filter(Boolean);
    for (const projectPath of projectPaths) {
      const escaped = projectPath.replace(/[\/]/g, "\\/");
      if (new RegExp(`rm\\s+-rf?\\s+${escaped}`).test(cmd)) {
        const ok = await ctx.ui.confirm("GUARDRAIL", `rm -rf on project path detected. Allow?`);
        rmHandled = true;
        if (!ok) return { block: true, reason: `Blocked` };
      }
    }
    // General rm -rf catch-all (paths not covered by specific guards above)
    if (/rm\s+-rf?\s+/.test(cmd) && !rmHandled) {
      const isIsolated = cmd.includes("/tmp/") && !cmd.includes("~") && !cmd.includes("/home/");
      if (!isIsolated) {
        const ok = await ctx.ui.confirm("GUARDRAIL", `rm -rf detected. Proceed?`);
        if (!ok) return { block: true, reason: "Blocked" };
      }
    }
    if (/>\s*(\.env|auth\.json|\.runner\/\.env|ec2_key\.pem)/.test(cmd)) {
      return { block: true, reason: "Blocked" };
    }
    if (/infisical\s+(secrets|export)/.test(cmd)) {
      return { block: true, reason: "Blocked" };
    }
    if (/git\s+push/.test(cmd)) {
      if (/--force|(?<![a-zA-Z])-f(?![a-zA-Z])/.test(cmd)) {
        return { block: true, reason: "Blocked" };
      }
      const productionBranches = ["main", "master", process.env.DEPLOY_BRANCH ?? "dev-deploy-environment"];
      const branchPattern = new RegExp(`\\b(${productionBranches.join("|")})\\b`);
      if (branchPattern.test(cmd)) {
        const ok = await ctx.ui.confirm("GUARDRAIL", `git push to production branch detected. Allow?`);
        if (!ok) return { block: true, reason: "Blocked" };
      }
    }
    if (/git\s+reset\s+--hard/.test(cmd)) {
      const isIsolated = cmd.includes("/tmp/") && !cmd.includes("~") && !cmd.includes("/home/");
      if (!isIsolated) {
        const ok = await ctx.ui.confirm("GUARDRAIL", `git reset --hard detected. Proceed?`);
        if (!ok) return { block: true, reason: "Blocked" };
      }
    }
    if (/\b(ssh|scp|sshpass)\b/.test(cmd)) {
      // Word-boundaried file ops (avoid matching cpu/thermal/firmware/used/adapter in diagnostic text)
      const destructiveFileOps = /\brm\b|\bsed\b\s+-i|\bcp\b|\bmv\b|\btruncate\b|\breboot\b|\bshutdown\b|\bpoweroff\b/.test(cmd);
      // Service/package/process managers: flag MUTATING subcommands only — read-only status/logs/list/show stay free
      const serviceMutation = /\b(systemctl|service)\s+(start|stop|restart|reload|enable|disable|mask)\b/.test(cmd);
      const pm2Mutation = /\bpm2\s+(restart|stop|delete|reload|kill|start|scale|flush)\b/.test(cmd);
      const aptMutation = /\bapt(-get)?\s+(install|remove|purge|upgrade|dist-upgrade|autoremove)\b/.test(cmd);
      const isDestructive = destructiveFileOps || serviceMutation || pm2Mutation || aptMutation;
      if (isDestructive) {
        const ok = await ctx.ui.confirm("GUARDRAIL", `Destructive SSH/SCP operation detected. Allow?`);
        if (!ok) return { block: true, reason: "Blocked" };
      }
    }
    if (/npm\s+publish/.test(cmd)) {
      return { block: true, reason: "Blocked" };
    }
    if (/apt(-get)?\s+(remove|purge)/.test(cmd)) {
      const ok = await ctx.ui.confirm("GUARDRAIL", `apt remove/purge detected. Proceed?`);
      if (!ok) return { block: true, reason: "Blocked" };
    }
  });
}
