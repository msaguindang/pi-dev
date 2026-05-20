/**
 * Secure Tools — replaces git-mcp-broker MCP server
 *
 * Fetches secrets from infisical once on session_start, caches in memory.
 * Registers tools for git sync, Tailscale status, and API key access.
 * Clears cache on session_shutdown.
 *
 * Zero process overhead vs the previous 30–50MB persistent Node.js MCP server.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Secret cache ──────────────────────────────────────────────────────────────
// Populated once on session_start, cleared on session_shutdown.
// Secrets never appear in tool return values unless explicitly needed.

const secrets = new Map<string, string>();

function getSecret(key: string): string {
	return secrets.get(key) ?? process.env[key] ?? "";
}

// ── Repo → token routing (mirrors MCP server REPO_TOKENS) ────────────────────

const REPO_TOKENS: Record<string, () => string> = {
	"msaguindang/opencode-config":           () => getSecret("GITHUB_TOKEN"),
	"N-Compass-TV/n-compasstv-api-v1":        () => getSecret("GITHUB_TOKEN"),
	"N-Compass-TV/n-compasstv-dashboard-v1":  () => getSecret("GITHUB_TOKEN"),
	"msaguindang/mesh-gateway":               () => getSecret("GITHUB_TOKEN"),
	"msaguindang/mesh-integration-docs":      () => getSecret("GITHUB_TOKEN"),
	"N-CompassTV/player-server":              () => getSecret("FORGEJO_TOKEN"),
	"N-CompassTV/player-ui":                 () => getSecret("FORGEJO_TOKEN"),
	"NTV360/player-ui-v2":                   () => getSecret("FORGEJO_TOKEN"),
};

function getTokenForRepo(ownerRepo: string): string {
	return (REPO_TOKENS[ownerRepo] ?? (() => getSecret("GITHUB_TOKEN")))();
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function runCmd(cmd: string, cwd: string): string {
	try {
		return execSync(cmd, {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (e: any) {
		const stderr: string = e.stderr ?? "";
		const stdout: string = e.stdout ?? "";
		if (stdout.includes("nothing to commit") || stderr.includes("nothing to commit")) {
			return "nothing to commit";
		}
		throw new Error(stderr || e.message);
	}
}

function getRemoteInfo(cwd: string): {
	remoteUrl: string;
	host: string;
	owner: string;
	repo: string;
} {
	const remoteUrl = runCmd("git remote get-url origin", cwd);
	const isForgejo =
		remoteUrl.includes("forgejo") ||
		remoteUrl.includes("ntv360") ||
		remoteUrl.match(/192\.168\.\d+\.\d+/) !== null;
	const host = isForgejo ? "forgejo" : "github.com";
	const match = remoteUrl.match(/[/:]([^/]+)\/([^/.]+?)(\.git)?$/);
	const owner = match?.[1] ?? "";
	const repo  = match?.[2] ?? "";
	return { remoteUrl, host, owner, repo };
}

function prepareRemoteUrl(remoteUrl: string, token: string, _host: string): string {
	if (!token) return remoteUrl;
	// Convert SSH → HTTPS
	let url = remoteUrl.startsWith("git@")
		? remoteUrl.replace(/^git@([^:]+):/, "https://$1/")
		: remoteUrl;
	// Inject token
	return url.replace("https://", `https://oauth2:${token}@`);
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Load secrets on session start ─────────────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		secrets.clear();
		try {
			const output = execSync(
				"infisical export --domain http://localhost:8080 --format=dotenv",
				{ encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
			);
			for (const line of output.split("\n")) {
				const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
				if (match) {
					secrets.set(match[1], match[2].replace(/^["']|["']$/g, ""));
				}
			}
			if (ctx.hasUI) {
				ctx.ui.setStatus("secure-tools", `🔑 ${secrets.size} secrets`);
			}
		} catch {
			if (ctx.hasUI) {
				ctx.ui.notify("secure-tools: infisical unavailable — tools may fail", "warning");
			}
		}
	});

	// ── Clear secrets on shutdown ─────────────────────────────────────────────
	pi.on("session_shutdown", () => {
		secrets.clear();
	});

	// ── Tool: sync_opencode_config ────────────────────────────────────────────
	pi.registerTool({
		name: "sync_opencode_config",
		label: "Sync Opencode Config",
		description: "Commit and push ~/.config/opencode to GitHub. Forgejo mirrors automatically.",
		parameters: Type.Object({
			commitMessage: Type.String({ description: "Commit message" }),
		}),
		execute: async (_id, params, _signal, _update, _ctx) => {
			const { commitMessage } = params as { commitMessage: string };
			const githubToken = getSecret("GITHUB_TOKEN");
			const githubRepoUrl = getSecret("GITHUB_REPO_URL");

			if (!githubToken) throw new Error("GITHUB_TOKEN not available — is infisical running?");
			if (!githubRepoUrl) throw new Error("GITHUB_REPO_URL not configured in infisical");

			const cwd = path.join(os.homedir(), ".config", "opencode");

			if (!fs.existsSync(path.join(cwd, ".git"))) {
				runCmd("git init", cwd);
				runCmd("git branch -M main", cwd);
			}

			const remoteWithToken = `https://oauth2:${githubToken}@${githubRepoUrl}`;
			let log = "";

			log += runCmd("git add .", cwd) + "\n";
			const commitResult = runCmd(`git commit -m "${commitMessage}"`, cwd);
			log += commitResult + "\n";

			if (commitResult.includes("nothing to commit")) {
				return { content: [{ type: "text", text: "No changes to commit." }] };
			}

			log += runCmd(`git push ${remoteWithToken} main`, cwd) + "\n";

			return { content: [{ type: "text", text: `✓ Synced opencode config\n\n${log}` }] };
		},
	});

	// ── Tool: sync_ntv_repo ───────────────────────────────────────────────────
	pi.registerTool({
		name: "sync_ntv_repo",
		label: "Sync NTV Repo",
		description: "Commit and push changes in an NTV repository to GitHub or Forgejo.",
		parameters: Type.Object({
			repoPath:      Type.String({ description: "Absolute path to the NTV repository" }),
			commitMessage: Type.String({ description: "Commit message" }),
		}),
		execute: async (_id, params, _signal, _update, _ctx) => {
			const { repoPath, commitMessage } = params as {
				repoPath: string;
				commitMessage: string;
			};

			const cwd = path.resolve(repoPath);
			if (!fs.existsSync(cwd)) throw new Error(`Path does not exist: ${cwd}`);
			if (!fs.existsSync(path.join(cwd, ".git"))) throw new Error(`Not a git repo: ${cwd}`);

			const { remoteUrl, host, owner, repo } = getRemoteInfo(cwd);
			const ownerRepo = `${owner}/${repo}`;
			const token = getTokenForRepo(ownerRepo);
			const remoteWithToken = prepareRemoteUrl(remoteUrl, token, host);

			let log = `Repo: ${cwd}\nRemote: ${remoteUrl} (${host})\n\n`;

			log += runCmd("git add .", cwd) + "\n";
			const commitResult = runCmd(`git commit -m "${commitMessage}"`, cwd);
			log += commitResult + "\n";

			if (commitResult.includes("nothing to commit")) {
				return { content: [{ type: "text", text: `No changes to commit in ${cwd}.` }] };
			}

			log += runCmd(`git push ${remoteWithToken} HEAD`, cwd) + "\n";

			return { content: [{ type: "text", text: `✓ Synced ${ownerRepo}\n\n${log}` }] };
		},
	});

	// ── Tool: tailscale_status ────────────────────────────────────────────────
	pi.registerTool({
		name: "tailscale_status",
		label: "Tailscale Status",
		description: "Get current Tailscale network status including IPs of all connected devices.",
		parameters: Type.Object({}),
		execute: async (_id, _params, _signal, _update, _ctx) => {
			const result = runCmd("tailscale status --json", os.homedir());
			return { content: [{ type: "text", text: result }] };
		},
	});

	// ── Tool: get_llmwhisperer_key ────────────────────────────────────────────
	pi.registerTool({
		name: "get_llmwhisperer_key",
		label: "Get LLMWhisperer Key",
		description: "Retrieve the LLMWhisperer API key for PDF layout-preservation scripts.",
		parameters: Type.Object({}),
		execute: async (_id, _params, _signal, _update, _ctx) => {
			const key = getSecret("LLMWHISPERER_API_KEY");
			if (!key) {
				return {
					content: [{ type: "text", text: "Error: LLMWHISPERER_API_KEY not found in infisical" }],
				};
			}
			return { content: [{ type: "text", text: key }] };
		},
	});
}
