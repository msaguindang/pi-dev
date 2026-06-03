---
name: weekly-report-compiler
description: Compiles all work logs for the current week into a weekly report .md saved in the Obsidian vault and exports a .docx with Lexend font to ~/Documents/weekly-reports.
---

# Weekly Report Compiler

Analyzes the current week's daily work logs and synthesizes them into a formatted weekly report. Saves to Obsidian vault and exports to .docx.

---

## When to Use This Skill

- When the user asks to "compile the weekly report", "generate this week's report", or "create the EOW report".
- At the end of each work week (Friday or following Monday).
- When the user wants to update/regenerate an existing weekly report.

---

## Required Configuration

`scripts/config.json` must exist with:
- `vault_path` — path to Obsidian vault
- `work_logs_folder` — relative path to work logs within vault
- `reports_folder` — relative path to weekly reports within vault
- `docx_output_dir` — local output directory for .docx files

---

## How the AI Should Execute This Skill

### Step 1: Collect Week Metadata

Run from the skill directory:
```bash
python3 scripts/collect.py
```

Parse the JSON output. It provides:
- `week_start`, `week_end` — Mon–Fri date range
- `report_path` — absolute path where the .md should be saved
- `report_exists` — whether a report already exists for this week
- `work_logs` — array of `{date, path, content}` for each day's work log found

### Step 2: Check Existing Report

If `report_exists` is `true`, read the file at `report_path` for context. The agent should update or regenerate it based on the latest work log content — do NOT blindly overwrite a finalized report without reading it first.

### Step 3: Analyze and Generate Report

Read all entries in `work_logs`. Synthesize a weekly report using this exact format:

```markdown
---
tags:
  - type/report
  - status/draft
week: "YYYY-Www"
created: YYYY-MM-DD HH:MM
updated: YYYY-MM-DD HH:MM
---
# End of Week Report (Month DD, YYYY)
## Team: Player
---
## 1. Executive Summary & Key Achievements

- **Topic:** Summary of the achievement or milestone.
---
## 2. Team Progress Highlights

### Arjay (Player V2 & Phoenix)
- Consolidated bullets summarizing Arjay's work across the week.

### Leigh (Pulse Infrastructure)
- Consolidated bullets summarizing Leigh's work across the week.

### Adrian (Security & Pentesting)
- Consolidated bullets summarizing Adrian's work across the week.

### Rico
- Consolidated bullets, or: "No EOD updates posted this week."
---
## 3. Strategic Goals for Next Week
- Bullet point priorities for the coming week.
```

**pandoc note:** Section `---` dividers must NOT be preceded by a blank line — pandoc treats `---` after a blank line as a YAML metadata block and will fail to parse the document. Always place `---` immediately after the last bullet of the previous section.

**Writing rules:**
- Consolidate per-day entries into themes — do not copy raw messages verbatim
- Preserve technical specifics (feature names, error names, tools) but write in report prose
- If a team member has no entries across all logs: write "No EOD updates posted this week."
- `week` frontmatter uses ISO week format: e.g. `"2026-W17"`
- `created`/`updated` use current datetime: `YYYY-MM-DD HH:MM`
- For existing reports (`report_exists: true`): preserve the `created` timestamp, update `updated` only

### Step 4: Save the .md Report

Write the generated report content to `report_path` (from collect.py output).

### Step 5: Export to .docx

```bash
python3 scripts/export.py --report-path <report_path>
```

Confirm the .docx output path printed by the script. The file is saved to `docx_output_dir` from config.

---

## Bundled Resources

- `scripts/collect.py` — determines week bounds, reads work logs, outputs JSON
- `scripts/export.py` — pandoc wrapper for .md → .docx conversion
- `scripts/make_reference.py` — one-time setup: generates reference.docx with Lexend font
- `scripts/config.json` — paths configuration (gitignored)
- `scripts/requirements.txt` — Python dependencies

---

## Error Handling

- **`config.json` missing**: Prompt user to copy `config.example.json` and fill in paths.
- **No work logs found**: Inform user no logs exist for the current week. Ask if they want to specify a different week.
- **`reference.docx` missing**: `export.py` warns but continues with pandoc defaults. Run `make_reference.py` to fix.
- **Lexend not installed**: `make_reference.py` prints install instructions and exits 1.
- **pandoc not installed**: `export.py` will fail — inform user to install pandoc.
