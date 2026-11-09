# Cerebro Inbox

Private Obsidian mobile plugin that imports deliberately queued Markdown notes from Santiago's VPS into `00 · Inbox VPS`.

## Safety model

- The plugin connects only to a configured HTTPS endpoint over Tailscale.
- A bearer token is required.
- It only creates Markdown files; existing notes are never overwritten.
- The generated notes are then encrypted and synced by Self-hosted LiveSync.

## Installation

Install with BRAT on mobile after this repository is published.
