/**
 * Adjutant Chain Visualizer
 *
 * Renders a widget above the editor showing agent flow whenever
 * the subagent tool is invoked — chain, parallel, or single.
 *
 * Chain:    ◆ ADJUTANT CHAIN
 *           [ scout ] ──► [ planner ] ──► [ worker ]
 *
 * Parallel: ◆ ADJUTANT PARALLEL
 *           [ scout ]  [ researcher ]  [ context-builder ]
 *
 * Single:   ◆ ADJUTANT
 *           [ devops ]
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

// ── Helpers ────────────────────────────────────────────────────────────────

function card(name: string, colorFn: (s: string) => string): string {
	return colorFn("[ ") + colorFn(name) + colorFn(" ]");
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "subagent") return undefined;
		if (!ctx.hasUI) return undefined;

		const input = event.input as SubagentInput;
		const t = ctx.ui.theme;
		const lines: string[] = [];

		// ── Chain mode ────────────────────────────────────────────────────
		if (input.chain && input.chain.length > 0) {
			lines.push(t.fg("dim", "  ◆ ADJUTANT CHAIN"));

			const cards: string[] = [];
			for (let i = 0; i < input.chain.length; i++) {
				const step = input.chain[i]!;
				// Step is active if it's the first step
				const isActive = i === 0;
				const colorFn = isActive
					? (s: string) => t.fg("accent", s)
					: (s: string) => t.fg("muted", s);

				if (step.agent) {
					cards.push(card(step.agent, colorFn));
				} else if (step.parallel && step.parallel.length > 0) {
					// Parallel group within chain — wrap in braces
					const inner = step.parallel
						.filter((p) => p.agent)
						.map((p) => card(p.agent!, colorFn))
						.join(t.fg("dim", "  "));
					cards.push(t.fg("dim", "{ ") + inner + t.fg("dim", " }"));
				}
			}

			const arrow = t.fg("dim", " ──► ");
			lines.push("  " + cards.join(arrow));

		// ── Parallel mode ─────────────────────────────────────────────────
		} else if (input.tasks && input.tasks.length > 0) {
			lines.push(t.fg("dim", "  ◆ ADJUTANT PARALLEL"));

			const cards = input.tasks
				.filter((task) => task.agent)
				.map((task) => card(task.agent!, (s) => t.fg("accent", s)));

			lines.push("  " + cards.join("  "));

		// ── Single agent mode ─────────────────────────────────────────────
		} else if (input.agent) {
			lines.push(t.fg("dim", "  ◆ ADJUTANT"));
			lines.push("  " + card(input.agent, (s) => t.fg("accent", s)));
		}

		if (lines.length > 0) {
			// Pad with empty lines for breathing room
			ctx.ui.setWidget(WIDGET_KEY, ["", ...lines, ""]);
		}

		return undefined;
	});

	pi.on("tool_result", (event, ctx) => {
		if (event.toolName !== "subagent") return;
		if (!ctx.hasUI) return;
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	});
}
