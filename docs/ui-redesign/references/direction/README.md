# Design-direction references

The two owner-supplied screenshots that established the redesign direction are **conversation attachments**, not repository binaries. Their provenance is recorded here so future chats can verify that the correct originals were attached.

The GitHub connector used for this bootstrap can write UTF-8 repository files but cannot safely transfer the existing binary conversation attachments into Git without reconstructing or degrading them. Do **not** create a guessed substitute. Attach the two original images to the Design Director chat once, in its first task message.

## OLD design reference

- role: older/current design-direction reference;
- expected source: **2048 × 757 PNG**;
- source SHA-256: `5e16d6248b86a11c0ae5a7292a64aee3b09615170b42efed895924a59edfb6d6`.

Use it to understand what is being modernized. It is not a layout contract that must be preserved.

## NEW redesign-direction reference

- role: newer desired redesign-direction / quality-bar reference;
- expected source: **1138 × 1382 PNG**;
- source SHA-256: `973748b19f5b4cc78a65bbb3c8403ec0d4920cc00097ab4c4df66abcfe0f7642`.

Use it to infer the desired level of hierarchy, typography, spacing, density, component quality, financial-data presentation and polish.

It is **not** a universal page template and is **not** a source of product functionality. The repository and explicit owner decisions determine what MyFinHub actually does.

## Chat handoff rule

The owner should attach both originals to the UI/UX Design Director chat when starting Phase 1. After that, the same long-lived design chat should reuse them throughout the page-by-page redesign. The Implementation Engineer does not need these direction images; it needs the exact per-page design target that the owner approved.
