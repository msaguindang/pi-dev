---
name: admin-pipeline
description: "Sequential workflow for research, analysis, and reporting"
---
# Admin Pipeline

Sequential workflow for research, analysis, and reporting.

## Steps

### 1. Research
- Agent: `deep-researcher`
- Output: `research.md`
- Task: `Research: {task}`

### 2. Analysis
- Agent: `data-analyst`
- Reads: `research.md`
- Output: `data.md`
- Task: `Analyze and structure these findings: {previous}`

### 3. Reporting
- Agent: `doc-writer`
- Reads: `data.md`
- Task: `Write the final report based on this data: {previous}`
