# Pi Agent Setup

Portable Pi coding agent setup. Two repos required.

## Prerequisites
- Node.js 18+
- Pi CLI: `npm install -g @mariozechner/pi`
- Git

## Setup (New Machine)

### 1. Clone agent context vault
```bash
git clone <agents-repo-url> ~/.agents
```

### 2. Clone Pi agent config
```bash
git clone <pi-agent-repo-url> ~/.pi/agent
```

### 3. Authenticate
```bash
pi auth login
```

### 4. Verify
```bash
pi --version
pi "hello"   # should respond in caveman mode
```

## Structure

```
~/.pi/agent/
├── AGENTS.md          # identity — reads from ~/.agents via @-includes
├── APPEND_SYSTEM.md   # behavioral rules + caveman mode
├── SETUP.md           # this file
├── settings.json      # packages, model config, themes
└── agents/
    ├── researcher.md  # web research + doc lookup
    ├── my-coder.md    # implementation tasks
    └── admin.md       # writing + admin tasks
```

## Customization for New Users
- Update `~/.agents/context/identity.md` with your own role and principles
- Update `~/.agents/context/environment.md` with your machine paths and aliases
- Update `~/.agents/context/long-term.md` with your domain/project knowledge
- Keep `~/.pi/agent/` unchanged — it's generic

## Sensitive Files (Never Commit)
- `~/.pi/agent/auth.json` — API credentials, excluded via `.gitignore`
