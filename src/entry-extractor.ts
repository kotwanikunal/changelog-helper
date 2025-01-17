import {WebhookPayload} from '@actions/github/lib/interfaces'

/** Regex explanation
 *                                 --- Matches Bump or Bumps
 *                                 |     --- Matches any non-whitespace character; matching as a few as possible
 *                                 |     |          --- Matches any non-whitespace character
 *                                 |     |          |          --- Matches any non-whitespace character
 *                                 |     |          |          |
 */
const TITLE_REGEX = new RegExp(/Bumps? (\S+?) from (\S*) to (\S*)/)

export interface DependabotEntry {
  pullRequestNumber: number
  package: string
  oldVersion: string
  newVersion: string
}

export interface BackportEntry {
  pullRequestNumber: number
  repo: string
  owner: string
}

export function getDependabotEntry(event: WebhookPayload): DependabotEntry {
  const pullRequestNumber: number = event.pull_request!.number
  const titleResult = TITLE_REGEX.exec(event.pull_request!.title)
  if (titleResult === null) {
    throw new Error('Unable to extract entry from pull request title!')
  }

  return {
    pullRequestNumber,
    package: titleResult[1],
    oldVersion: titleResult[2],
    newVersion: titleResult[3]
  }
}

export function getBackportEntry(event: WebhookPayload): BackportEntry {
  const pullRequestNumber: number = event.pull_request!.number
  const repo: string = event.repository!.name
  const owner: string = event.repository!.owner.login

  return {
    pullRequestNumber,
    repo,
    owner
  }
}
