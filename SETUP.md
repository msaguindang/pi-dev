# Pi Agent Setup — NTV360 Adjutant / Foundry

Portable Pi coding agent for the NTV360 team. Two repos required — one generic (this), one personal.

## Prerequisites
- Node.js 18+
- Pi CLI: `npm install -g @earendil-works/pi-coding-agent`
- Git

## Setup (New Machine)

### 1. Clone this repo
```bash
git clone <your-dot-pi-repo-url> ~/.pi/agent
```

### 2. Create your personal context vault
```bash
git clone <your-dot-agents-ntv-repo-url> ~/.agents
# or fork it and replace context/ with your own
```

### 3. Authenticate
```bash
pi auth login
```

### 4. Verify
```bash
pi --version
pi "hello"
```

## Structure

```
~/.pi/agent/                    ← this repo (generic, shareable)
├── AGENTS.md                   # bridges into ~/.agents via @-includes
├── APPEND_SYSTEM.md            # prompt routing classifier (generic)
├── SETUP.md                    # this file
├── settings.json               # packages, model config, themes
├── agents/                     # personal agents (gitignored — add your own)
├── extensions/
│   ├── first-run.ts            # onboarding wizard
│   ├── guardrails.ts           # safety rules
│   └── memory-inject.ts        # injects lessons from ~/.agents/state/lessons.jsonl
└── themes/                     # 11 themes

~/.agents/                      ← personal vault (your own repo)
├── context/
│   ├── identity.md             # who you are, communication style, behavioral rules
│   ├── environment.md          # machine paths, aliases, active technologies
│   └── long-term.md            # domain knowledge, project state, decision log
├── skills/                     # personal + shared skills (pi + other harnesses)
└── standards/                  # code conventions
```

## Agents

### Package agents (npm:pi-subagents) — included automatically
| Agent | Role |
|---|---|
| `scout` | Fast codebase recon |
| `context-builder` | Deep analysis + meta-prompt for planning |
| `oracle` | Decision-consistency, drift protection |
| `planner` | Implementation planning |
| `researcher` | Web research + doc lookup |
| `reviewer` | Code, plan, and PR review |
| `worker` | Implementation with supervisor escalation |
| `delegate` | Lightweight, inherits parent model |

### Personal agents — add to `agents/` (gitignored)
Create `~/.pi/agent/agents/<name>.md` for domain-specific agents.
Examples from this setup: `devops.md` (RPi/infra), `qa.md` (spec + bug hunt), `admin.md` (writing + vault ops).

## Customization
- `~/.agents/context/identity.md` — your role, communication style, behavioral rules
- `~/.agents/context/environment.md` — your machine paths, aliases, tools
- `~/.agents/context/long-term.md` — domain knowledge, project context
- `~/.pi/agent/agents/` — your personal agents (gitignored, won't affect others)

## Sensitive Files (Never Commit)
- `~/.pi/agent/auth.json` — API credentials
- `~/.pi/agent/agents/*.md` — personal agents (gitignored by default)
