---
name: ticktick
description: "Create, list, and update tasks in TickTick via local CLI"
---
# TickTick Skill

## CLI Tool
TickTick MCP broker — invoked via local CLI tools.

## Common Operations
- **List tasks:** query TickTick for open tasks in a project
- **Create task:** provide title, due date (optional), project (optional)
- **Complete task:** mark task done by ID or title match
- **Add note:** append note to existing task

## NTV Project
Tasks related to NTV work go in NTV360 project.
Ticket ID format: `nctvp-<number>`

## Admin Tasks
Non-NTV tasks (personal, setup, research) go in default inbox unless project specified.
