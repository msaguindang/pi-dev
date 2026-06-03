---
name: pi-knowledge-search
description: "Search atomic knowledge notes in Obsidian and agent context via ripgrep to fulfill Layer 3 memory retrieval."
---
# pi-knowledge-search

A search tool for querying the user's Obsidian vault and internal agent knowledge base. 
Uses ripgrep for fast, context-aware searching across `~/Dropbox/Obsidian/` and `~/.agents/context/`.

## Usage
Invoke the `search.sh` script to find information, docs, or past notes relevant to the current task. The tool returns file paths and snippets.

```bash
~/.pi/agent/skills/pi-knowledge-search/scripts/search.sh "your search query"
```
