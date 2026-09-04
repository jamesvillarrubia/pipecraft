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

# package.json holds the 0.0.0-releaseit placeholder, the same one the CLI carries, and the
# release tag supplies the real number. Publishing without setting it first fails with "You
# must specify a tag using --tag when publishing a prerelease version", which is what a
# hand-run `npm publish` in this directory hits.
#
# Restore the file afterwards. CI throws the checkout away, but someone running the first
# publish by hand should not be left with a modified package.json to notice and revert.
ORIGINAL="$(cat package.json)"
restore() { printf '%s\n' "$ORIGINAL" > package.json; }
trap 'rc=$?; restore; exit $rc' EXIT

npm pkg set version="$VERSION"
npm pkg set dependencies.pipecraft="$VERSION"

if npm view "$PACKAGE@$VERSION" version >/dev/null 2>&1; then
  echo "$PACKAGE@$VERSION is already on the registry. Nothing to publish."
  exit 0
fi

# --provenance signs a statement about the CI run that produced the tarball, so it needs a
# supported CI to describe. A laptop has nothing to attest to and npm rejects the flag there,
# which is exactly where the very first publish has to happen: OIDC cannot create a package,
# so someone runs this by hand once. `npm publish --dry-run` accepts the flag either way, so
# nothing catches this until the real publish.
PROVENANCE=()
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  PROVENANCE=(--provenance)
else
  echo "Not running in GitHub Actions, so publishing without provenance."
  # npm answers an unauthenticated PUT to a scoped package with 404, the same status a
  # package that does not exist gets, so a dead token in ~/.npmrc looks like "never
  # published" to the branch below. Ask npm who we are first; OIDC in Actions has no answer
  # to that until publish time, so the check stays out of CI.
  if ! npm whoami >/dev/null 2>&1; then
    echo "::error::npm has no valid login on this machine ('npm whoami' failed)."
    echo "::error::Run 'npm login', then run this script again."
    exit 1
  fi
fi

if npm publish ${PROVENANCE[@]+"${PROVENANCE[@]}"} --access public; then
  echo "Published $PACKAGE@$VERSION"
  exit 0
fi

if npm view "$PACKAGE" version >/dev/null 2>&1; then
  echo "::error::Publishing $PACKAGE@$VERSION failed, and the package exists."
  exit 1
fi

# By hand there is no OIDC to excuse a failed first publish: the person running this is the
# one who was meant to create the package, so telling them to run it by hand is circular.
if [ -z "${GITHUB_ACTIONS:-}" ]; then
  echo "::error::Publishing $PACKAGE@$VERSION failed, and the package does not exist yet."
  echo "::error::Check that 'npm whoami' names an account that can publish under the @thecraftlab scope."
  exit 1
fi

echo "::warning::$PACKAGE has never been published, and npm's OIDC cannot create a package."
echo "::warning::Publish it once by hand, then this step takes over:"
echo "::warning::  cd skills/pipecraft-cli && ../../scripts/publish-skill.sh <version>"
exit 0
