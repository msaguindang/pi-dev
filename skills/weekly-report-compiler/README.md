# Weekly Report Compiler — Setup Guide

Compiles current week's Obsidian work logs into a formatted weekly report (.md + .docx).

---

## Step 1: Install Lexend Font

`fonts-lexend` is not in Ubuntu 24.04 apt. Install via npm fontsource + fonttools conversion:

```bash
# 1. Install conversion tools
pip install fonttools brotli --break-system-packages

# 2. Fetch Lexend woff2
npm install @fontsource/lexend

# 3. Convert woff2 → TTF and install
mkdir -p ~/.local/share/fonts/
python3 - <<'EOF'
import io, os
from fontTools.ttLib import TTFont
woff2 = "node_modules/@fontsource/lexend/files/lexend-latin-400-normal.woff2"
out = os.path.expanduser("~/.local/share/fonts/Lexend-Regular.ttf")
TTFont(io.BytesIO(open(woff2, "rb").read())).save(out)
EOF

# 4. Refresh font cache
fc-cache -fv

# 5. Clean up
rm -rf node_modules package-lock.json
```

Verify:
```bash
fc-list | grep -i lexend
```

---

## Step 2: Install Python Dependencies

```bash
pip install -r scripts/requirements.txt
```

---

## Step 3: Generate Reference Document

```bash
python3 scripts/make_reference.py
```

This creates `scripts/reference.docx` with Lexend as the default font. Pandoc uses it when exporting .docx files. Run only once (or re-run after reinstalling the font).

---

## Step 4: Configure Paths

```bash
cp scripts/config.example.json scripts/config.json
```

Edit `scripts/config.json`:
```json
{
  "vault_path": "~/Dropbox/Obsidian",
  "work_logs_folder": "2. Areas/01 Work/01 Operations/Work Logs",
  "reports_folder": "2. Areas/01 Work/01 Operations/Weekly Reports",
  "docx_output_dir": "~/Documents/weekly-reports"
}
```

---

## Usage

Invoke via your AI agent (OpenCode, Claude Code, etc.):

> "Compile the weekly report" / "Generate this week's EOW report"

The agent will:
1. Run `collect.py` to gather work logs
2. Synthesize and write the `.md` report to your Obsidian vault
3. Run `export.py` to produce the `.docx` in `~/Documents/weekly-reports/`

---

## Manual Usage

```bash
# Inspect what will be collected
python3 scripts/collect.py | python3 -m json.tool

# After manually writing/editing the .md report, export to .docx
python3 scripts/export.py --report-path "/path/to/YYYY-MM-DD - Weekly Report.md"
```

---

## Output Locations

| File | Location |
|------|----------|
| `.md` report | `<vault>/2. Areas/01 Work/01 Operations/Weekly Reports/YYYY-MM-DD - Weekly Report.md` |
| `.docx` report | `~/Documents/weekly-reports/YYYY-MM-DD - Weekly Report.docx` |

Filename date is the **Friday** of the report week.
