# Task: TP-003 — Admin Team Setup

**Created:** 2026-05-05
**Size:** M

## Review Level: 1

## Mission
Configure the Global Administrative AI Team for Pi Harness by migrating existing roles, creating new administrative roles, setting up persistent subagent chains, and installing required packages.

## Instructions
1. Create `agents/data-analyst.md`. Add YAML frontmatter configuring it to use a high-reasoning model (`google/gemini-3.1-pro-preview-customtools`, `thinking: high`). Its role is to parse logs, structure data, and analyze metrics. Include standard Caveman rules.
2. Create `agents/doc-writer.md`. Add YAML frontmatter configuring it to use a fast execution model (`anthropic/claude-haiku-4-5`). Its role is to take structured data and format it into beautiful markdown reports or emails, strictly applying Caveman compression when instructed.
3. Copy `~/.agents/roles/controller.md` to `agents/system-architect.md` and prepend YAML frontmatter configuring it for `google/gemini-3.1-pro-preview-customtools` and `thinking: high`.
4. Update `settings.json`'s `subagents.agentOverrides` block to explicitly define the models for `data-analyst`, `doc-writer`, and `system-architect` to match the YAML frontmatter above.
5. Create a saved chain pipeline at `agents/admin-pipeline.chain.md`. The chain should define a sequential workflow:
   - Step 1: `deep-researcher` (outputs `research.md`, task: `Research: {task}`)
   - Step 2: `data-analyst` (reads `research.md`, outputs `data.md`, task: `Analyze and structure these findings: {previous}`)
   - Step 3: `doc-writer` (reads `data.md`, task: `Write the final report based on this data: {previous}`)
6. Run `pi install npm:pi-web-access` to grant the researcher and analyst autonomous web-browsing capabilities.

## Steps
### Step 1: Setup Roles
- [ ] Create `agents/data-analyst.md`
- [ ] Create `agents/doc-writer.md`
- [ ] Migrate `controller.md` to `agents/system-architect.md`

### Step 2: Global Configuration
- [ ] Update `settings.json`
- [ ] Create `agents/admin-pipeline.chain.md`

### Step 3: Package Installation
- [ ] Install `pi-web-access`

## Git Commit Convention
- **Implementation:** `feat(TP-003): description`
- **Checkpoints:** `checkpoint: TP-003 description`
