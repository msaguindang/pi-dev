## Prompt Routing

Classify every prompt before acting. Default to DIRECT — only escalate when the task genuinely demands it.

**DIRECT** — respond inline, no agents.
- Conversational, questions, explanations, quick edits, lookups

**DELEGATE** — single agent or parallel agents, use `subagent()` tool.
- Single-agent: `subagent({ agent, task })`
- Parallel: `subagent({ tasks: [{ agent, task }, { agent, task }] })`
- Pattern for recon-then-write: parallel scouts first, collect results, then `subagent({ agent: 'worker', task })`

**Delegation vs. mention syntax:**
- `@agent-name` in a user message = context reference or question about that agent — do NOT auto-dispatch
- `subagent({ agent, task })` = explicit dispatch — only use when user intent to delegate is unambiguous
- When intent is unclear, ask before dispatching

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

## Post-Mutation Review Gate

After any `worker` dispatch that MUTATES state (file edits, deploys, destructive / device ops, config or schema changes), you MUST dispatch `reviewer` BEFORE reporting the task done — without being asked.

- **Scope:** the gate FIRES for mutating / irreversible / destructive work. SKIP it for read-only work (scouts, lookups, analysis) and trivial single-line doc/comment edits.
- **Contract required:** pass the `reviewer` the acceptance criteria — a manifest file path (e.g. `PRODUCTION_READY_MANIFEST.md`, `standards/code-style.md`) AND the diff/artifact to check. If no standing manifest exists, enumerate the acceptance criteria inline. Never dispatch a bare "review this" — a contextless review is theater and let a dirty artifact ship before.
- **Decision owner:** you (the orchestrator) decide scope at dispatch time — you know whether you are dispatching a mutation. The worker's `Mutated/Risk` line is confirmation, not the trigger.
- **On FAIL/BLOCKER:** route the specific items back to `worker`, then re-review. Never report a mutating task done until `reviewer` returns `Verdict: PASS`.
- **Verify outcomes, not operations:** "the command ran / dd exited 0" is not success. The reviewer checks the real post-state of the artifact against the manifest.

## TUI Rendering (pi sessions only)

Override standard markdown for pi terminal output:
- Unordered lists: use `•` instead of `-`
- Numbered lists: use `**1.** ` instead of `1. ` (prevents renderer collapsing)
- Leave blank line between every list item

This bypasses pi TUI's markdown list collapsing behavior. Does not apply to Claude Code sessions.

## Agent Notes

`researcher` agent uses `pi-web-access` for `web_search` — package is installed under `~/.pi/agent/npm/`. When dispatching research tasks, `web_search` is available via the researcher agent.

## Domain Context

For NTV ecosystem, harness decisions, extension patterns, hyprland, or wezterm specifics — invoke `pi-knowledge-search` before acting. This context is NOT auto-loaded. Assume it is absent until retrieved.

**NTV reviewer agents must load domain context before reviewing.** Player-UI is Angular 18 with a proprietary playback engine. Timing, zone handling, and subscription teardown are high-risk areas. Run `pi-knowledge-search` with query "ntv player-ui" before dispatching any reviewer or QA agent for NTV repos.

## Skill Invocation Rules

Load skills explicitly when the task matches — do not rely solely on auto-trigger:

- **NTV domain / harness / hyprland / wezterm questions**: invoke `pi-knowledge-search` first — context is NOT auto-loaded
- **Starting work on an NTV ticket, feature, or bug**: load `ntv-worktree-manager`
- **Plane task queries, ticket status, sprint/backlog**: load `plane-tasks`
- **Session start / morning briefing**: load `session-clock-in`
- **Session end / wrapping up / day log**: load `session-clock-out` (chains to `work-log-writer`)
- **Multi-step delegation pipeline (design → implement → review)**: load `delegate` skill
- **CHAIN tier dispatch**: load `pi-subagents` skill first

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
