#!/bin/sh
set -e

# Fix ownership of the mounted volume (may be root-owned from a prior deploy).
# This runs as root, then drops to the non-root paperclip user.
chown -R paperclip:paperclip /paperclip

exec gosu paperclip "$@"
