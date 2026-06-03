---
name: subagents-list
description: Display the available subagents and their roles in the Adjutant setup. Use when the user asks to see agents, list subagents, show available agents, "what agents do I have", "who are my agents", "show me the roster", or any similar request to view or recall the agent setup.
---

# Subagents List

Call the `show_agents` tool. It renders a colored card grid directly into the chat — each agent as a bg-filled, border-colored card in a 3-column layout. Pipeline agents first, domain agents second.

After the tool returns, add:

> `/agents` to pin the grid above the editor · `/agents-hide` to dismiss · `/run <name>` to launch one
