---
name: session-clock-out
description: |
  Save session state before leaving. Use when user says "save state", "I'm done for now", "wrap up", "clock out", or "log off".
---

# Session Clock Out (The Handoff)

Captures current project state so the user can wipe the chat context (`/clear`) or safely walk away, enabling seamless resumption later.

## Trigger Phrases
- "save state"
- "I'm done for now"
- "wrap up"
- "clock out"
- "log off"

## Workflow

### 1. Extract Current State
Analyze the current conversation and active directory to determine:
- **Project Slug**: Derive from the active directory (e.g., `/data/dev/work/ntv/player-ui` → `ntv-player-ui`).
- **Active Directory**: The current working path.
- **Goal**: What are we trying to accomplish?
- **In Progress**: What exactly is half-finished right now? (e.g., "Edited auth.ts, tests failing on line 42").
- **Next Step**: What should the agent do the moment the user returns?

### 2. Write the Handoff File (With Timestamp)
Create or overwrite `~/.agents/state/handoffs/{slug}.md`. 
**CRITICAL:** Ensure the current timestamp is embedded directly in the file so the user knows exactly when the state was saved.

```markdown
---
clock_out_time: "YYYY-MM-DD HH:MM:SS"
project_slug: "{slug}"
---
# State Handoff

- **Goal:** [1 sentence]
- **In Progress:** [Specific details of half-finished work]
- **Next Step:** [Exact next action]
- **Context Details:**
  - Active Directory: [path]
  - Key Files: [list of files currently being modified]
```

### 3. Update External Tools (Optional)
If tasks were completed during this session, use the `ticktick` skill to check them off. If blockers were encountered, append them to the Obsidian Daily Work log using the `obsidian` skill.

### 4. Brief the User
Reply conversationally confirming the state was saved, referencing the timestamp.
**Example:** *"State saved for `ntv-api` at 6:00 PM. I've noted that we are stuck on line 42 of `auth.ts`. Feel free to type `/clear` or close the instance. Have a good evening!"*
