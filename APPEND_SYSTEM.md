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
