#!/bin/bash
# Stage all changes, commit with the given message, and push to main.
# Usage: ./push.sh "description of change"
set -e

if [ -z "$1" ]; then
  echo "Usage: ./push.sh \"description of change\""
  exit 1
fi

git add -A
git commit -m "$1"
git push origin main
