# dopawrite

A distraction-free Markdown editor that lives in your browser. Your writing is stored locally in IndexedDB — no account, no server, no sync.

**Live →** <https://marekbrze.github.io/dopawrite/>

## Why

Most writing tools want to be a platform: an account, a cloud, a dashboard. Dopawrite is just the editor. Write, and it's there next time you open the tab.

- **Local-only.** Documents persist in IndexedDB (via Dexie). Nothing leaves your device.
- **GitHub-flavored Markdown.** Live preview with `react-markdown` + `remark-gfm` (tables, task lists, strikethrough).
- **Multiple documents.** A small document store, not a single scratchpad.

## Tech

React, Vite, TypeScript, Dexie (IndexedDB), react-markdown.

## Status

Personal tool, usable. Polish for the writing experience is ongoing.
