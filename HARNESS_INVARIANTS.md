# Harness Invariants

The contract for "the pi harness is working as expected." Each invariant is an
assertion + how to check it. Run `./harness-audit.sh` to verify all programmatically.

> **Meta-rule (the gotcha that keeps biting):** a fix is not live until the session
> is **reloaded**. Committed ≠ running. After any harness change, start a fresh /
> reloaded session before trusting behavior or re-auditing.

> **Per-agent override rule:** `settings.json` `defaultThinkingLevel` is the GLOBAL
> default only. A per-agent `thinking:` pin in `agents/*.md` frontmatter **overrides**
> it. Lowering the global does NOT touch pinned agents. Audit the pins, not the global.

## Model routing

| Role | Model | Thinking | Rationale |
|------|-------|----------|-----------|
| orchestrator (`settings.json`) | `anthropic/claude-haiku-4-5` | `low` | cheap, cached, reliable dispatch |
| `worker` | `anthropic/claude-sonnet-4-6` | **`medium`** | executor — planner already reasoned; high over-anchors + burns 2–5x tokens |
| `tui-worker` | `anthropic/claude-sonnet-4-6` | **`medium`** | executor (same as worker) |
| `planner` | `anthropic/claude-sonnet-4-6` | `high` | reasoning role — thinking belongs here |
| `session-auditor` | `minimax/MiniMax-M3` | `high` | cheap-tier bulk audit |
| `linux-doctor` | `google/gemini-3.1-pro-preview-customtools` | inherit (`low`) | diagnostics |

- **INV-1** orchestrator pinned `defaultProvider=anthropic`, `defaultModel=claude-haiku-4-5`, `defaultThinkingLevel=low`. Check: `grep settings.json`.
- **INV-2** `worker` + `tui-worker` are `thinking: medium` (NOT high). Check: frontmatter grep.
- **INV-3** `planner` is `thinking: high`. Check: frontmatter grep.
- **INV-4** every agent's `model:` matches the table (no `openai-codex`/`gpt-5.5`/dropped providers). Check: frontmatter grep.

## Delegation behavior

- **INV-5** No agent instructs a subagent to **block on a supervisor** — no "wait for the reply" / "stay alive to receive the reply". Subagents are autonomous by default and **return** genuinely-blocking decisions in their result (options + recommendation). Check: `grep -ri "wait for the reply\|stay alive to receive" agents/` returns only negative guards ("NEVER wait...").
- **INV-6** `contact_supervisor`/`intercom` are non-blocking progress only, never a gate. (It times out ~10 min against a fire-and-forget orchestrator — proven failure mode.)
- **INV-7** Providers are utilized, none idle by design: anthropic (orchestrator + worker/planner/tui-worker), google (linux-doctor), minimax (session-auditor).

## Cost observability

- **INV-8** `cost-tracker.ts` footer aggregates subagent cost via `parentSessionId` (subagents run as separate processes with their own sessionId — the OLD filter on `sessionId` matched 0 and under-reported ~3x). Check: `grep parentSessionId extensions/cost-tracker.ts`.
- **INV-9** Footer total must match the **raw ground truth**: sum of `.message.usage.cost.total` across the parent `session.jsonl` + every subagent `*/run-*/session.jsonl`. Validate once per fresh session; reconcile periodically (session-auditor task). Do not trust the footer blind.

## Process discipline

- **INV-10** Review-as-default-gate: mutating / irreversible / destructive work (edits, deploys, device imaging) is reviewed against an acceptance spec **before** the irreversible step — not on user request. Review without a spec is theater; review checks a manifest (see `PRODUCTION_READY_MANIFEST.md` for the device case).
- **INV-11** Verify outcomes, not operations: tool exit 0 ≠ task success. Inspect the produced artifact against its acceptance criteria; report verified-vs-assumed, never present mechanical success as semantic success.
