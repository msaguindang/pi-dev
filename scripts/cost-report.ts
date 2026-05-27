#!/usr/bin/env node
/**
 * cost-report.ts — LLM cost reporting CLI
 * Usage: npx tsx ~/.pi/agent/scripts/cost-report.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const COST_HISTORY = join(homedir(), ".pi", "agent", "cost-history.jsonl");
const SEP = "─".repeat(56);

interface CostRecord {
	ts: number;
	agent: string;
	model: string;
	provider: string;
	turns: number;
	durationMs: number;
	incomplete?: boolean;
	usage: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number };
}

function usd(n: number): string { return `$${n.toFixed(4)}`; }
function toDate(ts: number): string {
	const d = new Date(ts * 1000);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function toMonth(ts: number): string {
	const d = new Date(ts * 1000);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 7);
}

function bar(cost: number, max: number, width = 36): string {
	if (max === 0) return "";
	const filled = Math.max(1, Math.round((cost / max) * width));
	return "█".repeat(filled);
}

// ── Load records ────────────────────────────────────────────────────────────
if (!existsSync(COST_HISTORY)) {
	console.log(`\nNo cost history found at ${COST_HISTORY}`);
	console.log("Run some agent tasks first.\n");
	process.exit(0);
}

const records: CostRecord[] = readFileSync(COST_HISTORY, "utf-8")
	.split("\n")
	.filter(Boolean)
	.map(l => { try { return JSON.parse(l) as CostRecord; } catch { return null; } })
	.filter((r): r is CostRecord => r !== null && typeof r.ts === "number");

if (records.length === 0) {
	console.log("\nCost history file exists but contains no valid records.\n");
	process.exit(0);
}

const today = toDate(Math.floor(Date.now() / 1000));

// ── Today ───────────────────────────────────────────────────────────────────
const todayRecs   = records.filter(r => toDate(r.ts) === today);
const todayCost   = todayRecs.reduce((s, r) => s + r.usage.cost, 0);
const todayTokens = todayRecs.reduce((s, r) => s + r.usage.input + r.usage.output, 0);

console.log(`\n📊  LLM Cost Report — ${today}`);
console.log(SEP);
console.log(`Today   ${usd(todayCost).padStart(9)}  (${todayRecs.length} runs, ${todayTokens.toLocaleString()} tokens)`);

// ── Last 7 days ─────────────────────────────────────────────────────────────
const byDay: Record<string, number> = {};
for (const r of records) {
	const d = toDate(r.ts);
	byDay[d] = (byDay[d] ?? 0) + r.usage.cost;
}
const last7 = Object.entries(byDay)
	.sort((a, b) => b[0].localeCompare(a[0]))
	.slice(0, 7);

if (last7.length > 0) {
	const maxDay = Math.max(...last7.map(([, c]) => c));
	console.log(`\nLast 7 days:`);
	for (const [date, cost] of last7) {
		console.log(`  ${date}  ${usd(cost).padStart(8)}  ${bar(cost, maxDay)}`);
	}
}

// ── All-time by model ────────────────────────────────────────────────────────
const byModel: Record<string, { cost: number; runs: number }> = {};
for (const r of records) {
	const m = byModel[r.model] ??= { cost: 0, runs: 0 };
	m.cost += r.usage.cost;
	m.runs++;
}
console.log(`\nAll-time by model:`);
for (const [model, s] of Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost)) {
	console.log(`  ${model.padEnd(46)} ${usd(s.cost).padStart(8)}  (${s.runs} runs)`);
}

// ── Today by agent ───────────────────────────────────────────────────────────
if (todayRecs.length > 0) {
	const byAgent: Record<string, number> = {};
	for (const r of todayRecs) byAgent[r.agent] = (byAgent[r.agent] ?? 0) + r.usage.cost;
	console.log(`\nToday by agent:`);
	for (const [agent, cost] of Object.entries(byAgent).sort((a, b) => b - a)) {
		console.log(`  ${agent.padEnd(22)} ${usd(cost)}`);
	}
}

// ── Monthly summary ──────────────────────────────────────────────────────────
const byMonth: Record<string, number> = {};
for (const r of records) {
	const m = toMonth(r.ts);
	byMonth[m] = (byMonth[m] ?? 0) + r.usage.cost;
}
const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
if (months.length > 0) {
	console.log(`\nMonthly summary:`);
	for (const [month, cost] of months) {
		console.log(`  ${month}   ${usd(cost).padStart(9)}`);
	}
}

// ── Cumulative ───────────────────────────────────────────────────────────────
const totalCost   = records.reduce((s, r) => s + r.usage.cost, 0);
const totalTokens = records.reduce((s, r) => s + r.usage.input + r.usage.output, 0);
console.log(`\n${SEP}`);
console.log(`Cumulative total   ${usd(totalCost).padStart(9)}  across ${records.length} runs, ${totalTokens.toLocaleString()} tokens`);
console.log(`${SEP}\n`);
