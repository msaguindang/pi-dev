---
name: work-log-writer
description: |
  Creates or updates today's daily work log in the Obsidian vault. Reads structured handoff data as primary input when invoked from clock-out, then supplements with conversation synthesis. Use when user says "write my work log", "log today's work", "create a work log", "update my work log", or when triggered automatically by session-clock-out. Also supports standalone invocation (e.g., scheduled at day start to CREATE the log before the first session).
---

# Work Log Writer Skill

Creates or updates the daily work log in the Obsidian vault. When invoked by `session-clock-out`, reads structured handoff data as primary input. When invoked standalone, synthesizes from conversation or creates an empty seeded template.

## Core Rules

- **Native filesystem only** — no MCP, no external CLI. Use `read`, `write`, `edit`, `glob`, `bash` directly on vault files.
- **Hard Tab (`\t`) indentation** for all sub-items in lists. Never spaces.
- **Vault path**: `~/Dropbox/Obsidian` (Linux) or `/mnt/c/Users/<Username>/Dropbox/Obsidian` (WSL). Run `ls ~/Dropbox/Obsidian` first if path uncertain.
- **Atomic section discipline**: each section has one semantic concern. Never mix content between sections.

---

## Template Structure Reference

```
## Carried Over     ← unchecked My Focus items from previous log (auto-populated on CREATE)
## My Focus         ← today's planned tasks and completed work (checkboxes)
## Blockers         ← anything blocking progress
## Dev Log          ← end-of-day prose narrative for non-technical manager
[## MWF Realignment Meeting]  ← Mon/Wed/Fri only
## Team Updates     ← owned by discord-eod-fetcher, never modify
```

---

## Step-by-Step Workflow

### Step 0 — Read Handoff Data (if invoked by clock-out)

**Only perform this step when invoked by `session-clock-out`.** Skip if invoked standalone.

Read `~/.agents/state/handoffs/{slug}.md` (just written by clock-out — guaranteed current). Extract:

- `# Accomplishments` → `handoff_accomplishments[]`
- `# In-Progress Items` → `handoff_in_progress[]`
- `# Immediate Next Step` → `handoff_next_step`
- `# Blockers / Notes` → `handoff_blockers`
- `project_slug` from frontmatter

These are the **primary structured input** for Steps 6 and beyond. Conversation supplements; handoff leads.

### Step 1 — Determine Today

Run `date '+%Y-%m-%d %H:%M %A'` via bash. Extract:
- `YYYY-MM-DD` → filename + frontmatter `created`/`updated`
- `HH:MM` → time portion of frontmatter
- Full day name → MWF check (Monday, Wednesday, Friday = include meeting section)
- `MMM DD, YYYY` → H1 title (e.g., `Apr 27, 2026`)

### Step 2 — Check for Existing Log

Target: `<VaultPath>/2. Areas/01 Work/01 Operations/Work Logs/YYYY-MM-DD - Work Log.md`

- **Exists** → `read` it → go to Step 5 (UPDATE mode)
- **Not found** → go to Step 3 (CREATE mode)

### Step 3 — Create from Template (CREATE mode)

Read: `<VaultPath>/z. System/Templates/Work Log.md`

Substitute all variables before writing:

| Variable | Replace with |
|---|---|
| `{{created}}` | `YYYY-MM-DDTHH:mm` (e.g., `2026-04-27T09:00`) |
| `{{updated}}` | Same as `{{created}}` on initial creation |
| `{{date:MMM DD, YYYY}}` | e.g., `Apr 27, 2026` |
| `{{mwf_meeting}}` | See Step 4 |

Write substituted content to the target path.

### Step 4 — MWF Section

**Monday, Wednesday, or Friday** → replace `{{mwf_meeting}}` with:
```
## MWF Realignment Meeting
- [ ] Meeting occurred
- **Discussed**:
- **Action Items**:

```
**Any other day** → replace `{{mwf_meeting}}` with empty string (no section, no blank line).

### Step 5 — Auto-populate Carried Over (CREATE mode only)

On new log creation, find the most recent previous work log:
1. Glob `<VaultPath>/2. Areas/01 Work/01 Operations/Work Logs/*.md`
2. Sort by filename (date-prefixed, lexicographic = chronological)
3. Take the last file before today's date
4. Read it, extract all lines matching `- [ ] ` from `## My Focus` section only
5. Write those lines into `## Carried Over` of the new log

If no previous log or no unchecked items → leave `## Carried Over` with a single `- ` placeholder.

**Pull from `## My Focus` only** — not from `## Carried Over`. Do not cascade stale items indefinitely.

### Step 6 — Synthesize Content

#### Determine conversation scope

If a `--- CLOCK IN:` boundary marker is present in the conversation, synthesize only from content after the most recent marker. This prevents Day 1/Day 2 bleed when a session spans overnight.

#### My Focus (checkboxes)

**CREATE mode — seed from handoff, supplement from conversation:**

1. First item: `handoff_next_step` from handoff (this is the primary next action)
2. Subsequent items: `handoff_in_progress[]` items — format as `- [ ] Continue: [description]`
3. Supplement: any additional tasks surfaced in conversation not already covered
4. Format: `- [ ] <concise action-oriented phrase>`
5. Replace the blank `- [ ] ` placeholder

**UPDATE mode — check off accomplishments, add new items:**

1. For each item in `handoff_accomplishments[]`: find matching `- [ ]` line in `## My Focus` and mark it `- [x]`
   - Match on substance, not exact wording — use judgment
2. Add new `- [ ]` items for `handoff_in_progress[]` items not already present
3. Never remove existing items (checked or unchecked)

**Standalone invocation** (no handoff data): derive My Focus from conversation if available. If no conversation context, leave placeholder.

#### Dev Log (prose)

Write 3–5 sentences in plain English for a non-technical manager.

Synthesize from conversation (scoped to post-CLOCK IN marker if present). Reference `handoff_accomplishments[]` for accuracy.

**Translation rules:**

| Technical | Plain |
|---|---|
| refactored X | cleaned up / improved X |
| socket event | real-time message |
| pm2 | the service that keeps the app running |
| git worktree | isolated code workspace |
| SKILL.md / frontmatter / YAML | skill config / file metadata |
| compiled / built | prepared for deployment |
| deployed | pushed live / sent to the device |
| MCP server | integration tool |
| electron | desktop app wrapper |
| CI/CD pipeline | automated build-and-deploy process |

- Preserve proper nouns: Player V2, NTV, Arjay, Leigh, Adrian, Rico, TechMagic
- Flowing prose, not bullets
- Vary sentence starts — not every sentence beginning with "Today"
- **UPDATE mode**: read existing Dev Log first — append new content only for topics not already covered

#### Blockers

**CREATE mode**: write `handoff_blockers` into `## Blockers` if non-empty. Otherwise leave placeholder.

**UPDATE mode**: merge `handoff_blockers` into existing `## Blockers`. Do not duplicate entries already present.

If no blockers in handoff and section already has content: leave as-is.

### Step 7 — Update `updated` Frontmatter

On every write (create or update), replace the `updated` field value with the current `YYYY-MM-DDTHH:mm`.

### Step 8 — Do Not Touch Team Updates

`## Team Updates` and all subordinate `### Name` sections are owned by the `discord-eod-fetcher` skill. **Never overwrite or modify them.**

### Step 9 — Confirm to User

Report:
- Created or updated
- Exact vault path written
- One-sentence summary of what was written in Dev Log

---

## Standalone Invocation (Cron / Day Start)

When invoked without a clock-out handoff (e.g., scheduled at 5am to seed the day):

1. Skip Step 0 (no handoff to read)
2. Always CREATE mode (no session has started yet)
3. My Focus: seeded from Carried Over only (no handoff next step available)
4. Dev Log: leave empty placeholder
5. Blockers: leave empty placeholder

This ensures the work log template exists and is seeded with carry-overs before the first session of the day. All subsequent clock-outs use UPDATE mode.

---

## Discord EOD Template (for reference)

The team sends daily updates in a Discord Forum thread named by date. Each member posts:

```
**Done**
- [what was completed]

**Tomorrow**
- [what's planned next]

**Blockers**
- none (or describe the blocker)
```

Members working on multiple projects (e.g., Leigh) use bold project headers:
```
**[Pulse]**
Done:
-
Tomorrow:
-
Blockers: none
```

The `discord-eod-fetcher` skill pulls these into `## Team Updates` automatically.
