# @canonical/skills-pragma

The agent skills people use through the `pragma` command-line tool. Each skill is a
`skills/<name>/SKILL.md` file: a named set of instructions an agent loads when the job calls for it.

## Getting the skills

You do not install this package yourself. `pragma` declares it as a pack that holds skills and no
graph data:

- `pragma sources update` installs the skills from this repository's `main` branch.
- A `pragma` release also carries a copy of them, so a fresh install lists them before any update.
- `pragma setup skills` links them into each AI harness on your machine (Claude Code, Cursor and the
  others).

```bash
pragma skill list
pragma skill lookup specify-component
```

## Changing a skill

Edit the `SKILL.md` here. `pragma`'s copy (`packages/cli/pragma/bundled-skills/`) is regenerated from
this package by `bun run bundle` when `pragma` is released, so it needs no separate edit.

`bun run test` checks the examples in `anatomy-author` against the anatomy grammar and the token
graph they teach.
