# Task: TP-004 - Verify System

**Created:** 2026-05-05
**Size:** S

## Review Level: 0 (None)

**Assessment:** Trivial verification task with no code changes.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Canonical Task Folder

```
/home/codeweaver/.pi/agent/taskplane-tasks/TP-004-verify-system/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Verify that the Pi harness and Taskplane orchestration engine are correctly configured and healthy following the transition to the automated DAG-based workflow.

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

## Environment

- **Workspace:** /home/codeweaver/.pi/agent/
- **Services required:** None

## File Scope

- `.pi/telemetry/*`

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: System Health Check

- [ ] Run `pi doctor` and verify all checks pass
- [ ] Run `taskplane doctor` and verify all checks pass
- [ ] Check `.pi/telemetry/` for any critical errors in recent logs

**Artifacts:**
- None

### Step 2: Testing & Verification

- [ ] Verify that at least one example task is recognized by `/orch-plan all`
- [ ] Verify the dashboard can be launched via `taskplane dashboard --check-only` (if supported)

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `taskplane-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All health checks pass
- [ ] No critical errors found in telemetry
- [ ] Orchestrator successfully plans the batch

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(TP-004): complete Step N — description`
- **Bug fixes:** `fix(TP-004): description`
- **Tests:** `test(TP-004): description`
- **Hydration:** `hydrate: TP-004 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)
