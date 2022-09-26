import {PathLike} from 'fs'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {
  BackportEntry,
  DependabotEntry,
  getBackportEntry,
  getDependabotEntry
} from './entry-extractor'
import {updateChangelog} from './dependabot-updater'
import {backportChangelog} from './backport-updater'

async function run(): Promise<void> {
  try {
    const version: string = core.getInput('version')
    const changelogPath: PathLike = core.getInput('changelogPath')
    const labelPattern: string = core.getInput('activationLabel')
    const backportHelper: string = core.getInput('backportHelper')

    // Line numbers in files are read as 1-indexed, but we deal with contents as 0-indexed
    const newVersionLineNumber =
      Number(core.getInput('newVersionLineNumber')) - 1

    if (
      labelPattern !== '' &&
      (labelPattern === '*' || pullRequestMatchesLabel(labelPattern))
    ) {
      const entry: DependabotEntry = getDependabotEntry(github.context.payload)
      await updateChangelog(entry, version, newVersionLineNumber, changelogPath)
    }

    if (backportHelper) {
      const githubToken: string = core.getInput('githubToken')
      const originalPRNumber: number = Number.parseInt(
        core.getInput('originalPRNumber')
      )
      const entry: BackportEntry = getBackportEntry(github.context.payload)
      backportChangelog(
        version,
        entry.pullRequestNumber,
        originalPRNumber,
        githubToken,
        entry.owner,
        entry.repo,
        newVersionLineNumber,
        changelogPath
      )
    }
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

function pullRequestMatchesLabel(labelPattern: string): boolean {
  let matches = false
  getPullRequestLabels().array.forEach(label => {
    matches = matches || labelPattern.test(label)
  })
  return matches
}

function getPullRequestLabels(): string[] {
  return github.context.payload.pull_request!.labels.map(
    (l: {name?: string}) => l.name
  )
}

run()
