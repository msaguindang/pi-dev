---
name: rpi-deploy
description: Orchestrates deployment of player-ui and player-server to Raspberry Pi test environments based on the active git worktree. Use this skill to build, bundle, and deploy code to a Pi via SSH/SFTP.
---

# Raspberry Pi Dynamic Deployer

A skill for dynamically building and deploying `player-ui` and `player-server` to a Raspberry Pi, leveraging your current git worktree context to ensure you deploy the correct code.

## When to use this skill
- Pushing the active branch's code to a test device.
- Testing local changes on actual hardware.
- Orchestrating the complex build sequence between the Angular UI and Node Server.

---

## Dynamic Context Detection
When invoked, the AI will first determine your current context:
1.  **Current Branch**: It will read `git branch --show-current`.
2.  **Environment Variables**: It will load `NTV_PLAYER_UI_WT_DIR` and `NTV_PLAYER_SERVER_WT_DIR` from `~/.bashrc` to locate the exact directories corresponding to your branch.

## Interactive Workflow
The AI will guide you through the following sequence:

1.  **Context Confirmation**: "I see you are working on `[branch]`. Target environment: `dev` (default)."
2.  **Scope Selection**: Ask you what you want to deploy:
    - **1. UI Only**: Builds the UI in the UI worktree, bundles it into the Server worktree, and uploads.
    - **2. Server Only**: Skips UI build, only builds/bundles the Server worktree, and uploads.
    - **3. Both UI & Server**: Full build and upload.
3.  **Environment Selection**: Ask if you are deploying to `dev`, `staging`, `prod`, `local`, or `sandbox` (These map to the credentials in `player-server/sshConfig.js`).
4.  **Execution**: The AI will invoke `scripts/deploy_to_pi.sh` with your choices.
5.  **Verification**: The AI will read the output to ensure `pm2` successfully restarted the player on the remote device.

---

## Safety Guidelines
- **NEVER** deploy without confirming the target environment (IP Address).
- **ALWAYS** check that the `.env` file in the target `player-server` worktree contains the correct SSH passwords before deploying.
- **HALT** if any `npm run build` or `gulp` command fails; do not proceed to upload broken artifacts.

## Bundled Resources
- `scripts/deploy_to_pi.sh` (The intelligent execution wrapper for builds and gulp tasks)
