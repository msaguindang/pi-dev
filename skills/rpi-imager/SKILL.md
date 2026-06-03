---
name: rpi-imager
description: Manage SD card images for Raspberry Pi workflows — prep a Pi for cloning, backup an SD card to a compressed .img.xz image. The old name "rpi-manager" was misleading; this skill manages SD card images, not live devices.
---

# Raspberry Pi Imager

A skill for safely preparing and backing up Raspberry Pi SD card images.

## When to use this skill
- Prepping a source Raspberry Pi for cloning (removing machine-specific identity).
- Creating a compressed master image (`.img.xz`) from an SD card.
- Verifying device safety before performing disk-level operations.

---

## Workflow: Prepare Pi for Cloning
This process is **interactive and destructive** to the Pi's current identity.

1.  **Context Check**: Verify SSH access to the target Pi.
2.  **Implications Warning**: Explain that running the prep script will:
    - Forget WiFi credentials.
    - Reset the machine ID.
    - Regenerate SSH keys.
    - Clear logs and caches.
3.  **Confirmation**: Require explicit user confirmation.
4.  **Execution**: Invoke `rpi-prep.sh` via SSH.

---

## Workflow: Backup SD Card to Image
This process is **high-risk** and requires strict device verification.

1.  **Identification**: Ask the user to insert the SD card.
2.  **Selection**: Run `lsblk` to present a list of attached drives. Ask the user to identify the correct device (e.g., `/dev/sdb`).
3.  **Validation**:
    - Ensure it is not mounted.
    - Present the device's vendor/model/size.
4.  **Confirmation**: Require explicit "YES" to proceed before running `rpi-backup.sh`.
5.  **Execution**: Perform the image creation using `dd` piped through `xz`.

---

## Safety Guidelines
- **NEVER** run backup operations without verifying the device mount point and size with the user.
- **ALWAYS** explain the implications of running `rpi-prep.sh`.
- **NEVER** assume a device is an SD card based on path alone (`/dev/sda` can be a system drive).

## Bundled Scripts
The following scripts are bundled and should be used exclusively:
- `scripts/rpi-prep.sh`
- `scripts/rpi-backup.sh` (hardened version)
