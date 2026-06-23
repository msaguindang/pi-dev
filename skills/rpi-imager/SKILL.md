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

## Operational runbook (driving prep + imaging remotely)
The end-to-end procedure for prepping a Pi over SSH and imaging its card. Two real
hardware runs failed here — fix both by following this exactly.

1. **Get the FULL repo on the device — not one file.** prep needs its siblings (esp.
   `ntv-wallpaper.png`). `git clone`/`pull` the player-scripts repo on the device, OR
   `scp -r /data/dev/work/ntv/player-scripts pi@<dev>:/tmp/` so the wallpaper comes
   along. A lone `scp` of `ntv-rpi-prep.sh` makes `wallpaper_set` fail HARD.
2. **Drive over Ethernet — not WiFi.** prep forgets WiFi; if you drove it over that
   WiFi, the SSH session dies. Use the wired/management link, and add
   `-o ServerAliveInterval=5 -o ServerAliveCountMax=3` so a severed session dies in
   ~15s instead of hanging.
3. **Run prep + capture status:**
   ```
   ssh -o ServerAliveInterval=5 -o ServerAliveCountMax=3 pi@<dev> \
       'cd /tmp/player-scripts && sudo ./ntv-rpi-prep.sh -y --status-file /tmp/prep-status.json' \
       | tee /tmp/prep-run.log
   ```
   Parse the `=== SUMMARY ===` `status` from the local tee'd log — the SUMMARY now
   arrives BEFORE teardown, so it reaches you over the live link. To inspect then power
   down by hand, add `--no-shutdown` and `scp pi@<dev>:/tmp/prep-status.json .` off the
   device first (the device `/tmp` is lost on shutdown).
4. **Gate check:** proceed ONLY if prep `status == ok`. If any HARD check failed, abort,
   re-diagnose, re-run — do NOT image a dirty device.
5. **Move card → imaging PC → run imager** with the captured status as the gate:
   ```
   sudo ./ntv-rpi-imager.sh -y --confirm-device "<SIZE>" \
        --prep-status-file /tmp/prep-status.json \
        --status-file /tmp/rpi-imager.json --log /tmp/rpi-imager.log /dev/sdX
   ```
   The imager refuses to start unless the prep status JSON shows `status:ok`, and
   mount-verifies the produced `.img` before compression — a dirty artifact is deleted,
   not shipped.

> ⚠️ **Failure modes (both seen in real runs):**
> - **Never `scp` the lone script.** The sibling `ntv-wallpaper.png` won't come along →
>   wallpaper step is skipped → `wallpaper_set` fails. Always put the WHOLE
>   `player-scripts` dir on the device.
> - **Never drive prep over the WiFi it wipes.** prep forgets WiFi credentials mid-run;
>   the SSH session dies (a 22-min hang in the wild). Use Ethernet + `ServerAliveInterval`.
> - **The device `/tmp` status file is lost on shutdown.** Capture status from the tee'd
>   stdout, or `scp` the `--status-file` off BEFORE teardown — never read it post-shutdown.

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
