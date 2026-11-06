// The panel's data, fetched through the generated Connect client.
//
// Every call reads the LOCAL workspace. Nothing here reaches api.github.com: the checkout is
// already on disk, and it is the only source that includes this session's own edits.

import { client } from './client.js'
import {
  type Comment as CommentProto,
  type FileChange as FileChangeProto,
  type IssueSummary as IssueSummaryProto,
  type JobSummary as JobSummaryProto,
  MirrorState as MirrorStateProto,
  type RunSummary as RunSummaryProto,
  type WorkflowSummary as WorkflowSummaryProto,
} from './gen/ui/v1/ui_pb.js'

export interface Workspace {
  id: string
  repo: string
  branch: string
  /**
   * Which conversation this checkout belongs to.
   *
   * Present because the list can span sessions: an extension opened from its own tab has no session
   * to narrow by, so it shows every checkout the tenant owns and the reader needs to see where each
   * one came from.
   */
  session?: string
}

export interface TreeEntry {
  path: string
  dir?: boolean
}

/** One issue on GitHub. `isPullRequest` is reported because GitHub numbers both in one sequence. */
export interface IssueView {
  number: number
  title: string
  state: string
  body: string
  author: string
  url: string
  labels: string[] | null
  isPullRequest: boolean
  /** How many comments, so a list need not fetch each conversation. */
  comments: number
}

export interface CommentView {
  id: number
  author: string
  body: string
  when: string
}

/** One workflow run. `conclusion` is empty while it is still going. */
export interface RepoSummary {
  fullName: string
  description: string
  private: boolean
  archived: boolean
  fork: boolean
  defaultBranch: string
}

/**
 * What the MIRROR has for a repository.
 *
 * THREE STATES, because "exists" and "can be opened" are different: a repository created without an
 * initial commit is real, writable, and has no branches — so a boolean would mark it openable and the
 * reader would land on an empty page.
 */
export type MirrorState = 'ready' | 'empty' | 'missing'

/** One branch or tag in the mirror. */
export interface Ref {
  name: string
  commit: string
  /** "branch" or "tag" — one dropdown lists both, grouped by this. */
  kind: string
}

export interface OrgSummary {
  login: string
  description: string
}

export interface ReleaseSummary {
  tag: string
  name: string
  draft: boolean
  prerelease: boolean
  publishedAt: string
  url: string
  body: string
  assets: number
}

export interface WorkflowSummary {
  id: number
  name: string
  path: string
  state: string
}

export interface RunView {
  id: number
  name: string
  status: string
  conclusion: string
  branch: string
  event: string
  headSha: string
  url: string
  createdAt: string
  attempt: number
  done: boolean
}

/** One step of a job, as GitHub reports it while the job is running. */
export interface StepView {
  name: string
  status: string
  conclusion: string
  number: number
}

export interface JobView {
  id: number
  name: string
  status: string
  conclusion: string
  startedAt: string
  url: string
  steps: StepView[] | null
  /** False while the job runs: GitHub publishes a job's log only once it has finished. */
  logAvailable: boolean
}

export interface FileBody {
  path: string
  size: number
  binary?: boolean
  content?: string
}

export interface Change {
  Path: string
  Status: string
  Staged?: boolean
}

export interface LogEntry {
  Hash?: string
  Message?: string
  Author?: string
  When?: string
}

export const api = {
  // THE LAYER ABOVE A REPOSITORY. These answer "what is there" — the question a reader has before
  // the panel can show them anything about a repository.
  repos: async (org = '') => (await client.listRepos({ org })).repos,
  /**
   * Which of these repositories the MIRROR has.
   *
   * The home page lists the UPSTREAM's repositories and the Files page reads the MIRROR's; they are
   * different systems with different contents. Asking once for the whole page is what lets a row say
   * "not mirrored" instead of 404ing when clicked.
   *
   * The response is an ENUM per repository, not a boolean: a repository created with no commits
   * exists, answers 200, and has no tree — so a boolean would mark it openable and the reader would
   * get an empty page. UNSPECIFIED is the proto3 zero value and reads as "not mirrored".
   */
  mirrored: async (repos: string[]) => {
    const r = await client.listMirrored({ repos })
    // The panel's own three-value type, kept rather than passing the protobuf enum through: every
    // component already switches on these strings, and an enum would change all of them for no gain.
    const out: Record<string, MirrorState> = {}
    for (const [name, state] of Object.entries(r.mirrored)) {
      out[name] =
        state === MirrorStateProto.READY
          ? 'ready'
          : state === MirrorStateProto.EMPTY
            ? 'empty'
            : 'missing'
    }
    return out
  },
  /**
   * Create a mirror of one repository from its upstream.
   *
   * Slow by nature — it creates the repository and fetches a branch into it — so the caller shows
   * progress rather than a spinner that could be a hang.
   */
  establish: async (repo: string) => {
    const r = await client.establish({ repo })
    return {
      repo: r.repo,
      mirroredAs: r.mirroredAs,
      branch: r.branch,
      commit: r.commit,
    }
  },
  orgs: async () => (await client.listOrgs({})).orgs,
  whoami: async () => (await client.getWhoami({})).login,
  releases: async (repo: string, limit = 20) =>
    (await client.listReleases({ repo, limit })).releases,
  workflows: async (repo: string) =>
    (await client.listWorkflows({ repo })).workflows.map(workflowView),
  // THE MIRROR. These read the forge, not a local checkout: there is no checkout any more, and the
  // mirror is where a change is made, so it is what a reader wants to see while making one.
  tree: async (repo: string, branch: string, dir: string) =>
    (await client.listDir({ repo, branch, dir })).entries,
  file: async (repo: string, branch: string, path: string) => {
    const r = await client.getFile({ repo, branch, path })
    return {
      path: r.path,
      branch: r.branch,
      revision: r.revision,
      content: r.content,
      size: Number(r.size),
    }
  },
  repoInfo: async (repo: string) => {
    const r = await client.getRepo({ repo })
    return {
      repo: r.repo,
      branches: r.branches,
      defaultBranch: r.defaultBranch,
      tags: r.tags,
    }
  },
  /** Every branch and tag, with the kind, so one dropdown can switch between both. */
  refs: async (repo: string) => (await client.listRefs({ repo })).refs,
  // Pull requests. These read the UPSTREAM rather than a local checkout: a pull request is not on
  // disk, and a PAGE shows the current state where a card replays what a tool already returned.
  pull: async (repo: string, number: number) => {
    const p = (await client.getPull({ repo, number })).pull
    if (!p) throw new Error('the server returned no pull request')
    return p
  },
  pullFiles: async (repo: string, number: number) =>
    (await client.listPullFiles({ repo, number })).files.map(pullFile),
  pullDiff: async (repo: string, number: number) =>
    (await client.getPullDiff({ repo, number })).diff,
  pullChecks: async (repo: string, number: number) => {
    const r = await client.getPullChecks({ repo, number })
    return { state: r.state, sha: r.sha, checks: r.checks }
  },
  // Issues. The upstream numbers issues and pull requests in one sequence, so the same call answers
  // for both and says which it is.
  issue: async (repo: string, number: number) => {
    const i = (await client.getIssue({ repo, number })).issue
    if (!i) throw new Error('the server returned no issue')
    return issueView(i)
  },
  issueComments: async (repo: string, number: number) =>
    (await client.listIssueComments({ repo, number })).comments.map(commentView),
  // Issues OR pull requests. One query with a filter, applied on the SERVER so a caller cannot forget
  // it — and a `kind` that is neither is refused rather than silently ignored.
  issues: async (repo: string, kind: 'issue' | 'pr', state = 'open', limit = 50) =>
    (await client.listIssues({ repo, kind, state, limit })).items.map(issueView),
  // CI runs. The log is fetched PER JOB and only when asked: a run's logs are megabytes, and a page
  // that fetched them all would be slow for a reader who wanted one job.
  runs: async (repo: string, limit = 20) =>
    (await client.listRuns({ repo, limit })).runs.map(runView),
  run: async (repo: string, id: number) => {
    const r = (await client.getRun({ repo, id: BigInt(id) })).run
    if (!r) throw new Error('the server returned no run')
    return runView(r)
  },
  runJobs: async (repo: string, id: number) =>
    (await client.listRunJobs({ repo, id: BigInt(id) })).jobs.map(jobView),
  jobLog: async (repo: string, job: number) =>
    (await client.getJobLog({ repo, jobId: BigInt(job) })).log,
}

// ---------------------------------------------------------------------------
// proto -> the panel's own types
//
// WHY CONVERT RATHER THAN USE THE PROTO TYPES DIRECTLY: proto3 spells int64 as bigint, and every
// component here already treats ids as numbers — they are compared, put in URLs, and used as map keys.
// Switching all of them to bigint would change a dozen files to gain nothing: these ids are git hashes'
// neighbours, run numbers and file sizes, nowhere near 2^53.
//
// THE CONVERSION IS WHERE THE TWO SHAPES ARE RECONCILED, and it is checked: a field renamed in the
// proto fails type-checking here, on the way into these functions, rather than becoming `undefined`
// in a component three files away.
// ---------------------------------------------------------------------------

function numOf(v: bigint | number): number {
  return typeof v === 'bigint' ? Number(v) : v
}

function runView(r: RunSummaryProto): RunView {
  return {
    id: numOf(r.id),
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    branch: r.branch,
    event: r.event,
    headSha: r.headSha,
    url: r.url,
    createdAt: r.createdAt,
    attempt: r.attempt,
    done: r.done,
  }
}

function jobView(j: JobSummaryProto): JobView {
  return {
    id: numOf(j.id),
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    startedAt: j.startedAt,
    url: j.url,
    logAvailable: j.logAvailable,
    steps: j.steps.map(s => ({
      name: s.name,
      status: s.status,
      conclusion: s.conclusion,
      number: s.number,
    })),
  }
}

function issueView(i: IssueSummaryProto): IssueView {
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    body: i.body,
    author: i.author,
    url: i.url,
    labels: i.labels,
    isPullRequest: i.isPullRequest,
    comments: i.comments,
  }
}

function commentView(c: CommentProto): CommentView {
  return { id: numOf(c.id), author: c.author, body: c.body, when: c.when }
}

function workflowView(w: WorkflowSummaryProto): WorkflowSummary {
  return { id: numOf(w.id), name: w.name, path: w.path, state: w.state }
}

function pullFile(f: FileChangeProto): PullFile {
  return {
    path: f.path,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
    patch_truncated: f.patchTruncated,
  }
}

/** A pull request as the page shows it. */
export interface PullView {
  number: number
  title: string
  state: string
  author: string
  body: string
  head: string
  base: string
  url: string
  draft: boolean
  merged: boolean
  created: string
}

/** One changed file. `patch_truncated` distinguishes "no diff given" from "no change". */
export interface PullFile {
  path: string
  status: string
  additions: number
  deletions: number
  patch: string
  patch_truncated: boolean
}

export interface PullChecks {
  state: string
  sha: string
  checks: Array<{ name: string; status: string }> | null
}
