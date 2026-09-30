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

Link the skill folders into the folder your agent reads skills from: `~/.claude/skills` for Claude Code, `~/.agents/skills` for most other agents.

From a pragma-core checkout, run this at its root:

```bash
mkdir -p ~/.claude/skills
ln -s "$PWD"/packages/skills/contribute/skills/* ~/.claude/skills/
```

From npm, with Bun:

```bash
bun add --global @canonical/skills-contribute
mkdir -p ~/.claude/skills
ln -s "${BUN_INSTALL:-$HOME/.bun}"/install/global/node_modules/@canonical/skills-contribute/skills/* ~/.claude/skills/
```

An agent without them installed can read a skill directly from [`skills/`](skills/).

## Changing a skill

The skills are the single source of the shared contributor guidance for both repositories; pragma-web carries no copy. Keep each `SKILL.md` under 500 lines, with YAML frontmatter first, and a `description` that says what the skill does, when to use it, and names both repositories. Repository-specific knowledge stays in each repository's `.kb/` files.
