/**
 * Adjutant Greeting — Foundry startup greeting
 *
 * Shows a minimal welcome message on session start.
 * Dismisses on first agent message.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// ── Agent Data ────────────────────────────────────────────────────────────

interface AgentEntry {
	name: string;
	subtitle: string;
}

const TIER2_AGENTS: AgentEntry[] = [
	{ name: "scout",          subtitle: "recon"         },
	{ name: "oracle",         subtitle: "consistency"   },
	{ name: "planner",        subtitle: "planning"      },
	{ name: "researcher",      subtitle: "web research"  },
	{ name: "reviewer",       subtitle: "code review"   },
	{ name: "context-builder",subtitle: "deep analysis" },
	{ name: "worker",         subtitle: "implementation"},
	{ name: "delegate",       subtitle: "lightweight"    },
];

const TIER3_AGENTS: AgentEntry[] = [
	{ name: "devops", subtitle: "RPi & infra"      },
	{ name: "qa",     subtitle: "spec + bugs"      },
	{ name: "admin",  subtitle: "writing & vault"  },
];

// ── Agent Color Palette ──────────────────────────────────────────────────

const AGENT_COLORS: Record<string, { bg: string; br: string }> = {
	// Pipeline
	"scout":           { bg: "\x1b[48;2;12;40;65m",  br: "\x1b[38;2;0;180;220m"  },
	"context-builder": { bg: "\x1b[48;2;18;55;25m",  br: "\x1b[38;2;80;190;80m"  },
	"oracle":          { bg: "\x1b[48;2;65;30;18m",  br: "\x1b[38;2;220;100;60m" },
	"planner":         { bg: "\x1b[48;2;45;20;70m",  br: "\x1b[38;2;160;80;220m" },
	"researcher":      { bg: "\x1b[48;2;65;52;10m",  br: "\x1b[38;2;200;170;40m" },
	"reviewer":        { bg: "\x1b[48;2;10;55;52m",  br: "\x1b[38;2;40;190;170m" },
	"worker":          { bg: "\x1b[48;2;18;35;75m",  br: "\x1b[38;2;60;120;230m" },
	"delegate":        { bg: "\x1b[48;2;65;20;58m",  br: "\x1b[38;2;200;80;180m" },
	// Domain
	"devops":          { bg: "\x1b[48;2;65;18;25m",  br: "\x1b[38;2;200;60;80m"  },
	"qa":              { bg: "\x1b[48;2;30;22;70m",  br: "\x1b[38;2;100;80;210m" },
	"admin":           { bg: "\x1b[48;2;38;52;15m",  br: "\x1b[38;2;130;170;60m" },
};
const DEFAULT_COLORS = { bg: "\x1b[48;2;30;30;30m", br: "\x1b[38;2;120;120;120m" };
const FG_RESET = "\x1b[39m";
const BG_RESET = "\x1b[49m";

function renderCard(name: string, subtitle: string, cardWidth: number): string[] {
	const { bg, br } = AGENT_COLORS[name] ?? DEFAULT_COLORS;
	const inner = cardWidth - 2;

	const bord = (s: string) => bg + br + s + BG_RESET + FG_RESET;
	const border = (content: string, visLen: number) => {
		const pad = " ".repeat(Math.max(0, inner - visLen));
		return bord("\u2502") + bg + content + bg + pad + BG_RESET + bord("\u2502");
	};

	const nameRaw = name.length > inner - 2 ? name.slice(0, inner - 4) + "..." : name;
	const subRaw  = subtitle.length > inner - 2 ? subtitle.slice(0, inner - 4) + "..." : subtitle;

	const nameLine   = border(" " + br + "\x1b[1m" + nameRaw + "\x1b[22m" + FG_RESET, 1 + nameRaw.length);
	const statusLine = border(" " + "\x1b[2m" + "\u25cb idle" + "\x1b[22m", 7);
	const subLine    = border(" " + "\x1b[2m" + subRaw + "\x1b[22m", 1 + subRaw.length);
	const ulLine     = border(" " + "\x1b[2m" + "_" + "\x1b[22m", 2);

	return [
		bord("\u250c" + "\u2500".repeat(inner) + "\u2510"),
		nameLine,
		statusLine,
		subLine,
		ulLine,
		bord("\u2514" + "\u2500".repeat(inner) + "\u2518"),
	];
}

const GRID_KEY = "adjutant-agents";
const COLS = 3;
const CARD_GAP = 2;

function buildAgentGrid(width: number): string[] {
	const cardWidth = Math.floor((width - CARD_GAP * (COLS - 1)) / COLS);
	if (cardWidth < 14) return ["\x1b[2m terminal too narrow \x1b[22m"];

	const lines: string[] = [];

	const addGroup = (label: string, agents: AgentEntry[]) => {
		lines.push("");
		lines.push(" \x1b[2m" + label + "\x1b[22m");
		lines.push("");
		for (let i = 0; i < agents.length; i += COLS) {
			const row   = agents.slice(i, i + COLS);
			const cards = row.map(a => renderCard(a.name, a.subtitle, cardWidth));
			while (cards.length < COLS) cards.push(Array(6).fill(" ".repeat(cardWidth)));
			const h = cards[0].length;
			for (let l = 0; l < h; l++) {
				lines.push(" " + cards.map(c => c[l] ?? "").join(" ".repeat(CARD_GAP)));
			}
			lines.push("");
		}
	};

	addGroup("Pipeline Agents", TIER2_AGENTS);
	addGroup("Domain Agents",   TIER3_AGENTS);
	return lines;
}

function buildAgentGridChat(termWidth: number): string[] {
	const cols = 3;
	const gap  = 1;
	const cardWidth = Math.floor((termWidth - gap * (cols - 1)) / cols);
	if (cardWidth < 14) return ["\x1b[2m terminal too narrow \x1b[22m"];

	const chatLines: string[] = [];

	const addGroupChat = (label: string, agents: AgentEntry[]) => {
		chatLines.push("");
		chatLines.push(" \x1b[2m" + label + "\x1b[22m");
		chatLines.push("");
		for (let i = 0; i < agents.length; i += cols) {
			const row   = agents.slice(i, i + cols);
			const cards = row.map(a => renderCard(a.name, a.subtitle, cardWidth));
			while (cards.length < cols) cards.push(Array(6).fill(" ".repeat(cardWidth)));
			const h = cards[0].length;
			for (let l = 0; l < h; l++) {
				chatLines.push(" " + cards.map(c => c[l] ?? "").join(" ".repeat(gap)));
			}
			chatLines.push("");
		}
	};

	addGroupChat("Pipeline Agents", TIER2_AGENTS);
	addGroupChat("Domain Agents",   TIER3_AGENTS);
	return chatLines;
}

// ── ASCII Art ────────────────────────────────────────────────────────────

const ASCII_ART = [
	" █████╗ ██████╗      ██╗██╗   ██╗████████╗ █████╗ ███╗   ██╗████████╗",
	"██╔══██╗██╔══██╗     ██║██║   ██║╚══██╔══╝██╔══██╗████╗  ██║╚══██╔══╝",
	"███████║██║  ██║     ██║██║   ██║   ██║   ███████║██╔██╗ ██║   ██║   ",
	"██╔══██║██║  ██║██   ██║██║   ██║   ██║   ██╔══██║██║╚██╗██║   ██║   ",
	"██║  ██║██████╔╝╚█████╔╝╚██████╔╝   ██║   ██║  ██║██║ ╚████║   ██║   ",
	"╚═╝  ╚═╝╚═════╝  ╚════╝  ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝  ",
];

// ── Live clock interval (module-level so agent_start can clear it) ────────

let clockInterval: ReturnType<typeof setInterval> | undefined;

// ── GreetingWidget Component ────────────────────────────────────────────

class GreetingWidget {
	constructor(private readonly theme: Theme) {}

	private buildLines(width: number): string[] {
		const th = this.theme;

		// Center ASCII art
		const artWidth = visibleWidth(ASCII_ART[0] ?? "");
		const pad = Math.max(0, Math.floor((width - artWidth) / 2));
		const indent = " ".repeat(pad);

		// Live date + time
		const now    = new Date();
		const datePart = now.toLocaleDateString("en-US", {
			weekday: "long",
			month:   "long",
			day:     "numeric",
			year:    "numeric",
		}).replace(",", " -");   // "Tuesday, May 19, 2026" → "Tuesday - May 19, 2026"
		const timePart = now.toLocaleTimeString("en-US", {
			hour:   "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});

		// Center the sub-text lines as well
		const msg1     = "Systems online. Awaiting your orders, commander.";
		const msg2     = `${datePart}  ·  ${timePart}`;
		const msgPad1  = " ".repeat(Math.max(0, Math.floor((width - visibleWidth(msg1)) / 2)));
		const msgPad2  = " ".repeat(Math.max(0, Math.floor((width - visibleWidth(msg2)) / 2)));

		return [
			"",
			"",
			...ASCII_ART.map(line =>
				truncateToWidth(th.fg("accent", indent + line), width)
			),
			"",
			truncateToWidth(th.fg("muted", msgPad1 + msg1), width),
			truncateToWidth(th.fg("dim",   msgPad2 + msg2), width),
			"",
			...this.buildAgentList(width),
		];
	}

	private buildAgentList(width: number): string[] {
		const th       = this.theme;
		const COLS     = 3;
		const colWidth = Math.floor((width - 2) / COLS);   // leading "  " = 2
		const lines: string[] = [];

		const padRight = (s: string, visW: number, toW: number) =>
			s + " ".repeat(Math.max(0, toW - visW));

		const formatAgent = (agent: AgentEntry): string => {
			const { br } = AGENT_COLORS[agent.name] ?? DEFAULT_COLORS;
			// "name (subtitle)" — parens make clear subtitle describes the agent, not a new entry
			const maxNameW = Math.floor(colWidth * 0.48);
			const maxSubW  = colWidth - maxNameW - 3; // 3 = " (" + ")"
			const nameStr  = truncateToWidth(agent.name,     maxNameW, "…");
			const subStr   = truncateToWidth(agent.subtitle, maxSubW,  "…");
			const entry    = `${br}${nameStr}${FG_RESET} \x1b[2m(${subStr})\x1b[22m`;
			const entryVisW = visibleWidth(nameStr) + 2 + visibleWidth(subStr) + 1; // name + " (" + sub + ")"
			return padRight(entry, entryVisW, colWidth);
		};

		const renderGroup = (label: string, agents: AgentEntry[]) => {
			lines.push(`  ${th.fg("dim", label)}`);
			for (let i = 0; i < agents.length; i += COLS) {
				const row = agents.slice(i, i + COLS);
				lines.push(truncateToWidth("  " + row.map(formatAgent).join(""), width));
			}
			lines.push("");
		};

		renderGroup("pipeline", TIER2_AGENTS);
		renderGroup("domain",   TIER3_AGENTS);
		return lines;
	}

	// No cache — render fresh every call so the clock always shows current time.
	render(width: number): string[] {
		return this.buildLines(width);
	}

	invalidate(): void { /* stateless — nothing to clear */ }
}

// ── Extension ───────────────────────────────────────────────────────────────

const WIDGET_KEY = "adjutant-greeting";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setWidget(WIDGET_KEY, (tui, theme) => {
			const widget = new GreetingWidget(theme);

			// Tick every second so the clock stays live
			if (clockInterval) clearInterval(clockInterval);
			clockInterval = setInterval(() => tui.requestRender(), 1000);

			return {
				render: (w: number) => widget.render(w),
				invalidate: () => widget.invalidate(),
			};
		});
	});

	pi.on("agent_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		if (clockInterval) {
			clearInterval(clockInterval);
			clockInterval = undefined;
		}
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	});

	// ── show_agents tool (callable by the agent) ──────────────────────────
	pi.registerTool({
		name: "show_agents",
		label: "Show Agents",
		description: "Display the Adjutant agent roster as a colored card grid.",
		parameters: Type.Object({}),
		execute: async (_callId, _params, _signal, _onUpdate, ctx) => {
			const termWidth = (process.stdout.columns || 120);
			const lines = buildAgentGridChat(termWidth);
			if (ctx.hasUI) {
				ctx.ui.notify(lines.join("\n"), "info");
			}
			return {
				content: [{ type: "text", text: "Agent roster displayed." }],
			};
		},
	});

	// ── /agents command (human shortcut) ─────────────────────────────────
	pi.registerCommand("agents", {
		description: "Show the Adjutant agent roster card grid",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			ctx.ui.setWidget(GRID_KEY, (_tui, _theme) => ({
				render: (w: number) => buildAgentGrid(w),
				invalidate: () => {},
			}));
		},
	});

	// ── /agents-hide command ──────────────────────────────────────────────
	pi.registerCommand("agents-hide", {
		description: "Hide the agent roster card grid",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			ctx.ui.setWidget(GRID_KEY, undefined);
		},
	});
}