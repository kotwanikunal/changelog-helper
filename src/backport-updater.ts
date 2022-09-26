import readline from 'readline'
import fs from 'fs'
import {EOL} from 'os'
import {exec} from '@actions/exec'

const DIFF_CHANGELOG_REGEX = new RegExp(
  /^diff --git (.)*(CHANGELOG)(.)*(CHANGELOG)(.)*/
)
const DIFF_REGEX = new RegExp(/^@@ (-\d+,\d+)*(\s)*(\+*\d+,\d+)(.)*/)
const DEPENDENCY_SECTION_REGEX = new RegExp(/^### [a-zA-Z]+/)
const VERSION_REGEX = new RegExp(/^## \[(.)*\]/)
const CHANGELOG_ENTRY_PR_NUMBER_REGEX = new RegExp(
  /(^-)(.*)(\[#)(\d{4,6})(.*)(\d{4,6})(.*)/
)

interface ParsedResult {
  changelogLineNumber: number
  versionFound: boolean
  sectionFound: boolean
  contents: string[]
}

interface ChangelogResult {
  sectionName: string
  changelogEntry: string
}

async function fetchOriginalPullRequestDiff(
  token: string,
  owner: string,
  repo: string,
  originalPullRequestNumber: number,
  diffFilePath: fs.PathLike
): Promise<void> {
  await exec('curl', [
    `https://x-access-token:${token}@github.com/${owner}/${repo}/pull/${originalPullRequestNumber}.diff`,
    '-L',
    '--output',
    `${diffFilePath}`
  ])
}

async function extractGitDiffLocation(
  changelogPath: fs.PathLike
): Promise<number> {
  const fileStream = readline.createInterface({
    input: fs.createReadStream(changelogPath),
    terminal: false
  })

  let changelogLineNumber = 0
  let changelogDiffFound = false
  let lineNumberDiffStatementFound = false

  // The module used to insert a line back to the CHANGELOG is 1-based offset instead of 0-based
  for await (const line of fileStream) {
    if (DIFF_CHANGELOG_REGEX.test(line)) {
      changelogDiffFound = true
    }

    if (changelogDiffFound && DIFF_REGEX.test(line)) {
      const match = DIFF_REGEX.exec(line)
      if (match) {
        changelogLineNumber = Number.parseInt(
          match[3].split(',')[0].substring(1)
        )
        lineNumberDiffStatementFound = true
      }
    }

    if (lineNumberDiffStatementFound) {
      if (line.startsWith('+')) {
        break
      }
      changelogLineNumber++
    }
  }

  return changelogLineNumber - 1
}

async function parseOriginalChangelog(
  changelogPath: fs.PathLike,
  changeLineNumber: number
): Promise<ChangelogResult> {
  const fileStream = readline.createInterface({
    input: fs.createReadStream(changelogPath),
    terminal: false
  })

  let lineNumber = 1
  let sectionName = ''
  let changelogEntry = ''

  for await (const line of fileStream) {
    if (DEPENDENCY_SECTION_REGEX.test(line)) {
      sectionName = line
    }

    if (lineNumber === changeLineNumber) {
      changelogEntry = line
      break
    }
    lineNumber++
  }

  return {sectionName, changelogEntry}
}

async function fetchOriginalPullRequest(
  token: string,
  owner: string,
  repo: string,
  pullRequestNumber: number
): Promise<void> {
  await exec('git', [
    'clone',
    `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
  ])

  await exec(
    'git',
    [
      'fetch',
      'origin',
      `pull/${pullRequestNumber}/head:PR#${pullRequestNumber}`
    ],
    {cwd: repo}
  )
  await exec('git', ['checkout', `PR#${pullRequestNumber}`], {cwd: repo})
}

async function parseChangelogForEntry(
  versionRegex: RegExp,
  sectionName: string,
  changelogPath: fs.PathLike
): Promise<ParsedResult> {
  const fileStream = readline.createInterface({
    input: fs.createReadStream(changelogPath),
    terminal: false
  })

  let lineNumber = 0
  let changelogLineNumber = 0
  let versionFound = false
  let sectionFound = false
  let foundLastEntry = false

  const contents = []

  // The module used to insert a line back to the CHANGELOG is 1-based offset instead of 0-based
  for await (const line of fileStream) {
    contents.push(line)

    // If we have found the line to update, the last line to add the entry after, or have found
    // a duplicate line, just push the line
    if (foundLastEntry || sectionFound) {
      continue
    }

    if (versionFound && line === sectionName) {
      sectionFound = true
      changelogLineNumber = lineNumber + 1
    }

    if (!versionFound && versionRegex.test(line)) {
      versionFound = true
      changelogLineNumber = lineNumber + 1
    }

    foundLastEntry = versionFound && sectionFound && VERSION_REGEX.test(line)
    if (foundLastEntry) {
      changelogLineNumber = lineNumber
    }
    lineNumber++
  }

  return {
    changelogLineNumber,
    versionFound,
    sectionFound,
    contents
  }
}

function addNewEntry(
  entry: string,
  sectionName: string,
  version: string,
  newVersionLineNumber: number,
  changelogPath: fs.PathLike,
  result: ParsedResult
): void {
  let lineNumber = result.changelogLineNumber
  if (!result.sectionFound) {
    entry = `${sectionName}${EOL}${entry}`
  }
  if (!result.versionFound) {
    entry = `## [${version}]${EOL}${entry}${EOL}`
    lineNumber = newVersionLineNumber
  }
  writeEntry(lineNumber, changelogPath, entry, result.contents)
}

function writeEntry(
  lineNumber: number,
  changelogPath: fs.PathLike,
  changelogEntry: string,
  contents: string[]
): void {
  const length = contents.push('')
  for (let i = length - 1; i > lineNumber; i--) {
    contents[i] = contents[i - 1]
  }
  contents[lineNumber] = changelogEntry
  fs.writeFileSync(changelogPath, contents.join(EOL).concat(EOL))
}

function buildVersionRegex(version: string): RegExp {
  return new RegExp(`^## \\[${version}\\]`)
}

function updateChangelogEntry(entry: string, backportPRNumber: number): string {
  if (CHANGELOG_ENTRY_PR_NUMBER_REGEX.test(entry)) {
    let updatedEntry = ''
    const match = CHANGELOG_ENTRY_PR_NUMBER_REGEX.exec(entry)
    process.stdout.write(`${match}\n`)
    if (match) {
      updatedEntry = updatedEntry.concat(match[1])
      updatedEntry = updatedEntry.concat(match[2])
      updatedEntry = updatedEntry.concat(match[3])
      updatedEntry = updatedEntry.concat(`${backportPRNumber}`)
      updatedEntry = updatedEntry.concat(match[5])
      updatedEntry = updatedEntry.concat(`${backportPRNumber}`)
      updatedEntry = updatedEntry.concat(match[7])
    }
    return updatedEntry
  }

  return entry
}

export async function backportChangelog(
  backportVersion: string,
  backportPullRequestNumber: number,
  originalPullRequestNumber: number,
  githubToken: string,
  owner: string,
  repo: string,
  newVersionLineNumber: number,
  changelogPath: string
): Promise<void> {
  const originalChangelogLocation = `./${repo}/${changelogPath}`
  const versionRegex: RegExp = buildVersionRegex(backportVersion)

  const diffFilePath = `PR#${originalPullRequestNumber}.diff`

  await fetchOriginalPullRequestDiff(
    githubToken,
    owner,
    repo,
    originalPullRequestNumber,
    diffFilePath
  )

  const originalChangeLineNumber = await extractGitDiffLocation(diffFilePath)

  await fetchOriginalPullRequest(
    githubToken,
    owner,
    repo,
    originalPullRequestNumber
  )

  const originalChangelogEntry = await parseOriginalChangelog(
    originalChangelogLocation,
    originalChangeLineNumber
  )

  const changelogParsedResult: ParsedResult = await parseChangelogForEntry(
    versionRegex,
    originalChangelogEntry.sectionName,
    changelogPath
  )

  const updatedEntry = updateChangelogEntry(
    originalChangelogEntry.changelogEntry,
    backportPullRequestNumber
  )

  addNewEntry(
    updatedEntry,
    originalChangelogEntry.sectionName,
    backportVersion,
    newVersionLineNumber,
    changelogPath,
    changelogParsedResult
  )
}
