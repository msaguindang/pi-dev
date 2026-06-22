---
name: rpi-imager
description: Manage SD card images for Raspberry Pi workflows — prep a Pi for cloning, backup an SD card to a compressed .img.xz image. The old name "rpi-manager" was misleading; this skill manages SD card images, not live devices.
---

# Raspberry Pi Imager

A skill for safely preparing and backing up Raspberry Pi SD card images.

Both scripts are now **headless / launch-once**: invoke each ONCE, unattended, and read ONE structured result. The scripts self-verify, self-confirm device identity, and emit a machine-readable summary. Do NOT drive them turn-by-turn, and do NOT re-implement their validation as separate agent turns.

## When to use this skill
- Prepping a source Raspberry Pi for cloning (removing machine-specific identity).
- Creating a compressed master image (`.img.xz`) from an SD card.

---

## The summary contract (both scripts)
Each script prints exactly one block to stdout:

```
=== SUMMARY ===
{ ...JSON... }
=== END SUMMARY ===
```

If `--status-file <path>` is passed, the same JSON is also written to that file. **Read the JSON once when the run returns** — do not poll progress output.

- **rpi-prep** JSON: `{ "script":"rpi-prep", "status":"ok|error", "checks":{ "<item>":"pass|fail", ... }, "duration_sec":N, "host":"...", "timestamp":"ISO-8601" }`. Non-`ok` status also exits non-zero.
- **rpi-imager** JSON: `{ "script":"rpi-imager", "status":"ok|error", "device":"/dev/sdX", "output_path":"...", "size_bytes":N, "sha256":"...", "duration_sec":N, "timestamp":"ISO-8601" }`.

---

## Workflow: Prepare Pi for Cloning (over SSH, launch-once)
Destructive to the Pi's current identity, but **self-confirming and self-verifying** — no babysitting.

Single invocation:
```
ssh pi@<host> 'sudo bash /tmp/ntv-rpi-prep.sh -y --status-file /tmp/prep.json'
```
Then read the `=== SUMMARY ===` block (or `/tmp/prep.json`). The script itself verifies each outcome: machine-id reset, SSH keys regenerated, NTV `config.json` removed, mesh identity cleared, AnyDesk identity cleared, logs/caches cleared, core dumps removed, SSH disabled. A `"fail"` in any check (or `status:"error"`) means inspect that item — do NOT re-run verification as separate commands.

What the prep does (script-enforced, for user awareness): forgets WiFi credentials, resets machine ID, regenerates SSH host keys, clears logs/caches, clears NTV `config.json`, disables SSH by default (must be re-enabled after cloning), installs/updates the MeshCentral agent and clears its identity, clears AnyDesk identity/history.

### rpi-prep flags
- `-y`, `--yes` — non-interactive; skips the "not a Pi?" and "Continue?" prompts. Default (no flag) stays interactive.
- `--status-file <path>` — also write the summary JSON here.
- `--log <path>` — tee step `[INFO]`/`[WARN]` chatter to a logfile; the summary still prints to stdout.

---

## Workflow: Backup SD Card to Image (launch-once)
Device safety is **script-enforced** via `--confirm-device`, not agent-enforced.

Single invocation:
```
sudo /path/ntv-rpi-imager.sh -y --confirm-device "<model-or-size>" \
     --status-file /tmp/rpi-imager.json --log /tmp/rpi-imager.log <device> [out]
```
Then read `/tmp/rpi-imager.json` (or the `=== SUMMARY ===` block) for `output_path`, `size_bytes`, and `sha256`.

### rpi-imager flags
- `-y` — non-interactive (suppresses the live `pv` progress bar; uses `dd status=progress` into the log instead). **Requires `--confirm-device`.**
- `-a` — parallel compression (all CPU cores).
- `-s` — skip filesystem auto-expand on first boot.
- `--confirm-device <assertion>` — REQUIRED with `-y`. A substring that must match the target device's actual `lsblk` MODEL or SIZE; mismatch aborts before any write.
- `--status-file <path>` — also write the summary JSON here.
- `--log <path>` — tee step output and `dd` progress to a logfile.

---

## Long-running / detach
Imaging takes several minutes. Launch it detached, return control, and read the status file ONCE when it finishes:

```
sudo nohup /path/ntv-rpi-imager.sh -y --confirm-device "SDXC" \
     --status-file /tmp/rpi-imager.json --log /tmp/rpi-imager.log /dev/sdX &
```
Later: read `/tmp/rpi-imager.json`. When present with `status:"ok"`, the image is done.

- Do NOT attach and poll `dd`/`pv` output continuously — headless mode deliberately omits the redrawing progress bar for this reason.
- Do NOT re-implement the script's validation, device confirmation, or verification as separate agent turns. The script self-confirms (`--confirm-device`) and self-verifies.

---

## Safety Guidelines (script-enforced)
- Headless writes refuse a wrong `/dev/sdX`: `-y` requires `--confirm-device`, which is matched against the device's real `lsblk` MODEL/SIZE before any `dd`.
- Block-device and not-mounted checks run on BOTH interactive and headless paths.
- The destructive prep is irreversible to device identity — frame the `--confirm-device` assertion and the internal checks as the safety mechanism, not a human keypress.

## Bundled Scripts
The following scripts are bundled and should be used exclusively:
- `scripts/rpi-prep.sh` → `/data/dev/work/ntv/player-scripts/ntv-rpi-prep.sh`
- `scripts/rpi-backup.sh` → `/data/dev/work/ntv/player-scripts/ntv-rpi-imager.sh`

Both scripts are symlinked to the authoritative NTV player-scripts repo (updated Jun 19, 2026).
