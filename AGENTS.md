@~/.agents/context/identity.md
@~/.agents/context/environment.md
@~/.agents/context/long-term.md
@~/.agents/standards/code-style.md

## Harness Infrastructure Rules

**Principle 7 — The harness itself is part of the system:**
The pi harness, extensions, and intercom bridge require the same validation discipline as the code they manage. Before depending on any harness capability, confirm it is installed and operational.

- Before using `live_agents` for parallel work: run `subagent({ action: "doctor" })` and confirm `pi-intercom: available`
- Before assuming an extension is active: verify it exists under `~/.pi/agent/extensions/` and loads without error
- Install intercom once per machine: `pi install npm:pi-intercom`
- If `live_agents` returns `No result provided`: the bridge is missing, not the agents
