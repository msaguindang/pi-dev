---
name: weekly-report-generator
description: Reads daily Obsidian work logs for a week, extracts technical notes and team updates, and synthesizes a management-friendly weekly report.
---

# Skill: weekly-report-generator

A pi skill that reads daily work logs for a specific week, extracts technical notes and team updates, and uses the LLM to synthesize a management-friendly Weekly Report.

## When to use this skill
- When the user asks to "write the weekly report", "generate the report", or "summarize this week's logs".
- When the user wants to convert raw daily technical logs into a high-level executive summary.

## How the AI Should Execute This Skill

### Step 1: Determine the Target Week
- If the user doesn't specify a week, assume the **current week**.
- Calculate the ISO week string (e.g., `2026-W15`). You can use `date +%G-W%V` in bash.
- Determine the Friday of that week to use for the filename (e.g., `2026-04-10`).

### Step 2: Extract Raw Data
Run the bundled extraction script to pull the "Dev Log" and "Team Updates" from the Obsidian vault:
```bash
python3 ~/.pi/agent/skills/weekly-report-generator/scripts/extract_logs.py <YYYY-Www> "$HOME/Dropbox/Obsidian"
```

### Step 3: Synthesize and Translate (LLM Magic)
Read the output of the script. Do NOT just copy-paste the raw bullets. You must **synthesize** the data:
1. **Translate Technical Jargon to Business Value:** 
   - *Raw:* "hardened Angular startup flow by upgrading health-check"
   - *Synthesized:* "Improved Player V2 stability and reliability during startup."
2. **Group by Theme/Project:** Group related updates together (e.g., "Player V2 Stability", "Security & Infrastructure").
3. **Draft the Executive Summary:** Write a 2-3 sentence high-level summary of the week's biggest wins based on the logs.

### Step 4: Generate the Report
Create a new file in the vault at `2. Areas/01 Work/01 Operations/Weekly Reports/YYYY-MM-DD - Weekly Report.md`.

Use this exact structure:

```markdown
---
tags:
  - type/report
  - status/draft
week: <YYYY-Www>
created: <YYYY-MM-DD HH:mm>
updated: <YYYY-MM-DD HH:mm>
---
# End of Week Report (<Month DD, YYYY>)
## Team: Player
---
## 1. Executive Summary & Key Achievements
*(Insert your synthesized high-level summary and bullet points of major wins here)*

---
## 2. Team Progress Highlights
*(Insert your synthesized, grouped summaries of what Arjay, Leigh, Adrian, Rico, and you accomplished here. Keep it focused on outcomes, not just tasks.)*

---
## 3. Strategic Goals for Next Week
- [ ] *(Leave blank or infer 1-2 obvious next steps based on blockers/ongoing work)*
```

### Step 5: Convert to Word Document (.docx)
Run `pandoc` to convert the generated markdown report into a `.docx` file in the same directory. Because the report contains YAML frontmatter and horizontal rules that confuse pandoc, strip them first:
```bash
sed '1,8d' "path/to/YYYY-MM-DD - Weekly Report.md" | sed 's/^---$//g' > /tmp/report_temp.md
pandoc /tmp/report_temp.md -o "path/to/YYYY-MM-DD - Weekly Report.docx"
rm /tmp/report_temp.md
```

### Step 6: Review
Present the generated report to the user and ask if they want any adjustments to the tone or content. Let them know the `.docx` file is ready for upload to Google Drive.
