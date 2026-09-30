---
name: open-pull-request
description: Opens, updates and lands a pull request in canonical/pragma-core or canonical/pragma-web. Covers the repository's template, the conventional-commit title, labels, a body that stands on its own, one concern per pull request, merge order across the two repositories, review threads and the squash message. Use when opening, editing, reviewing or merging a pull request in either pragma repository.
---

# Open a pull request

Use this when opening, updating or landing a pull request in `canonical/pragma-core` or `canonical/pragma-web`. The branch is already push-ready (the `push-branch` skill).

## Checklist

```
- [ ] 1. Keep to one concern
- [ ] 2. Write the title
- [ ] 3. Fill the body from the template, so it stands on its own
- [ ] 4. Apply this repository's pull-request steps
- [ ] 5. Answer and resolve every review thread
- [ ] 6. Merge
```

## 1. Keep to one concern

A pull request carries one concern, with no scope creep. A review finding about behaviour that is already on `main` is not fixed in it: say in the body that it is known and left unchanged. An unrelated item bundled in is rare, and the body calls it out as a drive-by.

## 2. Write the title

- **The title is a conventional-commit `type(scope): subject`**, written like a commit subject (the `commit-changes` skill), following the pull-request standard (`cs:git.pr.template`). `pr-lint.yml` rejects any other form and any type outside the allowed list.
- **CI derives the type label from the title.** Never add it by hand: fix the title instead. A `!` in the title applies the `breaking` label. Every other label is a human judgement, described in [the labels reference](https://github.com/canonical/pragma-web/blob/main/docs/references/LABELS.md).

## 3. Fill the body

- **Fill in `.github/PULL_REQUEST_TEMPLATE.md`**: Done, QA and the readiness checklist, ticked honestly.
- **The body stands on its own.** It cites no internal planning document: no decision-record numbers, planning ledgers, private tracker keys, or paths into a repository the reader may not be able to open. Outside contributors and other teams review these pull requests. State what the change does and why, in full, in the body itself.
- **When merge order matters, name the pull request that must land first and say why in one line.** Name it by number in this repository, and in full in the other one, for example `canonical/pragma-core#123`. The two halves of a change that spans both repositories name each other this way.
- **A new package** carries the first-publish steps that `.kb/publishing.md` describes.

## 4. Apply this repository's pull-request steps

`.kb/this-repository.md` names the steps specific to this repository. Apply them.

## 5. Answer and resolve every review thread

Answer and resolve every review thread, including those from automated reviewers such as Copilot, before the pull request merges.

## 6. Merge

- **The pull request is squash-merged.** In pragma-core the squash commit takes the pull request title, with a blank body. In pragma-web it takes the commit's subject when the pull request has one commit, and the pull request title otherwise, with the commit messages as its body.
- **For a large or breaking change, edit the squash message** so it reads for consumers.
