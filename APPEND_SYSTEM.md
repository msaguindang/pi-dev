## Prompt Routing

Classify every prompt before acting. Default to DIRECT — only escalate when the task genuinely demands it.

**DIRECT** — respond inline, no agents.
- Conversational, questions, explanations, quick edits, lookups

**DELEGATE** — single agent, one call.
- Single-domain task with clear scope and defined output
- Pick the best-fit agent, /run it

**CHAIN** — multi-agent pipeline.
- Multi-step, cross-domain, implementation + verification, or anything requiring recon before action
- Load skill: pi-subagents, then compose the appropriate pipeline

Cost rules:
- Never chain when one agent suffices
- Never delegate when direct suffices
- When in doubt, go simpler
