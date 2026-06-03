---
name: rpi5-deployer
description: Deploy player-ui and player-server on Raspberry Pi 5 using flexible worktree selection
license: MIT
compatibility: opencode
metadata:
  audience: developers
  branch: main-pi5
  workflow: deployment
---

## What I do

This skill provides instructions for deploying the NCompass TV player-ui and player-server to Raspberry Pi 5 devices using a flexible worktree-based deployment system.

## When to use me

Use this when you need to:

- Deploy player-ui to a Raspberry Pi 5
- Deploy player-server to a Raspberry Pi 5
- Select different git worktrees for deployment
- Manage deployment configuration for both repos

## Configuration

The deployment system uses a shared config file at `$NTV_DIR/deploy-config.json`:

```json
{
  "basePath": "$NTV_DIR",
  "ui": {
    "path": "player-ui-worktrees/main-pi5"
  },
  "server": {
    "path": "player-server-worktrees/main-pi5"
  }
}
```

## Deployment Commands

Run these from the player-ui worktree:

```bash
# Deploy both UI and server (interactive worktree selection)
npm run deploy

# Deploy only the UI
npm run deploy:ui

# Deploy only the server
npm run deploy:server

# Select worktrees interactively and save to config
npm run deploy:select
```

## Flags

- `--ui-only` - Deploy only player-ui
- `--server-only` - Deploy only player-server
- `--select` - Interactive worktree selection, saves to config for future runs

## The --select Mode

When running `npm run deploy:select`:

1. Shows numbered list of available git worktrees for both player-ui and player-server
2. Allows selecting the current branch for each
3. Updates `$NTV_DIR/deploy-config.json` with selected paths
4. Future runs use the saved configuration without prompting

## Error Handling

The deployment system fails explicitly with helpful error messages. It does NOT default to sensible values - misconfiguration will result in clear errors.

## Requirements

- Node.js 24+ on the target device
- PM2 for process management
- SFTP access to the target device
- SSH configuration in `sshConfig.js`

## References

- Deploy script: `scripts/deploy.js` in player-ui
- Config file: `$NTV_DIR/deploy-config.json`
- player-ui README: Contains detailed deployment documentation
- player-server README: References player-ui for deployment details
