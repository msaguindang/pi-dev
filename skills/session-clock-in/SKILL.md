---
name: session-clock-in
description: |
  Resume work from a previous session. Use when user says "start my day", "let's continue", "I'm back", "brief me", or provides a morning brain dump.
---

# Session Clock In (The Morning Briefing)

Restores state seamlessly from handoff files so the user doesn't have to explain where they left off.

## Trigger Phrases
- "start my day"
- "let's continue"
- "I'm back"
- "brief me"
- "where were we?"
- "pick up where last left off"
- "what did i do yesterday?"
- *Any natural language morning brain dump* (e.g., "Morning. Let's fix the API bug and add 'buy groceries' to TickTick.")

## Workflow

### 1. Process the Brain Dump (If Any)
If the user provides unstructured tasks in their opening message:
- Automatically route actionable tasks to **TickTick** (using the `ticktick` skill).
- Route blockers/notes to **Obsidian** (via the `work-log-writer` or `obsidian` skill).

### 2. The 3-Pronged Context Check
When the user asks where they left off or what they did, you MUST check three sources to build a complete picture:
1. **Handoffs:** Check `~/.agents/state/handoffs/` for existing `*.md` files. This tells you the exact technical state of active projects.
2. **TickTick:** Use the `ticktick` skill to list active/overdue tasks. This tells you what actionable items are pending.
3. **Obsidian (Yesterday's Log):** Use the `obsidian` skill to read yesterday's daily work log (e.g., `~/Dropbox/Obsidian/2. Areas/01 Work/01 Operations/Work Logs/YYYY-MM-DD - Work Log.md`). This answers "what did I do yesterday?" and highlights any blockers.

### 3. Context Loading
Once the user confirms which project to tackle, use the `pi-knowledge-search` skill to fetch any necessary atomic context (do NOT dump the entire vault into the chat). Set your internal working directory to match the handoff's `Active Directory`.

### 4. The Briefing
Reply conversationally. 
- Do not print rigid markdown forms. 
- Synthesize what you routed (from the brain dump) and summarize the handoff state.
- **Example:** *"Good morning! I've added 'buy groceries' to TickTick. I see we have a saved state for `ntv-api` from yesterday at 6:00 PM. We left off fixing the token refresh race condition, with tests failing on line 42. Shall I pull up `auth.ts` and propose a fix?"*

### 5. Archive Handoff
Once the briefing is delivered and work resumes, move the handoff file to `~/.agents/state/archive/YYYY-MM-DD-HHMM-{slug}.md` so it doesn't clutter the active folder.
