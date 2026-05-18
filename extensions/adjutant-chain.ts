/**
 * Adjutant Chain Visualizer
 *
 * Renders a neon-bordered card grid above the editor showing agent flow
 * whenever the subagent tool is invoked — chain, parallel, or single.
 *
 * Chain:    ◆ ADJUTANT CHAIN
 *           ╭──────────╮        ╭──────────╮        ╭──────────╮
 *           │  scout   │  ──▶   │ planner  │  ──▶   │  worker  │
 *           ╰──────────╯        ╰──────────╯        ╰──────────╯
 *
 * Parallel: ◆ ADJUTANT PARALLEL
 *           ╭────────────────╮  ╭────────────────╮  ╭────────────────╮
 *           │    scout       │  │   researcher   │  │ context-builder│
 *           ╰────────────────╯  ╰────────────────╯  ╰────────────────╯
 *
 * Single:   ◆ ADJUTANT
 *           ╭──────────────────╮
 *           │      devops      │
 *           ╰──────────────────╯
 *
 * Clears on tool_result.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "adjutant-chain";

// ── Types ──────────────────────────────────────────────────────────────────

interface ParallelStep {
	agent?: string;
	task?: string;
}

interface ChainStep {
	agent?: string;
	task?: string;
	parallel?: ParallelStep[];
}

interface SubagentInput {
	// Single
	agent?: string;
	task?: string;
	// Chain
	chain?: ChainStep[];
	// Parallel
	tasks?: ParallelStep[];
}

// ── Card Builder ────────────────────────────────────────────────────────────

function card(
	name: string,
	width: number,
	colorFn: (s: string) => string,
): string[] {
	const innerWidth = width - 4; // subtract 2 for ╭/╮ and 2 for spaces
	const padded = name.padStart(Math.floor((innerWidth + name.length) / 2), " ")
		.padEnd(width - 4, " ");

	return [
		colorFn("╭" + "─".repeat(width - 2) + "╮"),
		colorFn("║ " + padded + " ║"),
		colorFn("╰" + "─".repeat(width - 2) + "╯"),
	];
}

// ── Chain Card ───────────────────────────────────────────────────────────────
// A chain card uses a narrower width derived from the agent name, 3 lines tall.

function chainCard(
	name: string,
	colorFn: (s: string) => string,
): string[] {
	const width = Math.max(name.length + 4, 12);
	return card(name, width, colorFn);
}

// ── Parallel Card ─────────────────────────────────────────────────────────────
// A parallel card is wider (20 cols), 3 lines tall, always accent-colored.

function parallelCard(
	name: string,
	accentFn: (s: string) => string,
): string[] {
	return card(name, 20, accentFn);
}

// ── Single Card ──────────────────────────────────────────────────────────────

function singleCard(
	name: string,
	accentFn: (s: string) => string,
): string[] {
	return card(name, Math.max(name.length + 6, 20), accentFn);
}

// ── Line Joiner ──────────────────────────────────────────────────────────────
// Joins card rows horizontally. Cards is [topLines[], topLines[], ...]
// each card is 3 lines. Returns array of joined strings.

function joinCards(
	cards: string[][][],
	sep: string,
): string[] {
	const lines: string[] = [];
	for (let row = 0; row < 3; row++) {
		const parts = cards.map((c) => c[row] || "");
		lines.push(parts.join(sep));
	}
	return lines;
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event, _ctx) => {
		if (event.toolName !== "subagent") return undefined;
		if (!_ctx.hasUI) return undefined;

		const input = event.input as SubagentInput;
		const t = _ctx.ui.theme;
		const accent = (s: string) => t.fg("accent", s);
		const muted = (s: string) => t.fg("muted", s);
		const dim = (s: string) => t.fg("dim", s);

		// ── Chain mode ────────────────────────────────────────────────────
		if (input.chain && input.chain.length > 0) {
			const title = dim("  ◆ ADJUTANT CHAIN");
			const cards: string[][][] = [];

			for (let i = 0; i < input.chain.length; i++) {
				const step = input.chain[i]!;
				if (step.agent) {
					const fn = i === 0 ? accent : muted;
					cards.push(chainCard(step.agent, fn));
				} else if (step.parallel && step.parallel.length > 0) {
					// Parallel group rendered as a single wider card with names joined by /
					const names = step.parallel
						.filter((p) => p.agent)
						.map((p) => p.agent!)
						.join(" / ");
					const fn = i === 0 ? accent : muted;
					cards.push([
						dim("╭" + "─".repeat(Math.max(names.length + 4, 14) - 2) + "╮"),
						dim("║ ") + fn(names.padStart(Math.floor((Math.max(names.length + 4, 14) + names.length) / 2), " ").padEnd(Math.max(names.length + 4, 14) - 4, " ")) + dim(" ║"),
						dim("╰" + "─".repeat(Math.max(names.length + 4, 14) - 2) + "╯"),
					]);
				}
			}

			const arrow = dim("  ──▶  ");
			const cardLines = joinCards(cards, arrow);

			_ctx.ui.setWidget(WIDGET_KEY, [
				"",
				title,
				"  " + cardLines[0],
				"  " + cardLines[1],
				"  " + cardLines[2],
				"",
			]);
			return undefined;
		}

		// ── Parallel mode ─────────────────────────────────────────────────
		if (input.tasks && input.tasks.length > 0) {
			const title = dim("  ◆ ADJUTANT PARALLEL");
			const cards: string[][][] = [];

			for (const task of input.tasks) {
				if (task.agent) {
					cards.push(parallelCard(task.agent, accent));
				}
			}

			if (cards.length === 0) return undefined;

			const cardLines = joinCards(cards, "  ");
			_ctx.ui.setWidget(WIDGET_KEY, [
				"",
				title,
				"  " + cardLines[0],
				"  " + cardLines[1],
				"  " + cardLines[2],
				"",
			]);
			return undefined;
		}

		// ── Single agent mode ─────────────────────────────────────────────
		if (input.agent) {
			const title = dim("  ◆ ADJUTANT");
			const lines = singleCard(input.agent, accent);
			_ctx.ui.setWidget(WIDGET_KEY, [
				"",
				title,
				"  " + lines[0],
				"  " + lines[1],
				"  " + lines[2],
				"",
			]);
			return undefined;
		}

		return undefined;
	});

	pi.on("tool_result", (event, _ctx) => {
		if (event.toolName !== "subagent") return;
		if (!_ctx.hasUI) return;
		_ctx.ui.setWidget(WIDGET_KEY, undefined);
	});
}