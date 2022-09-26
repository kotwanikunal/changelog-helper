## Dependabot/Backport Changelog Helper

### We All Love Dependabot...
But sometimes it can feel overwhelming and require additional work to update things like versions and changelogs.

**The purpose of this action is to help you easily manage some of those needs by auto-updating your changelog!**

Built around the [Keep-a-Changelog](https://keepachangelog.com/) format, this action will look for an entry line for an updated package and either

* Add it if not found (including adding the `### Dependencies` and `## [<version>]` sections!)
* Update it if the package has been upgraded after an initial entry was written

### Backporting PRs

* In case of a backported PR, it will extract the changelog line from the original pull request and add a new entry in the current version within the appropriate section.

### Usage

#### Example Workflow

```yaml
name: 'pull-request'
on:
  pull_request:
    types:
      - opened
      - synchronize
      - reopened
      - ready_for_review
      - labeled
      - unlabeled

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          # Depending on your needs, you can use a token that will re-trigger workflows
          # See https://github.com/stefanzweifel/git-auto-commit-action#commits-of-this-action-do-not-trigger-new-workflow-runs
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: ./
        with:
          version: ${{ needs.setup.outputs.version }}
          newVersionLineNumber: 3
          activationLabel: 'dependabot'
          changelogPath: './CHANGELOG.md'
          backportHelper: true
          originalPRNumber: 1234
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs / Properties
Below are the properties allowed by the Dependabot Changelog Helper.

#### `version`
* Default: `UNRELEASED`
* The version to find in the changelog to add dependabot entries to.

#### `changeLogPath`
* Default: `./CHANGELOG.md`
* The path to the changelog file to add dependabot entries to.

#### `activationLabel`
* Default: `dependabot`
* The label to indicate that the action should run

#### `newVersionLineNumber`
* Default: 3
* If the desired version is not found in the file, this is the default line number (1-indexed) in which to place the new version

### `backportHelper`
* Default: `false`
* Flag to indicate if the helper needs to process a backport request.

### `originalPRNumber`
* The PR number using which the change was merged into the original version in case of a backport.

### `githubToken`
* Token for the GitHub API.
