/**
 * npm trusted publishing (OIDC) matches a package's `repository.url` against the repository
 * that is actually publishing it. Run 33968003142 (v0.47.16) published the root `pipecraft`
 * package and then got `404 Not Found - PUT` publishing `@thecraftlab/pipecraft-skill`, from
 * the identical OIDC environment. The root package.json carried
 * `https://github.com/the-craftlab/pipecraft.git`; the skill package.json carried
 * `git+https://github.com/the-craftlab/pipecraft.git`. The two strings name the same
 * repository but do not match byte-for-byte, which is what trusted publishing checks.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')

describe('repository.url parity between the root and skill packages', () => {
  it('matches byte-for-byte, since npm trusted publishing compares it exactly', () => {
    const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const skill = JSON.parse(
      readFileSync(join(ROOT, 'skills', 'pipecraft-cli', 'package.json'), 'utf-8')
    )

    expect(skill.repository.url).toBe(root.repository.url)
  })
})
