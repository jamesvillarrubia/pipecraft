#!/usr/bin/env bash
#
# Publish the root `pipecraft` package idempotently.
#
# Run 33968003142 (v0.47.16) published this package, then failed re-running the same
# workflow run: "You cannot publish over the previously published versions: 0.47.16". That
# failure is on the main publish step, before the skill package step below it ever runs, so
# a version already on the registry has to resolve as success here the same way
# publish-skill.sh already treats it for the skill package.
#
set -euo pipefail

VERSION="${1:?usage: publish-main.sh <version>}"

if npm view "pipecraft@$VERSION" version >/dev/null 2>&1; then
  echo "pipecraft@$VERSION is already on the registry. Nothing to publish."
  exit 0
fi

npm publish --provenance --access public
