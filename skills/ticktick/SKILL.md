---
name: ticktick
description: Interact with TickTick task manager via the local CLI tool for creating, listing, and managing tasks.
---

# TickTick Skill

This skill provides instructions for interacting with TickTick using the local CLI tool.

## Overview

Whenever the user wants to interact with TickTick (e.g., list projects, create tasks, check habits), you should use the `bash` tool to run the bundled TickTick CLI script:

```bash
~/.pi/agent/skills/ticktick/ticktick.sh <method> '<params_json>'
```

The CLI sends a JSON-RPC request to the TickTick MCP server and prints the result.

## Common Methods

Here are some common methods and how to use them. **When listing tasks for the user, always format the output as a Markdown table with columns for: Task Name, Priority, and Due Date.** Map TickTick priority numbers (1, 3, 5) to descriptive labels (Low, Medium, High).

### 1. List Projects
```bash
~/.pi/agent/skills/ticktick/ticktick.sh ticktick_list_projects '{}'
```

### 2. Get Project by ID
```bash
~/.pi/agent/skills/ticktick/ticktick.sh ticktick_get_project_by_id '{"project_id": "12345"}'
```

### 3. Create a Task
```bash
~/.pi/agent/skills/ticktick/ticktick.sh ticktick_create_task '{"task": {"title": "Buy groceries", "projectId": "12345", "content": "Milk, eggs, bread"}}'
```

### 4. Search Tasks
```bash
~/.pi/agent/skills/ticktick/ticktick.sh ticktick_search_task '{"query": "groceries"}'
```

### 5. Complete a Task
```bash
~/.pi/agent/skills/ticktick/ticktick.sh ticktick_complete_task '{"project_id": "12345", "task_id": "67890"}'
```

### 6. List Habits
```bash
~/.pi/agent/skills/ticktick/ticktick.sh ticktick_list_habits '{}'
```

## Important Notes
- Always pass the `params_json` as a properly formatted JSON string wrapped in single quotes (`'{"key": "value"}'`) to avoid bash parsing issues.
- If a method requires no parameters, pass an empty JSON object (`'{}'`).
- Authentication uses the `TICKTICK_API_KEY` environment variable if it is already set; otherwise the script loads it via `infisical` (domain `http://localhost:8080`).
- The output will be a JSON string containing the result of the operation.
