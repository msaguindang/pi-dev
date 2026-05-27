#!/usr/bin/env node
/**
 * cost-obsidian-sync.ts — Sync cost-history.jsonl → Obsidian daily notes
 *
 * Industry-standard sync script:
 *   - Lock file prevents concurrent runs
 *   - Structured timestamped logging → stdout (journald) + log file
 *   - Log rotation at 5MB (trim to last 2000 lines)
 *   - Status file written on every exit
 *   - On failure: notify-send desktop alert + Obsidian inbox note
 *   - Exit 0 = success or skipped (already running), Exit 1 = failure
 */

import {
	readFileSync, writeFileSync, appendFileSync,
	existsSync, mkdirSync, statSync, openSync, closeSync, unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

// ── Paths ────────────────────────────────────────────────────────────────────
const HOME          = homedir();
const COST_HISTORY  = join(HOME, ".pi", "agent", "cost-history.jsonl");
const STATUS_FILE   = join(HOME, ".pi", "agent", "cost-sync-status.json");
const LOG_FILE      = join(HOME, ".pi", "agent", "logs", "cost-sync.log");
const LOCK_FILE     = "/tmp/cost-obsidian-sync.lock";
const OBSIDIAN_ROOT = join(HOME, "Dropbox", "Obsidian");
const NOTES_DIR     = join(OBSIDIAN_ROOT, "2. Areas", "Finance", "LLM Costs");
const DASHBOARD     = join(OBSIDIAN_ROOT, "2. Areas", "Finance", "LLM Cost Dashboard.md");
const INBOX         = join(OBSIDIAN_ROOT, "00 Inbox");

const LOG_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const LOG_KEEP_LINES = 2000;

// ── State ────────────────────────────────────────────────────────────────────
const startedAt = Date.now();
let lockFd: number | null = null;
let recordsProcessed = 0;
let notesWritten = 0;

// ── Logging ──────────────────────────────────────────────────────────────────
function ts(): string { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }

function log(level: "INFO" | "WARN" | "ERROR", msg: string): void {
	const line = `[${ts()}] [${level}] ${msg}`;
	console.log(line);
	try {
		mkdirSync(dirname(LOG_FILE), { recursive: true });
		rotateLogs();
		appendFileSync(LOG_FILE, line + "\n", "utf8");
	} catch { /* log file failure is non-fatal */ }
}

function rotateLogs(): void {
	if (!existsSync(LOG_FILE)) return;
	try {
		if (statSync(LOG_FILE).size < LOG_MAX_BYTES) return;
		const lines = readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
		const kept  = lines.slice(-LOG_KEEP_LINES);
		writeFileSync(LOG_FILE, kept.join("\n") + "\n", "utf8");
	} catch { /* rotation failure is non-fatal */ }
}

// ── Lock file ────────────────────────────────────────────────────────────────
function acquireLock(): boolean {
	try {
		lockFd = openSync(LOCK_FILE, "wx");
		return true;
	} catch {
		return false; // already running
	}
}

function releaseLock(): void {
	if (lockFd !== null) {
		try { closeSync(lockFd); } catch { /* ignore */ }
		try { unlinkSync(LOCK_FILE); } catch { /* ignore */ }
		lockFd = null;
	}
}

// ── Status file ──────────────────────────────────────────────────────────────
function writeStatus(status: "success" | "failure" | "skipped", error: string | null): void {
	try {
		mkdirSync(dirname(STATUS_FILE), { recursive: true });
		writeFileSync(STATUS_FILE, JSON.stringify({
			lastRun:          ts(),
			trigger:          "scheduled",
			status,
			durationMs:       Date.now() - startedAt,
			recordsProcessed,
			notesWritten,
			error,
		}, null, 2) + "\n", "utf8");
	} catch { /* status write failure is non-fatal */ }
}

// ── Failure handlers ─────────────────────────────────────────────────────────
function onFailure(err: unknown): void {
	const msg = err instanceof Error ? err.message : String(err);
	const stack = err instanceof Error ? (err.stack ?? msg) : msg;
	const date  = new Date().toISOString().slice(0, 10);

	log("ERROR", `Sync failed: ${msg}`);

	// Desktop notification
	try {
		execSync(
			`notify-send -u critical "⚠️ Cost Sync Failed" ${JSON.stringify(msg.slice(0, 120))}`,
			{ stdio: "ignore" },
		);
	} catch { /* notify-send failure is non-fatal */ }

	// Obsidian inbox note
	try {
		mkdirSync(INBOX, { recursive: true });
		const notePath = join(INBOX, `⚠️ Cost Sync Failed ${date}.md`);
		writeFileSync(notePath,
			`# ⚠️ Cost Sync Failed — ${date}\n\n` +
			`**Time:** ${ts()}\n\n` +
			`**Error:** ${msg}\n\n` +
			`\`\`\`\n${stack}\n\`\`\`\n`,
			"utf8",
		);
	} catch { /* inbox write failure is non-fatal */ }

	writeStatus("failure", msg);
}

// ── Cleanup on exit ──────────────────────────────────────────────────────────
process.on("exit",    releaseLock);
process.on("SIGTERM", () => { releaseLock(); process.exit(0); });
process.on("SIGINT",  () => { releaseLock(); process.exit(0); });

// ── Data types ───────────────────────────────────────────────────────────────
interface CostRecord {
	ts: number;
	agent: string;
	model: string;
	provider: string;
	turns: number;
	usage: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number };
}

function toDate(ts: number):  string {
	const d = new Date(ts * 1000);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function usd(n: number):      string { return `$${n.toFixed(4)}`; }
function fmtNum(n: number):   string { return n.toLocaleString(); }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	// Lock
	if (!acquireLock()) {
		log("WARN", "Another instance is already running — skipping this run.");
		writeStatus("skipped", null);
		process.exit(0);
	}

	log("INFO", "Starting cost-obsidian-sync");

	// Load records
	if (!existsSync(COST_HISTORY)) {
		log("INFO", "No cost-history.jsonl found — nothing to sync.");
		writeStatus("success", null);
		process.exit(0);
	}

	const raw = readFileSync(COST_HISTORY, "utf-8");
	const records: CostRecord[] = raw
		.split("\n")
		.filter(Boolean)
		.map(l => { try { return JSON.parse(l) as CostRecord; } catch { return null; } })
		.filter((r): r is CostRecord => r !== null && typeof r.ts === "number");

	recordsProcessed = records.length;
	log("INFO", `Loaded ${recordsProcessed} records`);

	if (recordsProcessed === 0) {
		log("INFO", "No valid records — nothing to sync.");
		writeStatus("success", null);
		process.exit(0);
	}

	// Group by date
	const byDate: Record<string, CostRecord[]> = {};
	for (const r of records) {
		const d = toDate(r.ts);
		(byDate[d] ??= []).push(r);
	}

	// Ensure output dir exists
	mkdirSync(NOTES_DIR, { recursive: true });

	// Write daily notes
	for (const [date, dayRecs] of Object.entries(byDate)) {
		const totalCost   = dayRecs.reduce((s, r) => s + r.usage.cost, 0);
		const totalTokens = dayRecs.reduce((s, r) => s + r.usage.input + r.usage.output, 0);
		const totalTurns  = dayRecs.reduce((s, r) => s + r.turns, 0);
		const totalRuns   = dayRecs.length;

		// By agent
		const byAgent: Record<string, { cost: number; runs: number; tokens: number }> = {};
		for (const r of dayRecs) {
			const a = byAgent[r.agent] ??= { cost: 0, runs: 0, tokens: 0 };
			a.cost   += r.usage.cost;
			a.runs++;
			a.tokens += r.usage.input + r.usage.output;
		}

		// By model
		const byModel: Record<string, { cost: number; runs: number }> = {};
		for (const r of dayRecs) {
			const m = byModel[r.model] ??= { cost: 0, runs: 0 };
			m.cost += r.usage.cost;
			m.runs++;
		}

		const agentRows = Object.entries(byAgent)
			.sort((a, b) => b[1].cost - a[1].cost)
			.map(([agent, s]) => `| ${agent} | ${usd(s.cost)} | ${s.runs} | ${fmtNum(s.tokens)} |`)
			.join("\n");

		const modelRows = Object.entries(byModel)
			.sort((a, b) => b[1].cost - a[1].cost)
			.map(([model, s]) => `| ${model} | ${usd(s.cost)} | ${s.runs} |`)
			.join("\n");

		const content =
`---
date: ${date}
llm_cost: ${Number(totalCost.toFixed(6))}
llm_tokens: ${totalTokens}
llm_runs: ${totalRuns}
llm_turns: ${totalTurns}
---

# LLM Cost — ${date}

**Total: ${usd(totalCost)}** across ${totalRuns} runs, ${fmtNum(totalTokens)} tokens

## By Agent
| Agent | Cost | Runs | Tokens |
|---|---|---|---|
${agentRows}

## By Model
| Model | Cost | Runs |
|---|---|---|
${modelRows}
`;

		const notePath = join(NOTES_DIR, `${date}.md`);
		writeFileSync(notePath, content, "utf8");
		notesWritten++;
	}

	log("INFO", `Wrote ${notesWritten} daily notes`);

	// Write dashboard
	const syncTime = ts();
	const dashboard =
`---
tags: [finance, llm, dashboard]
---

# LLM Cost Dashboard

> Last synced: ${syncTime}

## Spending Heatmap

\`\`\`dataviewjs
const calendarData = {
    year: new Date().getFullYear(),
    heatmapTitle: "Daily LLM Cost",
    heatmapSubtitle: "USD per day",
    defaultEntryIntensity: 1,
    intensityScaleStart: 0,
    intensityScaleEnd: 2,
    entries: [],
}
for (let page of dv.pages('"2. Areas/Finance/LLM Costs"').where(p => p.llm_cost)) {
    calendarData.entries.push({
        date: page.file.name,
        intensity: page.llm_cost,
        content: "$" + page.llm_cost.toFixed(2),
    })
}
renderHeatmap(this, calendarData)
\`\`\`

## Recent Days

\`\`\`dataview
TABLE llm_cost AS "Cost (USD)", llm_runs AS "Runs", llm_tokens AS "Tokens"
FROM "2. Areas/Finance/LLM Costs"
SORT file.name DESC
LIMIT 30
\`\`\`

## Monthly Totals

\`\`\`dataviewjs
const pages = dv.pages('"2. Areas/Finance/LLM Costs"').where(p => p.llm_cost);
const byMonth = {};
for (let p of pages) {
    const month = p.file.name.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + p.llm_cost;
}
const rows = Object.entries(byMonth)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([m, c]) => [m, "$" + c.toFixed(4)]);
dv.table(["Month", "Total Cost"], rows);
\`\`\`
`;

	mkdirSync(dirname(DASHBOARD), { recursive: true });
	writeFileSync(DASHBOARD, dashboard, "utf8");
	log("INFO", `Dashboard written: ${DASHBOARD}`);

	writeStatus("success", null);
	log("INFO", `Sync complete — ${recordsProcessed} records, ${notesWritten} notes, ${Date.now() - startedAt}ms`);
}

main().catch(err => {
	onFailure(err);
	process.exit(1);
});
