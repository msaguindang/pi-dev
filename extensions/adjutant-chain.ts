/**
 * Adjutant Chain — horizontal chain card visualization for subagent({ chain: [...] })
 *
 * Hooks into tool_call and tool_result events on the "subagent" tool.
 * When a chain call is detected, renders a horizontal row of connected cards
 * showing each step's name and status in real time.
 *
 * Visual layout:
 *   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
 *   │ planner     │   ──→   │ worker      │   ──→   │ reviewer    │
 *   │ ⠙ running  │         │ ○ pending   │         │ ○ pending   │
 *   │ 42s         │         │             │         │             │
 *   └─────────────┘         └─────────────┘         └─────────────┘
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// ── Colors ────────────────────────────────────────────────────────────────

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

// ── Spinner ────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"] as const;

// ── Types ──────────────────────────────────────────────────────────────────

type StepStatus = "running" | "pending" | "done";

interface ChainStep {
	name: string;
	status: StepStatus;
}

interface ChainState {
	steps: ChainStep[];
	startTime: number;
	elapsed: number;          // ms since chain started
	spinnerFrame: number;
	tickTimer?: ReturnType<typeof setInterval>;
	clearTimer?: ReturnType<typeof setTimeout>;
}

interface ParallelStep {
	name: string;
	status: "running" | "done";
}

interface ParallelState {
	steps: ParallelStep[];
	startTime: number;
	elapsed: number;
	spinnerFrame: number;
	tickTimer?: ReturnType<typeof setInterval>;
	clearTimer?: ReturnType<typeof setTimeout>;
}

// ── Chain step extraction ──────────────────────────────────────────────────

/**
 * Extract a flat list of display names from a `chain` array.
 * Each element is either:
 *   { agent: string, task: string }          → sequential step
 *   { parallel: Array<{ agent: string }> }   → parallel group
 */
function extractStepNames(chain: unknown[]): string[] {
	const names: string[] = [];
	for (const element of chain) {
		if (!element || typeof element !== "object") continue;
		const el = element as Record<string, unknown>;
		if (typeof el["agent"] === "string") {
			names.push(el["agent"]);
		} else if (Array.isArray(el["parallel"])) {
			const agents = (el["parallel"] as unknown[])
				.filter((p): p is { agent: string } => !!p && typeof (p as Record<string,unknown>)["agent"] === "string")
				.map(p => p.agent);
			if (agents.length > 0) {
				names.push(agents.join("+"));
			} else {
				names.push("parallel");
			}
		}
	}
	return names.length > 0 ? names : ["(chain)"];
}

// ── Card rendering ─────────────────────────────────────────────────────────

const ARROW_SEGMENT = " ────▶ "; // 7 visible chars — longer line + hollow arrowhead
const ARROW_WIDTH   = visibleWidth(ARROW_SEGMENT);

/**
 * Render all chain steps as a horizontal row of connected cards.
 * Returns an array of strings (one per rendered line).
 */
function renderChain(state: ChainState, termWidth: number): string[] {
	const { steps } = state;
	if (steps.length === 0) return [];

	const stepCount  = steps.length;
	const totalArrow = ARROW_WIDTH * (stepCount - 1);
	// Reserve 2 for leading/trailing margin
	const available  = termWidth - 2 - totalArrow;
	const cardWidth  = Math.max(14, Math.floor(available / stepCount));

	// Build per-card line arrays (3 lines each: top, content, bottom)
	const cardLines: string[][] = steps.map((step, idx) =>
		renderChainCard(step, idx, state, cardWidth)
	);

	// Weave lines together: for each row line, join cards with arrows
	const rowHeight = cardLines[0]?.length ?? 3;
	const lines: string[] = [""];

	for (let lineIdx = 0; lineIdx < rowHeight; lineIdx++) {
		const parts: string[] = [];
		for (let ci = 0; ci < cardLines.length; ci++) {
			parts.push(cardLines[ci]![lineIdx] ?? "");
			if (ci < cardLines.length - 1) {
				// Arrow only on the middle content line, blank otherwise
				if (lineIdx === 1) {
					parts.push("\x1b[2m" + ARROW_SEGMENT + "\x1b[22m");
				} else {
					parts.push(" ".repeat(ARROW_WIDTH));
				}
			}
		}
		lines.push(" " + parts.join(""));
	}

	lines.push("");
	return lines;
}

/**
 * Render a single card as 3 lines (top border, content, bottom border).
 */
function renderChainCard(
	step: ChainStep,
	_idx: number,
	state: ChainState,
	cardWidth: number,
): string[] {
	const { bg, br } = AGENT_COLORS[step.name] ?? DEFAULT_COLORS;
	const inner = cardWidth - 2; // subtract 2 for border chars

	const bord  = (s: string) => bg + br + s + "\x1b[0m";
	const reset  = "\x1b[0m";

	// Helper: pad/truncate content to exactly `inner` visible chars
	const padLine = (content: string, contentVisLen: number): string => {
		const pad = Math.max(0, inner - contentVisLen);
		return (
			bord("│") +
			bg + content + reset +
			bg + " ".repeat(pad) + BG_RESET +
			bord("│")
		);
	};

	// ── Line 1: top border ─────────────────────────────────────────────
	const topLine = bord("┌" + "─".repeat(inner) + "┐");

	// ── Line 2: status + name + elapsed ───────────────────────────────
	let icon: string;
	let iconVisLen: number;

	if (step.status === "done") {
		icon = "\x1b[38;2;80;190;80m✓" + FG_RESET;
		iconVisLen = 1;
	} else if (step.status === "running") {
		const frame = SPINNER_FRAMES[state.spinnerFrame % SPINNER_FRAMES.length]!;
		icon = "\x1b[38;2;0;180;220m" + frame + FG_RESET;
		iconVisLen = 1;
	} else {
		// pending
		icon = "\x1b[2m○\x1b[22m";
		iconVisLen = 1;
	}

	// Name segment: colored + bold, truncated
	const maxNameLen = Math.max(1, inner - 3); // " " + icon + " " + name
	const nameTrunc  = truncateToWidth(step.name, maxNameLen);
	const nameVis    = visibleWidth(nameTrunc);

	// Elapsed (only on the first running card)
	let elapsedSuffix = "";
	let elapsedVisLen = 0;
	if (step.status === "running") {
		const secs = Math.floor(state.elapsed / 1000);
		elapsedSuffix = "  " + secs + "s";
		elapsedVisLen = visibleWidth(elapsedSuffix);
	}

	// Total visible content: " " + icon + " " + name + elapsedSuffix
	const contentVisLen = 1 + iconVisLen + 1 + nameVis + elapsedVisLen;
	const content =
		" " +
		icon +
		" " +
		br + "\x1b[1m" + nameTrunc + "\x1b[22m" + FG_RESET +
		(elapsedSuffix ? "\x1b[2m" + elapsedSuffix + "\x1b[22m" : "");

	const contentLine = padLine(content, contentVisLen);

	// ── Line 3: sub-status hint ────────────────────────────────────────
	let hintText: string;
	let hintVisLen: number;
	if (step.status === "pending") {
		hintText = " \x1b[2mpending\x1b[22m";
		hintVisLen = 8; // " pending"
	} else if (step.status === "done") {
		hintText = " \x1b[2mdone\x1b[22m";
		hintVisLen = 5;
	} else {
		hintText = "";
		hintVisLen = 0;
	}

	const hintLine = padLine(hintText, hintVisLen);

	// ── Line 4: bottom border ──────────────────────────────────────────
	const bottomLine = bord("└" + "─".repeat(inner) + "┘");

	return [topLine, contentLine, hintLine, bottomLine];
}

// ── Parallel grid renderer ──────────────────────────────────────────────────

function renderParallel(state: ParallelState, termWidth: number): string[] {
	const cols      = Math.min(3, state.steps.length);
	const GAP       = 1;
	const cardWidth = Math.max(14, Math.floor((termWidth - 2 - GAP * (cols - 1)) / cols));
	const tempState: ChainState = {
		steps:        state.steps.map(s => ({ name: s.name, status: s.status as StepStatus })),
		startTime:    state.startTime,
		elapsed:      state.elapsed,
		spinnerFrame: state.spinnerFrame,
	};
	const lines: string[] = [""];
	for (let i = 0; i < tempState.steps.length; i += cols) {
		const row   = tempState.steps.slice(i, i + cols);
		const cards = row.map((step, idx) => renderChainCard(step, idx, tempState, cardWidth));
		while (cards.length < cols) cards.push(Array(4).fill(" ".repeat(cardWidth)));
		const h = cards[0]?.length ?? 4;
		for (let l = 0; l < h; l++) lines.push(" " + cards.map(c => c[l] ?? "").join(" ".repeat(GAP)));
		lines.push("");
	}
	return lines;
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	let activeChain: ChainState | null       = null;
	let activeCallId: string | null          = null;
	let activeParallel: ParallelState | null = null;
	let activeParallelId: string | null      = null;
	let widgetCtx: any                       = null;

	const WIDGET_KEY   = "adjutant-chain";
	const PARALLEL_KEY = "adjutant-parallel";

	// ── Widget updater ───────────────────────────────────────────────────

	function setWidget(): void {
		if (!widgetCtx?.hasUI || !activeChain) return;
		const chainSnapshot = activeChain; // capture for closure
		widgetCtx.ui.setWidget(WIDGET_KEY, (_tui: any, _theme: any) => ({
			render:     (w: number) => renderChain(chainSnapshot, w),
			invalidate: () => {},
		}));
	}

	function clearWidget(): void {
		if (!widgetCtx?.hasUI) return;
		widgetCtx.ui.setWidget(WIDGET_KEY, undefined);
	}

	function teardownChain(): void {
		if (!activeChain) return;
		if (activeChain.tickTimer)  { clearInterval(activeChain.tickTimer);  activeChain.tickTimer  = undefined; }
		if (activeChain.clearTimer) { clearTimeout(activeChain.clearTimer);  activeChain.clearTimer = undefined; }
		activeChain = null;
		activeCallId = null;
	}

	function setParallelWidget(): void {
		if (!widgetCtx?.hasUI || !activeParallel) return;
		const snap = activeParallel;
		widgetCtx.ui.setWidget(PARALLEL_KEY, (_tui: any, _theme: any) => ({
			render:     (w: number) => renderParallel(snap, w),
			invalidate: () => {},
		}));
	}

	function teardownParallel(): void {
		if (!activeParallel) return;
		if (activeParallel.tickTimer)  { clearInterval(activeParallel.tickTimer);  activeParallel.tickTimer  = undefined; }
		if (activeParallel.clearTimer) { clearTimeout(activeParallel.clearTimer);  activeParallel.clearTimer = undefined; }
		activeParallel   = null;
		activeParallelId = null;
	}

	// ── tool_call: intercept subagent({ chain: [...] }) ──────────────────

	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "subagent") return;
		widgetCtx = ctx;

		const input = event.input as Record<string, unknown>;

		// parallel tasks mode
		if (Array.isArray(input["tasks"])) {
			teardownParallel();
			const steps: ParallelStep[] = (input["tasks"] as Array<Record<string, unknown>>)
				.filter(t => typeof t["agent"] === "string")
				.map(t => ({ name: t["agent"] as string, status: "running" as const }));
			if (steps.length === 0) return;
			const parallel: ParallelState = { steps, startTime: Date.now(), elapsed: 0, spinnerFrame: 0 };
			activeParallel   = parallel;
			activeParallelId = event.toolCallId;
			parallel.tickTimer = setInterval(() => {
				if (!activeParallel) return;
				activeParallel.elapsed      = Date.now() - parallel.startTime;
				activeParallel.spinnerFrame = (activeParallel.spinnerFrame + 1) % SPINNER_FRAMES.length;
				setParallelWidget();
			}, 80);
			setParallelWidget();
			return;
		}

		if (!Array.isArray(input["chain"])) return; // not a chain call — ignore

		// Clean up any lingering chain
		teardownChain();

		const stepNames = extractStepNames(input["chain"] as unknown[]);
		const steps: ChainStep[] = stepNames.map((name, i) => ({
			name,
			status: i === 0 ? "running" : "pending",
		}));

		const chain: ChainState = {
			steps,
			startTime:    Date.now(),
			elapsed:      0,
			spinnerFrame: 0,
		};

		activeChain  = chain;
		activeCallId = event.toolCallId;

		// Tick timer: 80ms for smooth spinner + elapsed update
		chain.tickTimer = setInterval(() => {
			if (!activeChain) return;
			activeChain.elapsed      = Date.now() - chain.startTime;
			activeChain.spinnerFrame = (activeChain.spinnerFrame + 1) % SPINNER_FRAMES.length;
			setWidget();
		}, 80);

		setWidget();
	});

	// ── tool_result: chain or parallel completed ──────────────────────────────

	pi.on("tool_result", (event, ctx) => {
		if (event.toolName !== "subagent") return;
		widgetCtx = ctx;

		// parallel completion
		if (event.toolCallId === activeParallelId && activeParallel) {
			if (activeParallel.tickTimer) { clearInterval(activeParallel.tickTimer); activeParallel.tickTimer = undefined; }
			for (const s of activeParallel.steps) s.status = "done";
			activeParallel.elapsed = Date.now() - activeParallel.startTime;
			setParallelWidget();
			const pRef = activeParallel;
			pRef.clearTimer = setTimeout(() => { widgetCtx?.ui?.setWidget(PARALLEL_KEY, undefined); teardownParallel(); }, 3000);
			return;
		}

		if (event.toolCallId !== activeCallId) return;

		if (!activeChain) return;

		// Stop ticker
		if (activeChain.tickTimer) {
			clearInterval(activeChain.tickTimer);
			activeChain.tickTimer = undefined;
		}

		// Mark all steps done
		for (const step of activeChain.steps) {
			step.status = "done";
		}
		activeChain.elapsed = Date.now() - activeChain.startTime;

		setWidget();

		// Clear after 3 seconds
		const chainRef = activeChain;
		chainRef.clearTimer = setTimeout(() => {
			clearWidget();
			teardownChain();
		}, 3000);
	});

	// ── Session lifecycle: clean up on shutdown ───────────────────────────

	pi.on("session_start", (_event, ctx) => {
		widgetCtx = ctx;
		teardownChain();
		teardownParallel();
		if (ctx.hasUI) {
			ctx.ui.setWidget(WIDGET_KEY, undefined);
			ctx.ui.setWidget(PARALLEL_KEY, undefined);
		}
	});

	pi.on("session_shutdown", () => {
		teardownChain();
		teardownParallel();
	});
}
