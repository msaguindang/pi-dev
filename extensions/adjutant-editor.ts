import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Component, EditorTheme, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function fitBorder(
	left: string,
	right: string,
	width: number,
	border: (text: string) => string,
	fill: (text: string) => string = border,
): string {
	if (width <= 0) return "";
	if (width === 1) return border("─");

	let leftText = left;
	let rightText = right;
	const fixedWidth = 2;
	const minimumGap = 3;

	while (
		fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
		visibleWidth(rightText) > 0
	) {
		rightText = truncateToWidth(rightText, Math.max(0, visibleWidth(rightText) - 1), "");
	}
	while (
		fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
		visibleWidth(leftText) > 0
	) {
		leftText = truncateToWidth(leftText, Math.max(0, visibleWidth(leftText) - 1), "");
	}

	const gapWidth = Math.max(0, width - fixedWidth - visibleWidth(leftText) - visibleWidth(rightText));
	return `${border("─")}${leftText}${fill("─".repeat(gapWidth))}${rightText}${border("─")}`;
}

function formatCwd(cwd: string): string {
	const home = process.env.HOME;
	if (home && cwd.startsWith(home)) {
		return `~${cwd.slice(home.length)}`;
	}
	return cwd;
}

function formatContext(ctx: ExtensionContext): string {
	const usage = ctx.getContextUsage();
	const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow;
	if (!contextWindow || !usage || usage.percent === null) {
		return "ctx ?";
	}
	return `ctx ${Math.round(usage.percent)}%/${(contextWindow / 1000).toFixed(0)}k`;
}

function formatThinking(level: string): string {
	return level === "off" ? "off" : level;
}

class EmptyFooter implements Component {
	render(): string[] {
		return [];
	}

	invalidate(): void {}
}

// Module-level state shared across sessions
let _activeTui: TUI | undefined;

export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", () => {
		_activeTui = undefined;
	});

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter(() => new EmptyFooter());
		ctx.ui.setWorkingIndicator({ frames: [] });

		let branch: string | undefined;

		const refreshBranch = async () => {
			const result = await pi
				.exec("git", ["branch", "--show-current"], { cwd: ctx.cwd })
				.catch(() => undefined);
			const stdout = result?.stdout.trim();
			branch = stdout && stdout.length > 0 ? stdout : undefined;
			_activeTui?.requestRender();
		};
		void refreshBranch();

		// Intercept setEditorComponent so any editor installed by any extension
		// (including pi-paster which runs after us) gets our border decoration.
		const origSetEditorComponent = ctx.ui.setEditorComponent;
		ctx.ui.setEditorComponent = (factory) => {
			if (!factory) {
				origSetEditorComponent(factory);
				return;
			}
			origSetEditorComponent((tui, theme, keybindings) => {
				const editor = factory(tui, theme, keybindings);
				_activeTui = tui;
				const origRender = editor.render.bind(editor);
				editor.render = (width: number): string[] => {
					const lines = origRender(width);
					if (lines.length < 2) return lines;
					// Strip cursor marker so Pi skips hardware cursor repositioning
					// outside synchronized output — those cursor moves disrupt WezTerm copy mode selection.
					const CURSOR_MARKER = "\x1b_pi:c\x07";
					for (let i = 0; i < lines.length; i++) {
						if (lines[i]!.includes(CURSOR_MARKER)) {
							lines[i] = lines[i]!.replace(CURSOR_MARKER, "");
							break;
						}
					}
					// Session name on the upper-right, hide for now
					// const topRight = `\x1b[48;2;122;162;247m\x1b[38;2;26;27;38m ${displayName} \x1b[0m`;
					const topRight = '';
					const borderFn = (text: string) => (editor as any).borderColor(text);
					lines[0] = fitBorder("", topRight, width, borderFn);
					lines[lines.length - 1] = fitBorder("", "", width, borderFn);
					return lines;
				};
				return editor;
			});
		};

		// Install base CustomEditor; pi-paster (or any other extension) will
		// override via our interceptor above, keeping the border decoration.
		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) => new CustomEditor(tui, theme, keybindings),
		);

		// Info line below the editor border
		ctx.ui.setWidget(
			"adjutant-info",
			(_tui, theme) => ({
				render(width: number): string[] {
					const thinking = pi.getThinkingLevel();
					const left = theme.fg(
						"dim",
						` ${formatCwd(ctx.cwd)}${branch ? ` (${branch})` : ""} `,
					);
					const right = theme.fg(
						"dim",
						` ${ctx.model?.id ?? "no model"} · ${formatThinking(thinking)} · ${formatContext(ctx)} `,
					);
					const minGap = 1;
					let leftText = left;
					let rightText = right;
					const maxLeft = width - visibleWidth(rightText) - minGap;
					if (visibleWidth(leftText) > maxLeft) {
						leftText = truncateToWidth(leftText, Math.max(0, maxLeft), "…");
					}
					if (visibleWidth(leftText) + visibleWidth(rightText) + minGap > width) {
						const maxRight = width - visibleWidth(leftText) - minGap;
						rightText = truncateToWidth(rightText, Math.max(0, maxRight), "…");
					}
					const gap = Math.max(minGap, width - visibleWidth(leftText) - visibleWidth(rightText));
					return [leftText + " ".repeat(gap) + rightText];
				},
				invalidate() {},
			}),
			{ placement: "belowEditor" },
		);
	});
}
