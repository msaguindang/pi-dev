# Pi Agent Harness

Portable configuration layer for [`pi`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) — the multi-agent coding CLI. This repo (`~/.pi/agent`) is the shareable half. Personal context lives in a separate vault (`~/.agents`).

**Model stack:** MiniMax M3 (orchestrator) + GPT-5.5 via ChatGPT subscription (all workers/reviewers).

---

## Prerequisites

- Node.js 18+
- `npm install -g @earendil-works/pi-coding-agent`
- Git
- MiniMax API key
- ChatGPT subscription (for GPT-5.5 worker access)

---

## Quick Start

### 1. Clone harness

```bash
git clone <dot-pi-repo-url> ~/.pi/agent
```

### 2. Create personal context vault

The harness loads `~/.agents/` at every session start. This directory is **not** included — it is personal. Create it from scratch or use this repo's structure as a template.

```bash
mkdir -p ~/.agents/{context,standards}
```

Required files — write these yourself:

| File | Contents |
|---|---|
| `~/.agents/context/identity.md` | Your role, team, communication style, behavioral rules |
| `~/.agents/context/environment.md` | Your device paths, shell aliases, active technologies |
| `~/.agents/context/long-term.md` | Domain knowledge, project context, decision log |
| `~/.agents/standards/code-style.md` | Your project's commit format, language conventions |

Optional but recommended:

```bash
# Copy generic standards (not personal)
cp ~/.pi/agent/standards-templates/tool-policy.md ~/.agents/standards/tool-policy.md
```

See `context-templates/` in this repo for starter files.

### 3. Set up providers

```bash
pi auth login
```

Log in to the providers you plan to use. At minimum:

- **MiniMax** — default orchestrator (`minimax/MiniMax-M3`)
- **ChatGPT** — worker/reviewer access (`openai-codex/gpt-5.5`)

To verify available models after login:

```bash
pi --list-models
```

### 4. Verify

```bash
pi --version
pi "hello"
```

---

## Repo Structure

```
~/.pi/agent/                        ← this repo (shareable)
├── AGENTS.md                       # context chain — loads ~/.agents/ files
├── APPEND_SYSTEM.md                # routing rules, pre-fix gate, TUI rendering
├── settings.json                   # model config, extensions, packages, theme
├── agents/                         # specialized sub-agents
│   ├── linux-doctor.md
│   ├── session-auditor.md
│   └── tui-worker.md
├── extensions/                     # TypeScript extensions loaded at startup
├── skills/                         # slash-command skills
└── themes/                         # custom TUI themes

~/.agents/                          ← personal vault (your own repo, not shared)
├── context/
│   ├── identity.md
│   ├── environment.md
│   └── long-term.md                # stub router → long-term-*.md atomic notes
├── standards/
│   ├── code-style.md
│   └── tool-policy.md
└── state/                          # runtime state, lessons
```

---

## Context Loading Chain

`AGENTS.md` at startup loads (in order):

```
@~/.agents/context/identity.md
@~/.agents/context/environment.md
@~/.agents/context/long-term.md
@~/.agents/standards/code-style.md
@~/.agents/standards/tool-policy.md
```

`APPEND_SYSTEM.md` appends harness-specific rules after the above (routing policy, TUI rendering overrides, agent notes, pre-fix diagnostic gate).

---

## Model Routing

Configured in two places:

| Config | Controls |
|---|---|
| `settings.json` → `defaultProvider` + `defaultModel` | Orchestrator (main session model) |
| `routing.json` → `worker.model` | All sub-agents dispatched via DELEGATE / CHAIN |

`PromptClassifier.ts` classifies every prompt as `DIRECT`, `DELEGATE`, or `CHAIN`. `PromptRouter.ts` reads `routing.json` at startup and injects the worker model into sub-agent dispatch hints:

- **DIRECT** — orchestrator responds inline, no delegation
- **DELEGATE** — notify: use `subagent({ agent, task, model: "<worker.model>" })`
- **CHAIN** — notify: use `subagent({ chain: [...], model: "<worker.model>" })`

### Changing the model stack

**1. Orchestrator** — edit `settings.json`:

```json
{
  "defaultProvider": "minimax",
  "defaultModel": "MiniMax-M3"
}
```

**2. Workers / Reviewers** — edit `routing.json`:

```json
{
  "orchestrator": { "provider": "minimax", "model": "MiniMax-M3" },
  "worker": { "provider": "openai-codex", "model": "gpt-5.5" }
}
```

`routing.json` is read once at extension startup. Change the `worker.model` value to any model ID returned by `pi --list-models`. If the file is missing, `PromptRouter.ts` falls back to `gpt-5.5`.

The `orchestrator` block in `routing.json` is documented for reference — it is not read by any extension (pi reads `settings.json` directly for the session model). Keep both in sync.

---

## Extensions

Loaded automatically at startup via `settings.json` `extensions` array.

| Extension | Purpose |
|---|---|
| `adjutant-editor.ts` | TUI editor layout config |
| `adjutant-greeting.ts` | Startup greeting with session context |
| `bash-truncator.ts` | Truncates oversized bash output to prevent context overflow |
| `context-resolver.ts` | Resolves `@`-includes in AGENTS.md at load time |
| `cost-tracker.ts` | Tracks per-turn + per-session token cost in TUI status bar |
| `extension-watcher.ts` | Detects stale extension cache, warns before long sessions |
| `first-run.ts` | One-time onboarding wizard on fresh installs |
| `gmail.ts` | Gmail API integration (requires Google OAuth) |
| `guardrails.ts` | Blocks or confirms destructive ops (SSH rm/reboot, npm publish) |
| `PromptClassifier.ts` | Classifies prompts as DIRECT / DELEGATE / CHAIN |
| `PromptRouter.ts` | Routes sub-agent dispatch hints based on classification |
| `session-name-status.ts` | Shows active session name in TUI status bar |
| `tool-cache.ts` | Caches repeated tool results within a session |
| `tui-dryrun.ts` | ANSI validation guard — blocks TUI edits without dry-run verification |

To disable an extension, prefix its entry with `-` in `settings.json`:

```json
"-extensions/gmail.ts"
```

---

## Skills

Invoke with `/skill-name` in a pi session.

### Generic (usable by anyone)

| Skill | Purpose |
|---|---|
| `delegate` | Planner → Reviewer → Worker → QA pipeline template |
| `delegation-validator` | Validates sub-agent prompts are self-contained before dispatch |
| `gmail` | Search, read, draft, send Gmail |
| `internal-comms` | Internal communication templates (status reports, incident reports) |
| `pi-knowledge-search` | Ripgrep search across `~/.agents/context/` atomic notes |
| `repo-onboarder` | Registers a new repo into the `~/.agents` context ecosystem |
| `research-with-persistence` | Researcher agent with file-based output for sub-agent handoff |
| `skill-creator` | Schema reference for building new pi skills |
| `subagents-list` | Lists all available sub-agents and their roles |
| `ticktick` | TickTick task management integration |

### NTV-specific (adapt or remove for other setups)

| Skill | Purpose |
|---|---|
| `delegation-validator` | Pre-dispatch prompt validation for NTV sub-agent pipelines |
| `discord-eod-fetcher` | Fetches EOD updates from NTV Discord into Obsidian |
| `ntv-pr-reviewer` | 6-agent parallel PR review for NTV repositories |
| `ntv-worktree-manager` | Git worktree creation across NTV mono-repo ecosystem |
| `plane-tasks` | Fetch/update Plane work items (uses Infisical for secrets) |
| `repo-onboarder` | NTV-scoped repo registration (paths hardcoded to `~/Projects/work/ntv`) |
| `rpi-deploy` | Deploy player-server/UI to Raspberry Pi via native gulp pipelines |
| `rpi-doctor` | SSH diagnostic tool for RPi fleet health checks |
| `rpi-imager` | Raspberry Pi OS imaging helper |
| `rpi5-deployer` | **Deprecated** — use `rpi-deploy` |
| `session-clock-in/out` | Work session logging to Obsidian daily notes |
| `weekly-report-*` / `work-log-writer` | NTV weekly report generation from session logs |

---

## Agents

Located in `agents/`. Invoked via `subagent({ agent: "<name>", task })`.

| Agent | Purpose | Model |
|---|---|---|
| `linux-doctor` | System-level diagnostics (OS, drivers, services) | M3 |
| `session-auditor` | Audits active session for context drift and constraint violations | GPT-5.5 |
| `tui-worker` | Specialized worker for TUI extension edits with 4-layer test loop | GPT-5.5 |

Package agents (from `npm:pi-subagents`, included automatically):

| Agent | Role |
|---|---|
| `scout` | Fast codebase recon |
| `context-builder` | Deep analysis + meta-prompt for planning |
| `oracle` | Decision-consistency, drift protection |
| `planner` | Implementation planning |
| `researcher` | Web research + doc lookup |
| `reviewer` | Code, plan, and PR review |
| `worker` | Implementation with supervisor escalation |
| `delegate` | Lightweight worker, inherits parent model |

---

## Customization

### Change the default model

Edit `settings.json`:

```json
{
  "defaultProvider": "google",
  "defaultModel": "gemini-2.5-pro"
}
```

### Add a personal agent

Create `~/.pi/agent/agents/<name>.md`:

```markdown
---
name: my-agent
description: What this agent does and when to invoke it.
model: openai-codex/gpt-5.5
thinking: high
---
# My Agent

System prompt content here.
```

### Add a skill

Create `~/.pi/agent/skills/<skill-name>/SKILL.md`:

```markdown
---
name: skill-name
description: One-line description used for auto-triggering.
---

# Skill Title

Skill instructions here.
```

Run `/skill-creator` for the full schema and validation guide.

### Change theme

```bash
pi theme set tokyonight   # or: dracula, nord, gruvbox, rose-pine, etc.
```

Or edit `settings.json` → `"theme"`.

---

## What NOT to Commit

Already in `.gitignore`, but worth knowing:

| Path | Reason |
|---|---|
| `auth.json` | API credentials |
| `sessions/` | Session transcripts |
| `cost-history.jsonl` | Machine-specific cost data |
| `run-history.jsonl` | Runtime artifacts |
| `usage-data/` | Pi-insights reports |
| `logs/` | Debug logs |
| `intercom/` | IPC mailboxes |

Your personal `~/.agents/` vault is a separate repo — never accidentally commit it here.

---

## Updating

```bash
cd ~/.pi/agent
git pull
```

Extension changes take effect on next `pi` session start.
