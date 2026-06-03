## Prompt Routing

Classify every prompt before acting. Default to DIRECT — only escalate when the task genuinely demands it.

**DIRECT** — respond inline, no agents.
- Conversational, questions, explanations, quick edits, lookups

**DELEGATE** — single agent or parallel agents, use `subagent()` tool.
- Single-agent: `subagent({ agent, task })`
- Parallel: `subagent({ tasks: [{ agent, task }, { agent, task }] })`
- Pattern for recon-then-write: parallel scouts first, collect results, then `subagent({ agent: 'worker', task })`

**CHAIN** — multi-agent pipeline, use `subagent()` tool.
- Multi-step workflows requiring context.md / plan.md handoffs between steps
- Tasks needing `oracle` drift protection or `contact_supervisor` escalation
- Load skill: pi-subagents, then compose the pipeline with `subagent({ chain: [...] })`

Cost rules:
- Never chain when one agent suffices
- Never delegate when direct suffices
- When in doubt, go simpler
- Code changes always go to `worker` — never write code inline as orchestrator

## Pre-Fix Diagnostic Gate

Before dispatching any fix or code change, explicitly answer:
1. **What is the verified root cause?** (not an assumption — cite the doc, source, log, or runtime check that confirms it)
2. **What is the one targeted change that addresses only that cause?**

If a fix fails once: **stop**. Do not vary the same fix. Step up one abstraction level, re-verify the cause from scratch, then fix again.

For toolchain / infra problems: **probe the environment first** — inventory what is installed, what versions, what the compositor/OS/runtime supports — before proposing any solution.

Skip this gate only for DIRECT responses (no code, no delegation).

## TUI Rendering (pi sessions only)

Override standard markdown for pi terminal output:
- Unordered lists: use `•` instead of `-`
- Numbered lists: use `**1.** ` instead of `1. ` (prevents renderer collapsing)
- Leave blank line between every list item

This bypasses pi TUI's markdown list collapsing behavior. Does not apply to Claude Code sessions.

## Agent Notes

`researcher` agent requires `pi-web-access` package for `web_search`. Package is NOT currently installed — only `pi-agent-core`, `pi-ai`, `pi-coding-agent` present under `@earendil-works`. When dispatching research tasks: `web_fetch` with direct URLs and `bash`/`curl` are valid fallbacks. Researcher agent is configured to auto-fall back; no special orchestrator handling needed.

## Domain Context

For NTV ecosystem, harness decisions, extension patterns, hyprland, or wezterm specifics — invoke `pi-knowledge-search` before acting. This context is NOT auto-loaded. Assume it is absent until retrieved.

## Boundary Awareness: pi-harness vs Repositories

**Do not conflate these three distinct things:**

| Term | What it is | Path |
|------|-----------|------|
| `pi-harness` | Harness source being developed | `~/.pi/agent` |
| `pi` | Installed CLI tool | global npm binary |
| NTV repos | Project codebases | `/data/dev/work/ntv/*` |

**Rules:**
- "Work on pi-harness" = edit files in `~/.pi/agent`. Never touch NTV repos.
- "Work on player-ui / api-v1 / dashboard-v1" = edit NTV repos. Never touch `~/.pi/agent`.
- Editing an extension (`~/.pi/agent/extensions/*.ts`) changes the harness — not the NTV product.
- If the task boundary is ambiguous, stop and ask which context applies before acting.
