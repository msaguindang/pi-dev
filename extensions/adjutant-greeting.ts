/**
 * Adjutant Greeting — Foundry startup overlay
 *
 * On session_start: shows a centered overlay greeting the user as "Commander"
 * and displaying all available agents as a card grid.
 * Dismisses on any keypress.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

interface AgentEntry {
	name: string;
	subtitle: string;
}

const PACKAGE_AGENTS: AgentEntry[] = [
	{ name: "scout", subtitle: "recon" },
	{ name: "context-builder", subtitle: "deep analysis" },
	{ name: "oracle", subtitle: "consistency" },
	{ name: "planner", subtitle: "planning" },
	{ name: "researcher", subtitle: "web research" },
	{ name: "reviewer", subtitle: "code review" },
	{ name: "worker", subtitle: "implementation" },
	{ name: "delegate", subtitle: "lightweight" },
];

const DOMAIN_AGENTS: AgentEntry[] = [
	{ name: "devops", subtitle: "RPi & infra" },
	{ name: "qa", subtitle: "spec + bugs" },
	{ name: "admin", subtitle: "writing & vault" },
];

const CARD_WIDTH = 16;       // total card width including borders
const CARD_INNER = 14;       // inner width (CARD_WIDTH - 2 borders)
const CARD_TEXT_MAX = 12;    // max text width (CARD_INNER - 2 spaces left pad)
const CARDS_PER_ROW = 4;
const ROW_MARGIN = "  ";     // left margin before card rows
const CARD_GAP = "  ";       // gap between cards in a row

function renderCard(agent: AgentEntry, theme: Theme): string[] {
	const nameText = truncateToWidth(agent.name, CARD_TEXT_MAX, "…");
	const subText = truncateToWidth(agent.subtitle, CARD_TEXT_MAX, "…");

	// Plain strings padded to CARD_INNER before applying color
	// (padEnd uses byte length — safe here since no ANSI codes yet)
	const namePadded = ("  " + nameText).padEnd(CARD_INNER);
	const subPadded = ("  " + subText).padEnd(CARD_INNER);

	const top = `┌${"─".repeat(CARD_INNER)}┐`;
	const mid1 = `│${theme.fg("accent", namePadded)}│`;
	const mid2 = `│${theme.fg("muted", subPadded)}│`;
	const bot = `└${"─".repeat(CARD_INNER)}┘`;

	return [top, mid1, mid2, bot];
}

function renderCardRow(agents: AgentEntry[], theme: Theme): string[] {
	const cards = agents.map((a) => renderCard(a, theme));
	const NUM_LINES = 4;
	const lines: string[] = [];

	for (let lineIdx = 0; lineIdx < NUM_LINES; lineIdx++) {
		// Fill missing cards (last row may be shorter) with blank card-width strings
		const parts = cards.map((c) => c[lineIdx] ?? " ".repeat(CARD_WIDTH));
		lines.push(ROW_MARGIN + parts.join(CARD_GAP));
	}

	return lines;
}

function buildLines(width: number, theme: Theme): string[] {
	const center = (text: string): string => {
		const vw = visibleWidth(text);
		const pad = Math.max(0, Math.floor((width - vw) / 2));
		return truncateToWidth(" ".repeat(pad) + text, width);
	};

	const lines: string[] = [];

	// Header
	lines.push("");
	lines.push(center(theme.fg("accent", "◈  ADJUTANT ONLINE")));
	lines.push(center(theme.fg("muted", "Commander, your agents are ready.")));
	lines.push("");
	lines.push(center(theme.fg("dim", "─────────────────────────────")));
	lines.push("");

	// Package agents section
	lines.push(ROW_MARGIN + theme.fg("dim", "PACKAGE AGENTS"));
	lines.push("");

	for (let i = 0; i < PACKAGE_AGENTS.length; i += CARDS_PER_ROW) {
		const row = PACKAGE_AGENTS.slice(i, i + CARDS_PER_ROW);
		lines.push(...renderCardRow(row, theme));
		lines.push("");
	}

	// Domain agents section
	lines.push(ROW_MARGIN + theme.fg("dim", "DOMAIN AGENTS"));
	lines.push("");

	for (let i = 0; i < DOMAIN_AGENTS.length; i += CARDS_PER_ROW) {
		const row = DOMAIN_AGENTS.slice(i, i + CARDS_PER_ROW);
		lines.push(...renderCardRow(row, theme));
		lines.push("");
	}

	// Footer hint
	lines.push(center(theme.fg("dim", "press any key to continue")));
	lines.push("");

	return lines.map((line) => truncateToWidth(line, width));
}

class GreetingOverlay {
	private cachedLines?: string[];
	private cachedWidth?: number;

	constructor(
		private readonly theme: Theme,
		private readonly done: (val: undefined) => void,
	) {}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}
		this.cachedLines = buildLines(width, this.theme);
		this.cachedWidth = width;
		return this.cachedLines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	handleInput(data: string): void {
		// Dismiss on any keypress — escape is the natural dismiss, any other key also works
		if (matchesKey(data, "escape") || data) {
			this.done(undefined);
		}
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;

		// Fire-and-forget — do not block session startup
		ctx.ui
			.custom<undefined>((_tui, theme, _kb, done) => new GreetingOverlay(theme, done), {
				overlay: true,
				overlayOptions: {
					anchor: "center",
					width: "70%",
					maxHeight: "80%",
				},
			})
			.catch(() => {});
	});
}
