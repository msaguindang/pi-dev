/**
 * Adjutant Live Agents — parallel subprocess agents with live TUI cards
 *
 * Registers the `live_agents` tool: spawns N pi subprocesses in parallel,
 * streams JSON events, updates per-agent cards in real time, blocks until
 * all complete, then returns aggregated results.
 *
 * Fixes over disler's subagent-widget.ts:
 *   - textChunks capped at 50 (no unbounded growth)
 *   - 5-minute timeout per agent (no hung processes)
 *   - timer/timeout cleared in close, error, AND session_shutdown
 *   - session_shutdown kills all procs with SIGKILL
 *   - session_start cleans up lingering state from prior session
 *   - JSON parse errors surfaced to widget (not swallowed)
 *   - session file dir capped at 20 most recent files
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Types ─────────────────────────────────────────────────────────────────

interface SubState {
	id: number;
	agentName: string;
	task: string;
	status: "running" | "done" | "error";
	textChunks: string[];
	toolCount: number;
	elapsed: number;
	lastLine: string;
	proc?: ReturnType<typeof spawn>;
	timer?: ReturnType<typeof setInterval>;
	timeout?: ReturnType<typeof setTimeout>;
}

// ── Colors (verbatim from adjutant-greeting.ts) ───────────────────────────

const AGENT_COLORS: Record<string, { bg: string; br: string }> = {
	"scout":           { bg: "\x1b[48;2;12;40;65m",  br: "\x1b[38;2;0;180;220m"  },
	"context-builder": { bg: "\x1b[48;2;18;55;25m",  br: "\x1b[38;2;80;190;80m"  },
	"oracle":          { bg: "\x1b[48;2;65;30;18m",  br: "\x1b[38;2;220;100;60m" },
	"planner":         { bg: "\x1b[48;2;45;20;70m",  br: "\x1b[38;2;160;80;220m" },
	"researcher":      { bg: "\x1b[48;2;65;52;10m",  br: "\x1b[38;2;200;170;40m" },
	"reviewer":        { bg: "\x1b[48;2;10;55;52m",  br: "\x1b[38;2;40;190;170m" },
	"worker":          { bg: "\x1b[48;2;18;35;75m",  br: "\x1b[38;2;60;120;230m" },
	"delegate":        { bg: "\x1b[48;2;65;20;58m",  br: "\x1b[38;2;200;80;180m" },
	"devops":          { bg: "\x1b[48;2;65;18;25m",  br: "\x1b[38;2;200;60;80m"  },
	"qa":              { bg: "\x1b[48;2;30;22;70m",  br: "\x1b[38;2;100;80;210m" },
	"admin":           { bg: "\x1b[48;2;38;52;15m",  br: "\x1b[38;2;130;170;60m" },
};
const DEFAULT_COLORS = { bg: "\x1b[48;2;30;30;30m", br: "\x1b[38;2;120;120;120m" };
const FG_RESET = "\x1b[39m";
const BG_RESET = "\x1b[49m";

// ── Card rendering ────────────────────────────────────────────────────────

function renderLiveCard(state: SubState, cardWidth: number): string[] {
	const { bg, br } = AGENT_COLORS[state.agentName] ?? DEFAULT_COLORS;
	const inner = cardWidth - 2;

	const trunc = (s: string, max: number) =>
		s.length > max ? s.slice(0, max - 3) + "..." : s;

	const bord = (s: string) => bg + br + s + BG_RESET + FG_RESET;
	const border = (content: string, visLen: number) => {
		const pad = " ".repeat(Math.max(0, inner - visLen));
		return bord("\u2502") + bg + content + bg + pad + BG_RESET + bord("\u2502");
	};

	// Line 1: agent name
	const nameRaw = trunc(state.agentName, inner - 2);
	const nameLine = border(
		" " + br + "\x1b[1m" + nameRaw + "\x1b[22m" + FG_RESET,
		1 + nameRaw.length,
	);

	// Line 2: status + elapsed
	const statusIcon =
		state.status === "running" ? "\x1b[38;2;0;180;220m\u25cf\x1b[39m" :
		state.status === "done"    ? "\x1b[38;2;80;190;80m\u2713\x1b[39m"  :
		                             "\x1b[38;2;200;60;80m\u2717\x1b[39m";
	const elapsedStr = " " + Math.round(state.elapsed / 1000) + "s";
	const statusRaw = state.status + elapsedStr;
	const statusLine = border(
		" " + statusIcon + " \x1b[2m" + statusRaw + "\x1b[22m",
		3 + statusRaw.length,
	);

	// Line 3: last text line from agent
	const lastRaw = trunc(state.lastLine || "\u2014", inner - 2);
	const lastLine = border(
		" \x1b[2m" + lastRaw + "\x1b[22m",
		1 + lastRaw.length,
	);

	// Line 4: tool count
	const toolRaw = "tools: " + state.toolCount;
	const toolLine = border(
		" \x1b[2m" + toolRaw + "\x1b[22m",
		1 + toolRaw.length,
	);

	return [
		bord("\u250c" + "\u2500".repeat(inner) + "\u2510"),
		nameLine,
		statusLine,
		lastLine,
		toolLine,
		bord("\u2514" + "\u2500".repeat(inner) + "\u2518"),
	];
}

// ── Grid layout ───────────────────────────────────────────────────────────

const WIDGET_KEY = "adjutant-live";
const COLS = 3;
const GAP  = 1;
const CARD_HEIGHT = 6;

function buildLiveGrid(states: SubState[], width: number): string[] {
	const cardWidth = Math.floor((width - GAP * (COLS - 1)) / COLS);
	if (cardWidth < 14) return ["\x1b[2m terminal too narrow \x1b[22m"];

	const lines: string[] = [""];
	for (let i = 0; i < states.length; i += COLS) {
		const row   = states.slice(i, i + COLS);
		const cards = row.map(s => renderLiveCard(s, cardWidth));
		while (cards.length < COLS) {
			cards.push(Array(CARD_HEIGHT).fill(" ".repeat(cardWidth)));
		}
		for (let l = 0; l < CARD_HEIGHT; l++) {
			lines.push(" " + cards.map(c => c[l] ?? "").join(" ".repeat(GAP)));
		}
		lines.push("");
	}
	return lines;
}

// ── Session file helpers ──────────────────────────────────────────────────

const SESSION_DIR = path.join(os.homedir(), ".pi", "agent", "sessions", "live-agents");

function makeSessionFile(id: number): string {
	fs.mkdirSync(SESSION_DIR, { recursive: true });
	return path.join(SESSION_DIR, `live-${id}-${Date.now()}.jsonl`);
}

function cleanupOldSessionFiles(): void {
	try {
		if (!fs.existsSync(SESSION_DIR)) return;
		const files = fs.readdirSync(SESSION_DIR)
			.map(f => ({ f, mtime: fs.statSync(path.join(SESSION_DIR, f)).mtimeMs }))
			.sort((a, b) => b.mtime - a.mtime);
		for (const { f } of files.slice(20)) {
			try { fs.unlinkSync(path.join(SESSION_DIR, f)); } catch { /* ignore */ }
		}
	} catch { /* ignore */ }
}

// ── Cleanup helpers ───────────────────────────────────────────────────────

function clearState(state: SubState, signal: "SIGTERM" | "SIGKILL" = "SIGTERM"): void {
	if (state.timer)   { clearInterval(state.timer);   state.timer   = undefined; }
	if (state.timeout) { clearTimeout(state.timeout);  state.timeout = undefined; }
	if (state.proc)    { try { state.proc.kill(signal); } catch { /* ignore */ } state.proc = undefined; }
}

// ── Extension ─────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const agents = new Map<number, SubState>();
	let nextId = 1;
	let widgetCtx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1] | null = null;

	function updateWidget(): void {
		if (!widgetCtx?.hasUI) return;
		const states = Array.from(agents.values());
		if (states.length === 0) {
			widgetCtx.ui.setWidget(WIDGET_KEY, undefined);
			return;
		}
		widgetCtx.ui.setWidget(WIDGET_KEY, (_tui, _theme) => ({
			render:     (w: number) => buildLiveGrid(states, w),
			invalidate: () => {},
		}));
	}

	// ── Subprocess spawner ────────────────────────────────────────────────

	function spawnLiveAgent(
		state: SubState,
		model: string,
	): Promise<void> {
		return new Promise<void>((resolve) => {
			const sessionFile = makeSessionFile(state.id);

			const proc = spawn("pi", [
				"--mode", "json",
				"-p",
				"--no-extensions",
				"--no-context-files",
				"--model", model,
				"--tools", "read,grep,find,ls,bash",
				"--thinking", "off",
				"--session", sessionFile,
				state.task,
			], {
				stdio:  ["ignore", "pipe", "pipe"],
				env:    { ...process.env },
				detached: false,
			});

			state.proc = proc;

			// ── Elapsed timer ─────────────────────────────────────────────
			const startTime = Date.now();
			state.timer = setInterval(() => {
				state.elapsed = Date.now() - startTime;
				updateWidget();
			}, 500);

			// ── 5-minute hard timeout ─────────────────────────────────────
			state.timeout = setTimeout(() => {
				state.status   = "error";
				state.lastLine = "[timeout after 5m]";
				clearState(state, "SIGTERM");
				updateWidget();
				resolve();
			}, 300_000);

			// ── Stdout stream ─────────────────────────────────────────────
			let buffer = "";
			proc.stdout!.setEncoding("utf-8");
			proc.stdout!.on("data", (chunk: string) => {
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const event = JSON.parse(line) as Record<string, unknown>;
						if (event.type === "message_update") {
							const delta = (event.assistantMessageEvent as Record<string, unknown> | undefined);
							if (delta?.type === "text_delta" && typeof delta.delta === "string") {
								state.textChunks.push(delta.delta);
								if (state.textChunks.length > 50) state.textChunks.shift();
								const full = state.textChunks.join("");
								state.lastLine = full.split("\n").filter(l => l.trim()).pop() ?? "";
							}
						} else if (event.type === "tool_execution_start") {
							state.toolCount++;
						}
					} catch {
						state.textChunks.push("[parse error]");
						if (state.textChunks.length > 50) state.textChunks.shift();
					}
					updateWidget();
				}
			});

			proc.stderr!.setEncoding("utf-8");
			proc.stderr!.on("data", () => { /* discard */ });

			// ── Close ─────────────────────────────────────────────────────
			proc.on("close", (code) => {
				if (buffer.trim()) {
					try {
						const event = JSON.parse(buffer) as Record<string, unknown>;
						const delta = ((event.assistantMessageEvent ?? {}) as Record<string, unknown>);
						if (delta.type === "text_delta" && typeof delta.delta === "string") {
							state.textChunks.push(delta.delta);
						}
					} catch { /* ignore trailing partial */ }
				}
				state.elapsed = Date.now() - startTime;
				state.status  = code === 0 ? "done" : "error";
				if (!state.lastLine) {
					const full = state.textChunks.join("");
					state.lastLine = full.split("\n").filter(l => l.trim()).pop() ?? "";
				}
				clearState(state);
				updateWidget();
				resolve();
			});

			// ── Spawn error ───────────────────────────────────────────────
			proc.on("error", (err: Error) => {
				state.status   = "error";
				state.lastLine = err.message;
				clearState(state);
				updateWidget();
				resolve();
			});
		});
	}

	// ── live_agents tool ──────────────────────────────────────────────────

	pi.registerTool({
		name:        "live_agents",
		label:       "Live Agents",
		description: "Spawn N agents in parallel with live TUI progress cards. Blocks until all complete, then returns aggregated results. Use for parallel scouting, research, or any task benefiting from live visibility.",
		parameters:  Type.Object({
			tasks: Type.Array(
				Type.Object({
					agent: Type.String({ description: "Agent name (scout, researcher, reviewer, etc.)" }),
					task:  Type.String({ description: "Task for this agent" }),
				}),
				{ description: "Agent+task pairs to run in parallel" },
			),
		}),

		execute: async (_callId, params, _signal, _onUpdate, ctx) => {
			widgetCtx = ctx;

			const { tasks } = params as { tasks: { agent: string; task: string }[] };
			if (!tasks?.length) {
				return { content: [{ type: "text", text: "No tasks provided." }] };
			}

			// Init states
			const states: SubState[] = tasks.map(t => {
				const state: SubState = {
					id:          nextId++,
					agentName:   t.agent,
					task:        t.task,
					status:      "running",
					textChunks:  [],
					toolCount:   0,
					elapsed:     0,
					lastLine:    "",
				};
				agents.set(state.id, state);
				return state;
			});

			updateWidget();

			const model = ctx.model
				? `${ctx.model.provider}/${ctx.model.id}`
				: "anthropic/claude-haiku-4-5";

			// Run all in parallel, wait for all to finish
			await Promise.allSettled(states.map(s => spawnLiveAgent(s, model)));

			// Clear widget
			if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);

			// Aggregate results
			const sections = states.map(s => {
				const icon   = s.status === "done" ? "✓" : "✗";
				const output = s.textChunks.join("").slice(0, 4000);
				const truncated = s.textChunks.join("").length > 4000 ? "\n\n... [truncated]" : "";
				return `## [${icon}] ${s.agentName} (${Math.round(s.elapsed / 1000)}s)\n\n${output}${truncated}`;
			});

			// Cleanup map
			for (const s of states) agents.delete(s.id);

			return {
				content: [{ type: "text", text: sections.join("\n\n---\n\n") }],
			};
		},
	});

	// ── /live command — re-show widget ────────────────────────────────────

	pi.registerCommand("live", {
		description: "Re-show the live agents widget if agents are running",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			if (agents.size === 0) {
				ctx.ui.notify("No live agents running.", "info");
				return;
			}
			updateWidget();
		},
	});

	// ── /live-clear command — kill everything ─────────────────────────────

	pi.registerCommand("live-clear", {
		description: "Kill all running live agents and clear the widget",
		handler: async (_args, ctx) => {
			widgetCtx = ctx;
			let killed = 0;
			for (const state of agents.values()) {
				if (state.status === "running") killed++;
				clearState(state, "SIGTERM");
			}
			agents.clear();
			if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);
			ctx.ui.notify(
				killed > 0 ? `Killed ${killed} agent(s).` : "No agents were running.",
				"info",
			);
		},
	});

	// ── Session lifecycle ─────────────────────────────────────────────────

	pi.on("session_start", (_event, ctx) => {
		widgetCtx = ctx;
		cleanupOldSessionFiles();
		// Kill any lingering procs from a prior session
		for (const state of agents.values()) clearState(state, "SIGTERM");
		agents.clear();
		nextId = 1;
		if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);
	});

	pi.on("session_shutdown", () => {
		// Hard kill — no time for graceful shutdown
		for (const state of agents.values()) clearState(state, "SIGKILL");
		agents.clear();
	});
}
