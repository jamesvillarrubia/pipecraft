# Pipecraft agent skill

Teaches an AI coding assistant how to drive [Pipecraft](https://pipecraft.thecraftlab.dev),
the trunk-based CI/CD workflow generator for GitHub Actions.

## Install

```bash
npx @thecraftlab/pipecraft-skill          # install into this project
npx @thecraftlab/pipecraft-skill --list   # show which tools this project uses
npx @thecraftlab/pipecraft-skill --uninstall
```

Every flag of `pipecraft skill` works here; this package forwards to it.

If you already have the CLI, `npx pipecraft skill` does the same thing with one fewer
package.

Via [OpenSkills](https://www.npmjs.com/package/openskills), which reads `SKILL.md` straight
from the repository:

```bash
npx openskills install the-craftlab/pipecraft
```

## Where it goes

| Tool             | File                                | Written as             |
| ---------------- | ----------------------------------- | ---------------------- |
| Claude Code      | `.claude/skills/pipecraft/SKILL.md` | whole file             |
| Cursor           | `.cursorrules`                      | block inside your file |
| GitHub Copilot   | `.github/copilot-instructions.md`   | block inside your file |
| Windsurf         | `.windsurfrules`                    | block inside your file |
| Cline / Roo Code | `.clinerules`                       | block inside your file |
| Codex            | `AGENTS.md`                         | block inside your file |

Five of those files are yours and may already hold your own instructions. Pipecraft writes
only between `<!-- pipecraft:start -->` and `<!-- pipecraft:end -->` and changes nothing
outside those markers. Reinstalling replaces that block in place; `--uninstall` removes it
and leaves the rest of the file.

Without `--target`, the command installs for the tools whose files or directories already
exist in the project, and installs every format when it finds none.

## What the skill covers

- Setting Pipecraft up from scratch, and what `init` asks
- Configuring domains, branch flows, and promotion
- `validate` against `doctor`, and which to reach for
- Reading generated workflows, and which jobs are yours to edit
- The behaviours that surprise people: `autoPromote` controls the merge rather than the PR,
  and only commits GitHub itself authored will promote

`SKILL.md` in this package is the same file the repository carries at
`skills/pipecraft-cli/SKILL.md`. There is one copy, so the two cannot disagree.

## License

MIT
