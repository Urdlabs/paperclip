---
created: 2026-03-10T15:15:47.913Z
title: Sync with upstream Paperclip source repo
area: general
files: []
---

## Problem

This is a fork of the original Paperclip repo. The fork has diverged with custom additions (GitHub App webhooks, bug fixes, new tools, Lightpanda browser support), and the upstream may have new features, fixes, or breaking changes that should be pulled in. PROJECT.md lists "Keep upstream compatibility" as a key decision to maintain the option to contribute back or pull upstream changes.

## Solution

1. Add the original Paperclip repo as an `upstream` remote if not already configured
2. Fetch upstream changes and review what's new
3. Merge or rebase upstream/main into the fork, resolving conflicts
4. Verify nothing breaks (run tests, check migrations, verify adapter interfaces)
5. Consider contributing any generally-useful fork changes back upstream
