# @canonical/skills-contribute

Agent skills for people and agents working on the pragma repositories, [canonical/pragma-core](https://github.com/canonical/pragma-core) and [canonical/pragma-web](https://github.com/canonical/pragma-web). Each skill does one job and says when to use it. Each description names both repositories, so it does not trigger in other projects.

These skills are for contributors to pragma itself. The `pragma` command-line tool does not install them.

| Skill | Job |
| --- | --- |
| [`start-change`](skills/start-change/SKILL.md) | Start a change: pick the repository, create the branch and its worktree, install. Start here. |
| [`change-dependencies`](skills/change-dependencies/SKILL.md) | Change a dependency, a version or the lockfile. |
| [`commit-changes`](skills/commit-changes/SKILL.md) | Write commits. |
| [`push-branch`](skills/push-branch/SKILL.md) | Get a branch push-ready and push it. |
| [`open-pull-request`](skills/open-pull-request/SKILL.md) | Open, update and land a pull request. |
| [`file-issue`](skills/file-issue/SKILL.md) | File, triage and move an issue. |
| [`change-ci`](skills/change-ci/SKILL.md) | Change a workflow or add a check. |

## Install

Link the skill folders into the repository's own `.claude/skills/`, which both repositories ignore in git, so the skills load only when you work on pragma. Claude Code reads `.claude/skills/`; agents that read the shared `.agents/skills/` folder take the same links there.

From a pragma-core checkout, run this at the root of the repository you work in, with `<pragma-core>` the path to that checkout:

```bash
mkdir -p .claude/skills
ln -sf <pragma-core>/packages/skills/contribute/skills/* .claude/skills/
```

From npm, with Bun:

```bash
bun add --global @canonical/skills-contribute
mkdir -p .claude/skills
ln -sf "${BUN_INSTALL:-$HOME/.bun}"/install/global/node_modules/@canonical/skills-contribute/skills/* .claude/skills/
```

Start a new agent session afterwards: the seven skills appear in its list of skills. An agent without them installed can read a skill directly from [`skills/`](skills/).

## Changing a skill

These skills are the one source of the contributor guidance shared by both repositories; pragma-web carries no copy. Knowledge specific to one repository stays in that repository's `.kb/` files. `bun run check` checks each skill's frontmatter, its description and its length.
