---
name: repo-onboarder
description: Onboards a new repository into the .agents ecosystem. Reads the repo's CLAUDE.md, prepends global .agents imports if missing, extracts a controller-relevant summary and appends it to ~/.agents/context/long-term.md, then optionally cleans up redundant boilerplate from CLAUDE.md. Use this skill whenever the user wants to register a new repo, add a repo to their agent context, onboard a project into .agents, or says something like "add this repo to agents context", "register this project", "set up agents for this repo", or "sync this repo with .agents".
---

# Repo Onboarder

Connects a repository to the `.agents` controller ecosystem by wiring up global context imports, extracting a concise controller-readable summary, and optionally pruning boilerplate that the imported context already covers.

---

## Step 1: Locate the repo

Get the repo path from the user. If not provided, use the current working directory.

Then check for `CLAUDE.md` at the repo root:
- **Not found** → stop. Inform the user: "No CLAUDE.md found. Run `/init` in the repo first, then re-invoke this skill."
- **Found** → proceed.

---

## Step 2: Wire up .agents imports

Read the CLAUDE.md. Check if these four import lines are already at the very top (before any other content):

```
@~/.agents/context/identity.md
@~/.agents/context/environment.md
@~/.agents/context/long-term.md
@~/.agents/standards/code-style.md
```

If any are missing, prepend all four as a block at the top of the file, followed by a blank line. Do not reorder or remove existing content. Write the updated file.

---

## Step 3: Extract controller summary

Read `~/.agents/context/long-term.md` to understand the existing structure (v1/v2 sections, what's already registered).

Then extract a summary from CLAUDE.md using these rules:

**Always include:**
- Repo name + absolute path
- Stack/tech (one line: languages, frameworks, runtime)
- Compile targets or major architectural split (if any)
- Integration points: what APIs, services, or IPC mechanisms it talks to
- Deployment pipeline: how/where it ships (one line)
- Critical constraints: things that would break silently if a subagent ignored them (max 2-3 bullet points)

**Never include:**
- Full command lists (those stay in repo CLAUDE.md)
- Detailed code standards rules (pre-commit enforces those)
- Route flows or component trees
- Anything a subagent only needs when actively working inside the repo

**Target length:** 6–10 bullet points. If you can't cover it in 10 lines, you're extracting too much.

Show the extracted summary to the user and ask for confirmation before writing.

---

## Step 4: Append to long-term.md

After confirmation, determine the correct ecosystem section in `long-term.md`:
- If the repo clearly belongs to an existing section (v1/v2 by stack, naming, or user clarification) → append under that section
- If it belongs to a new ecosystem → create a new `## <Name> Ecosystem` heading at the end (before `## Agent Strategy`)
- If unclear → ask the user which section before writing

Append the summary as a new sub-block under the chosen section. Do not reformat existing content.

---

## Step 5: Cleanup CLAUDE.md (optional)

Scan the CLAUDE.md body (below the imports block) for sections that duplicate content already provided by the `.agents` imports. A section is a candidate for removal if it restates something already in:

- `identity.md` — general agent behavior, principles, output preferences
- `code-style.md` — commit format, branch naming, TypeScript/Bash/Python conventions, cross-platform paths
- `environment.md` — device topology, known paths, aliases

**Threshold:** Only flag a section if it's substantially covered — not just because it shares a keyword. Repo-specific overrides or additions to global standards are NOT candidates (e.g., custom lint rules, repo-specific tsconfig constraints, project-specific commit scopes).

Present each candidate as a diff-style block:

```
PROPOSED REMOVAL — duplicates code-style.md:

  ## Commit Messages
  Use conventional commits: feat, fix, chore...
  [full section text]

Remove this section? [y/n]
```

Wait for per-section confirmation before applying any changes. If the user declines all or says "skip cleanup", do nothing.

Apply confirmed removals, write the file.

---

## Step 6: Confirm and summarize

Report:
- Whether imports were added or already present
- Which section of `long-term.md` was updated
- Which CLAUDE.md sections were removed (if any)
- Any open questions (e.g., player-ui v1 Angular version — flag stale data in long-term.md if spotted)
