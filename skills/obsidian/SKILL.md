---
name: obsidian
description: "Read and write notes in the Obsidian vault at ~/Dropbox/Obsidian"
---
# Obsidian Skill

## Vault Location
`~/Dropbox/Obsidian/`

## Structure (PARA)
```
Obsidian/
├── 1. Projects/
├── 2. Areas/
│   └── 01 Work/
│       └── 01 Operations/
│           └── Work Logs/       ← daily work logs: YYYY-MM-DD - Work Log.md
├── 3. Resources/
├── 4. Archives/
└── System/
    └── AGENTS.md               ← naming conventions and templates
```

## Operations
- **Read note:** `cat "~/Dropbox/Obsidian/<path>"`
- **Write note:** Write file directly to vault path
- **List notes:** `find ~/Dropbox/Obsidian -name "*.md" | sort`
- **Search content:** `grep -r "term" ~/Dropbox/Obsidian/`

## Daily Work Log
File: `2. Areas/01 Work/01 Operations/Work Logs/YYYY-MM-DD - Work Log.md`
Sections: `## My Focus` (checkboxes), `## Notes`, `## Blockers`
