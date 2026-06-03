---
name: delegate-pipeline
description: "Use this skill when a task requires multi-agent delegation: design, implementation, and review."
---

Use for non-trivial tasks: multi-file edits, new features, refactors, extension authoring, anything taking more than 2 minutes inline. Skip for quick lookups, single-line fixes, DIRECT-tier responses.

## Pipeline

```
Phase 1 — Planner
  Model: gemini-3.5-flash
  Task:  Produce a step-by-step plan with exact file paths and verification commands.
         No code. Only the roadmap.
  Gate:  Plan approved by user before proceeding.

Phase 2 — Reviewer (Pre-flight)
  Model: gemini-3.5-flash
  Task:  Review the plan for spec violations, missing edge cases, incorrect assumptions.
         Output: APPROVED or list of BLOCKERS.
  Gate:  No blockers before proceeding.

Phase 3 — Worker
  Model: claude-sonnet-4-6 (via PromptRouter upgrade)
  Task:  Execute the plan exactly. One commit per logical unit. Self-review before committing.
  Gate:  All tasks committed and clean.

Phase 4 — QA (Two-stage)
  Model: gemini-3.5-flash
  Stage A — Spec compliance: Does the implementation match the plan?
  Stage B — Code quality: Correctness, error handling, style adherence.
  Gate:  Both stages pass before marking done.
```

## Tool Invocations

Each phase maps to a `subagent()` call. Use chain form only when automatic context handoff between steps is required (see note at end).

**Phase 1 — Dispatch Planner**

```js
subagent({
  agent: "worker",
  task: "You are a Planner. Produce a step-by-step implementation plan for the following task. Include exact file paths, the change required at each file, and a verification command per step. Output the plan only — no code.\n\nTask: Refactor the PromptRouter extension to support wildcard keyword matching. Scope: ~/.pi/agent/extensions/prompt-router.ts"
})
```

**Phase 2 — Dispatch Reviewer (pre-flight), passing Phase 1 output**

```js
subagent({
  agent: "worker",
  task: "You are a pre-flight Reviewer. Review the plan below for spec violations, missing edge cases, or incorrect assumptions. Output APPROVED or a numbered list of BLOCKERS.\n\nPlan:\n<paste Phase 1 output verbatim here>"
})
```

**Phase 3 — Dispatch Worker with approved plan**

```js
subagent({
  agent: "worker",
  task: "Execute the following implementation plan exactly. One commit per logical unit. Self-review before each commit. Do not summarize — implement.\n\nPlan:\n<paste approved plan verbatim here>"
})
```

**Phase 4 — Dispatch QA (two-stage), passing plan + diff**

```js
// Stage A — spec compliance
subagent({
  agent: "worker",
  task: "You are QA Stage A. Compare the implementation diff against the original plan. Does every planned step appear in the diff? Output PASS or a numbered list of MISMATCHES.\n\nPlan:\n<paste plan>\n\nDiff:\n<paste git diff output>"
})

// Stage B — code quality (only after Stage A passes)
subagent({
  agent: "worker",
  task: "You are QA Stage B. Review the diff for correctness, error handling, and adherence to code style standards. Output PASS or a numbered list of FAILURES.\n\nDiff:\n<paste git diff output>"
})
```

**When to use `subagent()` chain form instead**

Use `subagent({ chain: [...] })` (requires loading `pi-subagents` skill first) when:
- The pipeline needs automatic `context.md` / `plan.md` handoff written to disk between steps
- A step requires `oracle` drift protection or `contact_supervisor` escalation mid-chain
- The full pipeline should run unattended in the background without manual relay of outputs

For interactive, supervised pipelines where you relay outputs between phases yourself, `subagent()` at each phase is sufficient and cheaper.

## Orchestrator rules

- Pass the full plan doc to Worker. Do not summarize.
- Pass the plan + diff to QA. Do not summarize.
- If QA fails: route back to Worker with specific failure reason. Re-review after fix.
- Never mark a task complete until QA Stage B passes.
- Never write code as the orchestrator — always delegate to Worker.
