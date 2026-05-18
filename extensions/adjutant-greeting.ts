/**
 * Adjutant Greeting — Foundry startup hierarchy tree overlay
 *
 * Displays agents as a neon-bordered hierarchy tree:
 *   TIER 1 — ADJUTANT (orchestrator, cyan/accent)
 *   TIER 2 — Package pipeline agents (4×2 grid, magenta/warning)
 *   TIER 3 — Domain leaf agents (3 cards, muted/dim)
 *
 * Dismisses on any keypress.
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

const AGENT_COLORS: Record<string, [number, number, number]> = {
	// Pipeline
	"scout":           [0,   180, 220],
	"context-builder": [80,  190, 80 ],
	"oracle":          [220, 100, 60 ],
	"planner":         [160, 80,  220],
	"researcher":      [200, 170, 40 ],
	"reviewer":        [40,  190, 170],
	"worker":          [60,  120, 230],
	"delegate":        [200, 80,  180],
	// Domain
	"devops":          [200, 60,  80 ],
	"qa":              [100, 80,  210],
	"admin":           [130, 170, 60 ],
};

const DEFAULT_COLOR: [number, number, number] = [120, 120, 120];

function rgb(r: number, g: number, b: number, text: string): string {
	return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

function bold(text: string): string {
	return `\x1b[1m${text}\x1b[22m`;
}

function dim(text: string): string {
	return `\x1b[2m${text}\x1b[22m`;
}

function renderCard(name: string, subtitle: string, status: string, cardWidth: number): string[] {
	const [r, g, b] = AGENT_COLORS[name] ?? DEFAULT_COLOR;
	const color = (t: string) => rgb(r, g, b, t);
	const inner = cardWidth - 2; // subtract left+right border chars

	const pad = (text: string, visLen: number) =>
		text + " ".repeat(Math.max(0, inner - visLen));

	const topBot = color("\u250c" + "\u2500".repeat(inner) + "\u2510");
	const botLine = color("\u2514" + "\u2500".repeat(inner) + "\u2518");
	const border = (content: string, visLen: number) =>
		color("\u2502") + content + " ".repeat(Math.max(0, inner - visLen)) + color("\u2502");

	const nameText = " " + name;
	const nameLine = border(color(bold(nameText)), 1 + name.length);

	const statusText = " " + status;
	const statusLine = border(dim(statusText), 1 + status.length);

	const descRaw = " " + (subtitle.length > inner - 2 ? subtitle.slice(0, inner - 4) + "..." : subtitle);
	const descLine = border(dim(descRaw), descRaw.length);
	const ulText = " _";
	const ulLine = border(dim(ulText), 2);
	return [topBot, nameLine, statusLine, descLine, ulLine, botLine];
}

const GRID_KEY = "adjutant-agents";
const COLS = 3;
const CARD_GAP = 2;

function buildAgentGrid(width: number): string[] {
	const cardWidth = Math.floor((width - CARD_GAP * (COLS - 1)) / COLS);
	if (cardWidth < 14) return [dim(" terminal too narrow ")];

	const allAgents: Array<{ name: string; subtitle: string; group: string }> = [
		...TIER2_AGENTS.map(a => ({ ...a, group: "pipeline" })),
		...TIER3_AGENTS.map(a => ({ ...a, group: "domain" })),
	];

	const lines: string[] = [""];

	for (let i = 0; i < allAgents.length; i += COLS) {
		const row = allAgents.slice(i, i + COLS);
		// Add group label when switching from pipeline to domain
		if (i === 0) lines.push(dim("  Pipeline Agents"));
		if (i === TIER2_AGENTS.length) lines.push(dim("  Domain Agents"));
		const cards = row.map(a => renderCard(a.name, a.subtitle, "○ idle", cardWidth));
		// pad to full COLS if last row is short
		while (cards.length < COLS) cards.push(Array(6).fill(" ".repeat(cardWidth)));

		const cardHeight = cards[0].length;
		for (let line = 0; line < cardHeight; line++) {
			lines.push(" " + cards.map(c => c[line] ?? " ".repeat(cardWidth)).join(" ".repeat(CARD_GAP)));
		}
		lines.push("");
	}

	return lines;
}

// ── Layout Constants ───────────────────────────────────────────────────────

const CARD_W  = 16;        // total card width (including borders)
const CARD_IN = 14;        // inner usable width  (CARD_W - 2)
const CARDS_R2 = 4;        // cards per row in tier 2
const CARDS_R3 = 3;        // cards per row in tier 3
const GAP = 2;             // inter-card gap (spaces)
const ROW_SP = 1;          // blank line between rows in same tier

// ── Card Rendering ───────────────────────────────────────────────────────

function card(
	name: string,
	sub: string,
	theme: Theme,
	nameFg: string,
): string[] {
	const n = truncateToWidth(name, CARD_IN - 2, "…");
	const s = truncateToWidth(sub,  CARD_IN - 2, "…");
	const top = `╭${"─".repeat(CARD_IN)}╮`;
	const mid1 = `│${theme.fg(nameFg, " " + n)}${" ".repeat(CARD_IN - visibleWidth(n) - 1)}│`;
	const mid2 = `│${theme.fg("dim", " " + s)}${" ".repeat(CARD_IN - visibleWidth(s) - 1)}│`;
	const bot = `╰${"─".repeat(CARD_IN)}╯`;
	return [top, mid1, mid2, bot];
}

// ── Row Width Calculator ─────────────────────────────────────────────────

function rowWidth(nCards: number): number {
	return nCards * CARD_W + (nCards - 1) * GAP;
}

// ── GreetingWidget Component ────────────────────────────────────────────

class GreetingWidget {
	private cachedLines?: string[];
	private cachedWidth?: number;

	constructor(
		private readonly theme: Theme,
	) {}

	// Returns the grid width so caller knows where to anchor.
	private gridWidth(): number {
		return Math.max(rowWidth(CARDS_R2), rowWidth(CARDS_R3));
	}

	private buildLines(): string[] {
		const th = this.theme;
		const out: string[] = [];

		// ── Header ────────────────────────────────────────────────────────
		out.push("");
		out.push(truncateToWidth(
			th.fg("accent", th.bold("◈  ADJUTANT ONLINE")),
			this.gridWidth(),
		));
		out.push(truncateToWidth(th.fg("muted", "Commander, your agents are ready."), this.gridWidth()));
		out.push("");

		// ── TIER 1 — Adjutant orchestrator ────────────────────────────────
		const t1Name = truncateToWidth("ADJUTANT", CARD_IN - 2, "…");
		const t1Sub  = truncateToWidth("Commander", CARD_IN - 2, "…");
		const t1W    = CARD_IN;
		const t1Top  = `╭${"─".repeat(t1W)}╮`;
		const t1Mid1 = `│${th.fg("accent", th.bold(" " + t1Name))}${" ".repeat(t1W - visibleWidth(t1Name) - 1)}│`;
		const t1Mid2 = `│${th.fg("dim", " " + t1Sub)}${" ".repeat(t1W - visibleWidth(t1Sub) - 1)}│`;
		const t1Bot  = `╰${"─".repeat(t1W)}╯`;

		// ── TIER 2 — Package agents (2 rows × 4) ───────────────────────
		type Row = AgentEntry[];
		const r2row1 = TIER2_AGENTS.slice(0, 4) as Row;
		const r2row2 = TIER2_AGENTS.slice(4, 8) as Row;

		function renderRow(agents: AgentEntry[], nameFg: string): string[] {
			const cards = agents.map(a => card(a.name, a.subtitle, th, nameFg));
			return Array.from({ length: 4 }, (_, lineIdx) =>
				(agents.length === 1 ? "" : "")
					+ cards.map(c => c[lineIdx]).join(" ".repeat(GAP))
					+ " ".repeat(Math.max(0, CARDS_R2 * CARD_W + (CARDS_R2 - 1) * GAP - (cards.length * CARD_W + (cards.length - 1) * GAP)))
			);
		}

		// Pre-render tier2 so we can measure its bounds for connector lines
		const t2row1Lines = renderRow(r2row1, "accent");
		const t2row2Lines = renderRow(r2row2, "accent");

		const t2RowWidth = rowWidth(CARDS_R2);

		// ── Connector lines ────────────────────────────────────────────
		// Tier 1 is one card wide, centered over the tier2 grid.
		// Draw a vertical line from T1 bottom → down to between t2row1 and t2row2.
		// Then a horizontal line across the full tier2 width, then verticals down to each t2 row.
		//
		// Simpler approach: just one vertical from T1 bottom center, branching at t2 top.
		// We use dim color for all connectors.

		// Center of the entire grid
		const gridMidCol = Math.floor(t2RowWidth / 2); // 0-indexed within grid string

		// Center of T1 card (since T1 is same width as one card)
		const t1MidCol = Math.floor(CARD_W / 2);       // 0-indexed within T1 card string

		// Position of the leftmost tier2 card in the grid (same row indent as tier2 rows)
		const t2LeftOffset = 0; // tier2 rows start at column 0 of the grid string

		// Horizontal line from T1 center down
		// t1EndLine is where T1 card ends (relative to where we start drawing)
		// We'll embed connector lines above the t2 content

		const connectorLines: string[] = [];

		// T1 bottom to between t2 rows: vertical line of dim '│' chars
		// The T1 card top is at out.length - 1 (last pushed line so far)
		// We insert connector lines BEFORE the t2 rows
		//
		// Architecture:
		//   [t1 card]  ← centered over t2grid
		//      │      ← vertical from t1 bottom center, going down
		// ─────┬───── ← horizontal at t2row1 top level
		//      │      ← two verticals dropping to each card row top
		// [t2 rows]    ← each card has top border '╭'

		// Build the connector assembly:
		// Row structure from top to bottom:
		//   out: header lines
		//   t1 card (4 lines, centered)
		//   vertical: │ for a few lines
		//   horizontal + branching verticals: ┬ and │
		//   then t2 row 1 cards
		//   vertical: │
		//   then t2 row 2 cards
		//   vertical: │
		//   then t3 rows

		// Since we build lines top-down, we need to know t1's rendered
		// width vs t2's width, and the center column.
		//
		// t1 card is CARD_W wide and centered within t2RowWidth.
		// t1Left = (t2RowWidth - CARD_W) / 2

		const t1Left = Math.floor((t2RowWidth - CARD_W) / 2);
		const t1Mid  = t1Left + Math.floor(CARD_W / 2);  // absolute col of T1 center within grid
		const t2Mid  = Math.floor(t2RowWidth / 2);       // absolute col of grid center

		// The branch point is aligned with t1 center.
		// Build horizontal line: ───── (from left of tier2 to branch point)
		// The left vertical: │ from t1 bottom to branch point
		// Build branch verticals: │ from branch point to t2row1 tops (2 lines down)

		// How many │ chars from t1 bottom to branch:
		//   t1 occupies 4 lines (top, mid1, mid2, bot)
		//   branch at t2row1 top: we need 2 │ lines between t1-bot and t2row1-top
		const VERTS_TO_T2 = 2;

		// Build left-vertical segment (t1 bottom to branch)
		// These lines are just spaces with a single │ at t1Mid column
		for (let i = 0; i < VERTS_TO_T2; i++) {
			const line = " ".repeat(t1Mid) + th.fg("dim", "│") + " ".repeat(Math.max(0, t2RowWidth - t1Mid - 1));
			connectorLines.push(line);
		}

		// Horizontal branch line (left edge to branch point)
		// The horizontal starts at column 0 and goes to t1Mid (branch point)
		// Then verticals go down from t1Mid to each t2 row top
		// For t2row1 we need 1 │ line (above the cards), for t2row2 we need 1 │ line too
		// Actually: horizontal line spans full t2RowWidth at the branch row,
		// with │ verticals at columns for each of the 4 card rows' center points.
		//
		// Card center columns within the grid:
		// card i center = CARD_W/2 + i*(CARD_W+GAP)
		const cardMidCols: number[] = [];
		for (let i = 0; i < CARDS_R2; i++) {
			cardMidCols.push(Math.floor(CARD_W / 2) + i * (CARD_W + GAP));
		}

		// The branch row: ┬───────────────────── (full width)
		// Left half: ────── to first │, ────── between each │
		// Each segment before a card center is filled with '─'
		// We'll build this as one line with mixed chars
		const horizLine = connectorLines[connectorLines.length - 1]; // same width as grid
		const branchLineArr: string[] = [];
		for (let col = 0; col < t2RowWidth; col++) {
			const isAtCardMid = cardMidCols.includes(col);
			const isAtT1Mid   = col === t1Mid;
			const isBetweenCardMids = !isAtCardMid && !isAtT1Mid;
			branchLineArr.push(
				isAtCardMid || isAtT1Mid
					? th.fg("dim", "│")
					: th.fg("dim", "─")
			);
		}
		connectorLines.push(branchLineArr.join(""));

		// Now we need 1 vertical │ line from branch (at each card center) to t2row1 top
		// plus a separate vertical from branch to t2row2 top
		// Actually: the branch line IS the horizontal at branch level.
		// Verticals from branch to t2row1 top: 1 line of │ at each card center
		// Verticals from branch to t2row2 top: we need to go past t2row1 (which is 4 lines tall)
		// + 1 blank line (ROW_SP) + 1 more │ = 6 lines total from branch to t2row2 top

		// t2row1-top verticals (1 line): │ at each card center
		const t2row1VertLine = Array.from({ length: t2RowWidth }, (_, col) => {
			const isAtCardMid = cardMidCols.includes(col);
			return isAtCardMid ? th.fg("dim", "│") : " ";
		}).join("");
		connectorLines.push(t2row1VertLine);

		// t2row1 card rows (4 lines each, rendered with GAP spacing)
		for (const line of t2row1Lines) {
			connectorLines.push(line);
		}

		// t2row2-top verticals: │ at each card center, but we need to span
		// past t2row1 (4 lines) + ROW_SP (1 line) = 5 lines down from branch
		// So from after t2row1VertLine to before t2row2, we need 4 more │ lines
		for (let i = 0; i < 4; i++) {
			const line = Array.from({ length: t2RowWidth }, (_, col) => {
				const isAtCardMid = cardMidCols.includes(col);
				return isAtCardMid ? th.fg("dim", "│") : " ";
			}).join("");
			connectorLines.push(line);
		}

		// t2row2-top verticals (1 line): │ at each card center
		connectorLines.push(t2row1VertLine);

		// t2row2 card rows
		for (const line of t2row2Lines) {
			connectorLines.push(line);
		}

		// Now we have tier3 agents. Tier3 has 3 cards, centered within the tier2 grid.
		// t3RowWidth = rowWidth(3) = 3*16 + 2*2 = 52
		// t2RowWidth = 4*16 + 3*2 = 70
		// t3Left = (t2RowWidth - t3RowWidth) / 2 = (70 - 52) / 2 = 9
		const t3RowWidth = rowWidth(CARDS_R3);
		const t3Left = Math.floor((t2RowWidth - t3RowWidth) / 2);

		// t3 card center columns within grid (for connector verticals)
		const t3CardMidCols: number[] = [];
		for (let i = 0; i < CARDS_R3; i++) {
			t3CardMidCols.push(t3Left + Math.floor(CARD_W / 2) + i * (CARD_W + GAP));
		}

		// t3 branch: one vertical from branch point (center of t3 grid) down to t3 top
		// t3MidGridCol = t3Left + t3RowWidth/2 = t3Left + 26 = 9 + 26 = 35
		// t3MidGridCol should equal t2Mid = 35 ✓ (centered, same as grid center = t1Mid)
		// So we need: from after t2row2 (4 lines) + ROW_SP (1 line) + 2 more │ = 7 lines
		// Then the t3 horizontal branch (1 line), then verticals to t3 rows
		for (let i = 0; i < ROW_SP + 2; i++) {
			const line = Array.from({ length: t2RowWidth }, (_, col) => {
				const isAtGridMid = col === t2Mid;
				return isAtGridMid ? th.fg("dim", "│") : " ";
			}).join("");
			connectorLines.push(line);
		}

		// t3 horizontal branch line
		const t3HorizLine = Array.from({ length: t2RowWidth }, (_, col) => {
			const isAtT3Mid = col === t2Mid; // t3 center aligns with grid center = t2Mid = t1Mid
			const isAtT3CardMid = t3CardMidCols.includes(col);
			return isAtT3CardMid
				? th.fg("dim", "│")
				: (col >= t3Left && col < t3Left + t3RowWidth)
					? th.fg("dim", "─")
					: " ";
		}).join("");
		connectorLines.push(t3HorizLine);

		// t3 row 1-top verticals (1 line): │ at each t3 card center
		const t3VertLine = Array.from({ length: t2RowWidth }, (_, col) => {
			const isAtT3CardMid = t3CardMidCols.includes(col);
			return isAtT3CardMid ? th.fg("dim", "│") : " ";
		}).join("");
		connectorLines.push(t3VertLine);

		// ── Assemble full output ─────────────────────────────────────
		// Prepend the connector assembly, offset to center tier1 over t2 grid
		// We center the ENTIRE assembly (t2RowWidth) within the available width
		// T1 is smaller than t2, so it's already centered (t1Left padding on left)
		// We just need to add spaces to offset connector lines left of t1Left
		//
		// Actually the connector lines are already t2RowWidth chars wide.
		// We need to prefix t1 with t1Left spaces to center it.
		const t1Indent = " ".repeat(t1Left);

		const fullLines: string[] = [];
		for (const line of out) {
			fullLines.push(line); // header is centered on grid width already
		}

		// T1 card (4 lines), prefixed by t1Left spaces to center over t2 grid
		fullLines.push(t1Indent + t1Top);
		fullLines.push(t1Indent + t1Mid1);
		fullLines.push(t1Indent + t1Mid2);
		fullLines.push(t1Indent + t1Bot);

		// Connector lines (already t2RowWidth wide, but need to be indented by t1Left)
		for (const line of connectorLines) {
			fullLines.push(" ".repeat(t1Left) + line);
		}

		// t2row1 lines are already t2RowWidth wide — they need t1Left indent too
		for (const line of t2row1Lines) {
			fullLines.push(" ".repeat(t1Left) + line);
		}

		// blank row
		fullLines.push(" ".repeat(t1Left) + " ".repeat(t2RowWidth));

		// t2row2 lines
		for (const line of t2row2Lines) {
			fullLines.push(" ".repeat(t1Left) + line);
		}

		// blank row
		fullLines.push(" ".repeat(t1Left) + " ".repeat(t2RowWidth));

		// t3 row (3 cards) — needs t3Left indent within the t1Left+grid space
		// t1Left + t3Left spaces prefix
		const t3Indent = " ".repeat(t1Left + t3Left);
		const t3row = TIER3_AGENTS.map(a => card(a.name, a.subtitle, th, "muted"));
		for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
			const parts = t3row.map(c => c[lineIdx]);
			fullLines.push(t3Indent + parts.join(" ".repeat(GAP)));
		}

		// Footer
		fullLines.push("");

		return fullLines;
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}
		this.cachedLines = this.buildLines();
		this.cachedWidth = width;
		return this.cachedLines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

}

// ── Extension ───────────────────────────────────────────────────────────────

const WIDGET_KEY = "adjutant-greeting";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => {
			const widget = new GreetingWidget(theme);
			return {
				render: (w: number) => widget.render(w),
				invalidate: () => widget.invalidate(),
			};
		});
	});

	pi.on("agent_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	});

	// ── show_agents tool (callable by the agent) ──────────────────────────
	pi.registerTool({
		name: "show_agents",
		label: "Show Agents",
		description: "Display the Adjutant agent roster as a colored card grid widget above the editor.",
		parameters: Type.Object({}),
		execute: async (_callId, _params, _signal, _onUpdate, ctx) => {
			if (ctx.hasUI) {
				ctx.ui.setWidget(GRID_KEY, (_tui, _theme) => ({
					render: (w: number) => buildAgentGrid(w),
					invalidate: () => {},
				}));
			}
			return {
				content: [{ type: "text", text: "Agent grid displayed above the editor." }],
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