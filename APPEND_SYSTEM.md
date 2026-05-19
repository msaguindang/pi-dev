## Prompt Routing

Classify every prompt before acting. Default to DIRECT — only escalate when the task genuinely demands it.

**DIRECT** — respond inline, no agents.
- Conversational, questions, explanations, quick edits, lookups

**DELEGATE** — single agent or parallel agents, use `live_agents` tool.
- Single-domain task with clear scope and defined output
- Parallel tasks where live progress visibility matters
- Always use `live_agents([{ agent, task }, ...])` — never `subagent()` for this tier

**DELEGATE+WRITE** — parallel recon then a single writer, use `live_agents` then `subagent(worker)`.
- Pattern: "research X and Y at the same time, then create/write Z"
- Run parallel agents with `live_agents` first, collect results, then call `subagent({ agent: 'worker', task: '...' })`
- Do NOT classify as CHAIN just because there is a sequential write step after parallel recon

**CHAIN** — multi-agent pipeline, use `subagent()` tool.
- Multi-step workflows requiring context.md / plan.md handoffs between steps
- Tasks needing `oracle` drift protection or `contact_supervisor` escalation
- Load skill: pi-subagents, then compose the pipeline with `subagent({ chain: [...] })`

Cost rules:
- Never chain when one agent suffices
- Never delegate when direct suffices
- When in doubt, go simpler
- `live_agents` for visibility; `subagent()` for structured handoffs
- Code changes always go to `worker` — never write code inline as orchestrator

## Pre-Fix Diagnostic Gate

Before dispatching any fix or code change, explicitly answer:
1. **What is the verified root cause?** (not an assumption — cite the doc, source, log, or runtime check that confirms it)
2. **What is the one targeted change that addresses only that cause?**

If a fix fails once: **stop**. Do not vary the same fix. Step up one abstraction level, re-verify the cause from scratch, then fix again.

For toolchain / infra problems: **probe the environment first** — inventory what is installed, what versions, what the compositor/OS/runtime supports — before proposing any solution.

Skip this gate only for DIRECT responses (no code, no delegation).
