---
name: research-with-persistence
description: Wraps the researcher agent and persists its output to `/tmp/pi-research/<slug>.md`. Use when you need a durable, file-based record of research results for downstream subagent handoff.
---

# research-with-persistence

A wrapper skill that automates artifact persistence for research results, ensuring the output of a research task is available to subsequent delegated subagents via the filesystem.

## When to use this skill
- You are about to dispatch a `researcher` subagent whose output must be referenced by a later subagent.
- You want a durable, deterministic record of research results in `/tmp/pi-research/`.
- You want to avoid passing the full research artifact inline in a delegation task prompt.

## Workflow: Persist Research Output

1.  **Dispatch the Researcher**: Invoke the `researcher` subagent with your research query.
2.  **Define a Slug**: Derive a kebab-case slug from the research topic (e.g., `plane-api-auth`, `ntv-player-server-onboarding`).
3.  **Persist Output**: Once the researcher returns, write its final output verbatim to `/tmp/pi-research/<slug>.md`. Create the directory if it does not exist.
4.  **Reference in Downstream Tasks**: In the next delegation, pass the file path in the task prompt so the downstream subagent can read it.

### Resulting structure

```bash
/tmp/pi-research/
  plane-api-auth.md
  ntv-player-server-onboarding.md
  <topic-slug>.md
```

### Idempotency

Re-running the skill for the same slug will overwrite the existing file, ensuring the latest research takes precedence.

## Script: `scripts/persist.sh`

If desired, a small helper script can automate the write step. An example implementation lives at `scripts/persist.sh` and accepts the slug and the file path containing the research output:

```bash
~/.pi/agent/skills/research-with-persistence/scripts/persist.sh "plane-api-auth" /path/to/research_output.md
```

The script will copy the file contents into `/tmp/pi-research/<slug>.md`.
