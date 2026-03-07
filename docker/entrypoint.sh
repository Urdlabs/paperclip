#!/bin/sh
set -e

# Fix volume ownership only if top-level is wrong (avoid slow recursive chown on every start).
if [ "$(stat -c '%u' /paperclip 2>/dev/null)" != "$(id -u paperclip)" ]; then
  chown -R paperclip:paperclip /paperclip
else
  chown paperclip:paperclip /paperclip
fi

# Configure git credential helper for GitHub if a token is provided.
# GH_TOKEN takes precedence (gh CLI convention), falls back to GITHUB_TOKEN.
_GH_TOKEN="${GH_TOKEN:-$GITHUB_TOKEN}"
if [ -n "$_GH_TOKEN" ]; then
  printf 'https://x-access-token:%s@github.com\n' "$_GH_TOKEN" \
    > /paperclip/.git-credentials
  chown paperclip:paperclip /paperclip/.git-credentials
  chmod 600 /paperclip/.git-credentials
  gosu paperclip git config --global credential.helper 'store --file /paperclip/.git-credentials'
  export GH_TOKEN="$_GH_TOKEN"
fi

# Mark all directories safe for git (avoids ownership warnings in agent workspaces).
gosu paperclip git config --global safe.directory '*'

exec gosu paperclip "$@"
