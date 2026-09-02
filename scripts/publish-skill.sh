#!/usr/bin/env bash
#
# Publish the skill package alongside a CLI release.
#
# Run from skills/pipecraft-cli with the release version as $1.
#
# Three outcomes, and only one of them is a failure:
#
#   already at this version  A push to the final branch that bumps nothing resolves to the
#                            version already released, so this runs again for it. v0.46.1
#                            published, ran a second time three minutes later, and npm
#                            answered "You cannot publish over the previously published
#                            versions", turning a released version into a red X.
#
#   package does not exist   npm's OIDC publishing cannot create a package. Until someone
#                            runs `npm publish --access public` once by hand, every release
#                            gets `404 Not Found - PUT`. That is a setup step nobody has done
#                            yet, not a broken release, and the CLI beside it published fine.
#
#   anything else            A real failure on a package that exists. Fail the job.
#
set -euo pipefail

PACKAGE="$(node -p 'require("./package.json").name')"
VERSION="${1:?usage: publish-skill.sh <version>}"

npm pkg set version="$VERSION"
npm pkg set dependencies.pipecraft="$VERSION"

if npm view "$PACKAGE@$VERSION" version >/dev/null 2>&1; then
  echo "$PACKAGE@$VERSION is already on the registry. Nothing to publish."
  exit 0
fi

if npm publish --provenance --access public; then
  echo "Published $PACKAGE@$VERSION"
  exit 0
fi

if npm view "$PACKAGE" version >/dev/null 2>&1; then
  echo "::error::Publishing $PACKAGE@$VERSION failed, and the package exists."
  exit 1
fi

echo "::warning::$PACKAGE has never been published, and npm's OIDC cannot create a package."
echo "::warning::Publish it once by hand, then this step takes over:"
echo "::warning::  cd skills/pipecraft-cli && npm publish --access public"
exit 0
