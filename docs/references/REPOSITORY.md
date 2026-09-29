# REPOSITORY — how this repository is configured on GitHub

What is set on GitHub for `canonical/pragma-core`, and why. Changing any of it is an
administrator's act; this file changes in the same pull request, or right after.

## Settings

| Setting | Value | Why |
|---|---|---|
| Merge methods | squash only | one commit per pull request on `main` |
| Squash commit subject | the pull request title | the title is the subject that lands on `main`, and it is what the conventional-commit check reads |
| Squash commit body | blank | the branch's commits would otherwise repeat their trailers in the squashed message |
| Delete the branch after merging | on | |
| Allow auto-merge | on | the Coda sync's pull requests merge themselves when their checks are green |
| Always suggest updating the branch | on | |
| Workflow permissions | read-only token; workflows cannot approve pull requests | a job that needs more asks for it in its own `permissions` |
| Actions | must be pinned to a full commit SHA | a tag can be moved to other code; a commit cannot |

## Rules for `main`

| Rule | Why |
|---|---|
| A pull request is required, with 0 approvals | a sole maintainer cannot approve their own pull request; review is asked for, not counted |
| Conversations must be resolved | |
| Squash merge only | |
| No force push, no deletion | |
| Required status check: `build-gate` | a bar that no machine enforces is not on |
| The only bypass is the release deploy key; administrators have none | a protection the owner can walk past is not on. The one way around the rules is to edit them, which the organisation's audit log records |

The release deploy key bypasses the rules because the release job pushes the version commit and its
tag straight to `main`.

## Environments and their secrets

Both environments can be deployed from `main` only, so a job on a pull request branch cannot read
their secrets.

| Environment | Secret | Used by |
|---|---|---|
| `release` | `DEPLOY_KEY` | `tag.yml`'s version job, which checks out with it and pushes the version commit and tag |
| `sync` | `SUPERHUMAN_DOCS_API_KEY` | the Coda sync (`sync-coda.yml`), to read the Coda document |
| `sync` | `SUPERHUMAN_DOCS_SYNC_TOKEN` | the Coda sync, to push its branch and open its pull request. It is a fine-grained personal access token limited to this repository, with Contents and Pull requests read and write; an organisation-owned GitHub App replaces it when one is available. A push or pull request made with the workflow's own token starts no workflows, so CI would never run on the sync pull request and auto-merge would never complete |

The publish job needs no secret: npm trusted publishing gives it a short-lived token through OIDC.

## Rotating a secret

**The release deploy key.** Generate a new key pair, add its public half as a deploy key with write
access, store its private half in the `release` environment, delete the old deploy key, and delete
the local files:

```bash
ssh-keygen -t ed25519 -N "" -C "pragma-core release" -f release_key
gh repo deploy-key add release_key.pub --repo canonical/pragma-core --title "release" --allow-write
gh secret set DEPLOY_KEY --repo canonical/pragma-core --env release < release_key
gh repo deploy-key list --repo canonical/pragma-core      # find the old key's id
gh repo deploy-key delete <old-key-id> --repo canonical/pragma-core
rm release_key release_key.pub
```

**The sync token.** Regenerate the token on its settings page (or create a new one with the same
scope), store it in the `sync` environment, then revoke the old one:

```bash
gh secret set SUPERHUMAN_DOCS_SYNC_TOKEN --repo canonical/pragma-core --env sync
```

**The Coda API key.** Create a new key in Coda, store it, then revoke the old one in Coda:

```bash
gh secret set SUPERHUMAN_DOCS_API_KEY --repo canonical/pragma-core --env sync
```
