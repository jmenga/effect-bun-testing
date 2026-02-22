# Publishing

This project uses [changesets](https://github.com/changesets/changesets) for version management and automated publishing via GitHub Actions.

## How it works

1. **You make changes** and create a changeset describing what changed
2. **You open a PR** — CI runs typechecks and tests
3. **PR merges to main** — the release workflow runs automatically
4. The workflow bumps `package.json`, updates `CHANGELOG.md`, commits the version bump, publishes to NPM, and creates a GitHub release with a git tag

One merge = one release. No intermediate "version packages" PR.

## Creating a changeset

After making changes, run:

```bash
bun run changeset
```

This prompts you to:
- Select the package (auto-selected in single-package repos)
- Choose the semver bump type (patch / minor / major)
- Write a summary of the change

This creates a markdown file in `.changeset/` (e.g., `.changeset/funny-dogs-dance.md`). Commit this file alongside your code changes.

### Example changeset file

```markdown
---
"@jmenga/effect-bun-test": minor
---

Add Schema-to-Arbitrary conversion for property-based testing
```

## Manual publishing (without CI)

If you need to publish manually:

```bash
npm login                # authenticate with NPM (one-time)
bun run version          # consume changesets, bump version, update CHANGELOG
git add -A && git commit -m "chore: version packages"
bun run release          # build and publish to NPM
git push                 # push the version bump commit
```

## GitHub repository setup

### 1. Create the repository

```bash
gh repo create jmenga/effect-bun-test --public --source=. --push
```

Or if the repo already exists:

```bash
git remote add origin git@github.com:jmenga/effect-bun-test.git
git push -u origin main
git push -u origin v3
```

### 2. Add repository secrets

Two secrets are required:

#### NPM_TOKEN

The release workflow needs an NPM access token to publish.

1. **Create an NPM access token:**
   - Go to https://www.npmjs.com/settings/~/tokens
   - Click "Generate New Token" → "Granular Access Token"
   - Token name: `github-actions-effect-bun-test`
   - Expiration: choose your preference
   - Packages and scopes: "Read and write", scoped to `@jmenga/effect-bun-test`
   - Click "Generate Token" and copy the value

2. **Add the token to GitHub:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: paste the token from step 1
   - Click "Add secret"

#### AWS_BEARER_TOKEN_BEDROCK

The issue triage workflow uses Claude via AWS Bedrock to automatically review and triage new issues.

1. **Create a Bedrock API key** in the [AWS Bedrock console](https://console.aws.amazon.com/bedrock/) (us-east-1)
2. **Add to GitHub as a secret:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `AWS_BEARER_TOKEN_BEDROCK`
   - Value: paste the Bedrock API key
   - Click "Add secret"

#### AWS_REGION (variable)

1. **Add to GitHub as a variable** (not a secret):
   - Go to your repo → Settings → Secrets and variables → Actions → Variables tab
   - Click "New repository variable"
   - Name: `AWS_REGION`
   - Value: `us-east-1`
   - Click "Add variable"

### 3. Workflow permissions

The release workflow needs these GitHub token permissions (already configured in the workflow file):

- **contents: write** — to push version bump commits, create tags, and create GitHub releases
- **id-token: write** — for NPM provenance (optional, proves the package was built by CI)

Ensure your repository's Actions permissions allow these:
- Go to repo → Settings → Actions → General
- Under "Workflow permissions", select **"Read and write permissions"**
- Check **"Allow GitHub Actions to create and approve pull requests"**

### 4. Branch protection (recommended)

For the `main` branch:
- Require pull request reviews before merging
- Require status checks to pass (select the "Typecheck & Test" check)
- This ensures all changes go through CI before merging

## Releasing the v3 branch

The release workflow is configured for `main` only. To release from the `v3` branch:

**Option A: Manual release**
```bash
git checkout v3
bun install
bun run changeset
# commit the changeset
bun run version
# commit the version bump
bun run release
git push
```

**Option B: Add v3 to the release workflow**

Add `v3` to the `push.branches` array in `.github/workflows/release.yml`:
```yaml
on:
  push:
    branches: [main, v3]
```

Then add the `NPM_TOKEN` secret (same steps as above — the same token works for both branches).

When publishing from v3, use a dist-tag to avoid overwriting the `latest` tag:
- In `.changeset/config.json` on the v3 branch, the `baseBranch` is already set to `"v3"`
- Changesets will handle versioning independently on each branch

## Issue triage

New issues are automatically triaged by Claude via the `.github/workflows/triage.yml` workflow. When an issue is opened, Claude:

1. Reads the issue and the relevant source code
2. Takes one of these actions:
   - **Needs info** — comments with clarifying questions, labels `triage/needs-info`
   - **Won't fix** — comments explaining why, labels `triage/wont-fix`, closes the issue
   - **Can fix** — labels `triage/valid`, creates a branch with the fix, opens a PR
   - **Needs human** — labels `triage/valid` and `triage/human-review`, comments with analysis

Create these labels in your repository (Settings → Labels):

| Label | Color | Description |
|---|---|---|
| `triage/needs-info` | `#d4c5f9` | More information needed from reporter |
| `triage/valid` | `#0e8a16` | Issue confirmed as valid |
| `triage/wont-fix` | `#e4e669` | Issue will not be addressed |
| `triage/human-review` | `#fbca04` | Requires human decision |

Requires the `AWS_BEARER_TOKEN_BEDROCK` secret and `AWS_REGION` variable (see setup above).

## Changelog format

Changelogs are generated using `@changesets/changelog-github`, which links to the PR and commit that introduced each change. This requires the repository to be hosted on GitHub.
