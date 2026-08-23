import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createSightlineTool, findRepositoryRoot } from '../src/index.js'
import type { DshSessionEventView, DshSessionView, SightlineReport } from '../src/index.js'

test('DSH sightline tool returns the first real three-column report for its live session', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-sightline-host-'))
  try {
    const repositoryRoot = path.join(root, 'repo')
    const cwd = path.join(repositoryRoot, 'packages', 'api')
    const codexHome = path.join(root, 'codex-home')
    const claudeHome = path.join(root, 'claude-home')

    await mkdir(path.join(repositoryRoot, '.git'), { recursive: true })
    await mkdir(cwd, { recursive: true })
    await mkdir(codexHome, { recursive: true })
    await mkdir(claudeHome, { recursive: true })

    await put(repositoryRoot, 'AGENTS.md', 'Root instructions shared by DSH and Codex.')
    await put(repositoryRoot, 'CLAUDE.md', 'Root instructions shared by DSH and Claude.')
    await put(repositoryRoot, 'packages/api/AGENTS.md', 'API instructions shared by DSH and Codex.')
    await put(repositoryRoot, '.claude/rules/always.md', 'Claude-only always-loaded rule.')

    const session = dshSession(cwd, [
      instructionEvent(1, {
        baseline: true,
        baselineIdentity: '{"projectRoot":"repo"}',
        changes: [
          { action: 'set', scope: '.\u0000AGENTS.md', path: 'AGENTS.md', digest: 'dsh-root-agents' },
          { action: 'set', scope: '.\u0000CLAUDE.md', path: 'CLAUDE.md', digest: 'dsh-root-claude' },
          {
            action: 'set',
            scope: 'packages/api\u0000AGENTS.md',
            path: 'packages/api/AGENTS.md',
            digest: 'dsh-api-agents',
          },
        ],
      }),
    ])

    const tool = createSightlineTool({ codexHome, claudeHome })
    const value = await tool.execute(
      {},
      {
        agent: { session },
        signal: new AbortController().signal,
      } as never,
    )
    const report = value as unknown as SightlineReport

    assert.equal(report.repositoryRoot, repositoryRoot)
    assert.equal(report.cwd, cwd)
    assert.equal(report.surfaces.dsh.evidence, 'observed')
    assert.equal(report.surfaces.codex.evidence, 'predicted')
    assert.equal(report.surfaces['claude-code'].evidence, 'predicted')

    assert.deepEqual(
      report.surfaces.dsh.sources.map((source) => source.sourceKey),
      ['repo:AGENTS.md', 'repo:CLAUDE.md', 'repo:packages/api/AGENTS.md'],
    )
    assert.deepEqual(
      report.surfaces.codex.sources.map((source) => source.sourceKey),
      ['repo:AGENTS.md', 'repo:packages/api/AGENTS.md'],
    )
    assert.deepEqual(
      report.surfaces['claude-code'].sources.map((source) => source.sourceKey),
      ['repo:CLAUDE.md', 'repo:.claude/rules/always.md'],
    )

    assertPresence(report, 'repo:AGENTS.md', ['present', 'present', 'absent'])
    assertPresence(report, 'repo:CLAUDE.md', ['present', 'absent', 'present'])
    assertPresence(report, 'repo:packages/api/AGENTS.md', ['present', 'present', 'absent'])
    assertPresence(report, 'repo:.claude/rules/always.md', ['absent', 'absent', 'present'])

    const rendered = tool.output.render({}, value)
    assert.equal(rendered.length, 1)
    assert.equal(rendered[0]?.type, 'text')
    if (rendered[0]?.type !== 'text') throw new Error('Sightline tool did not render text output')
    assert.match(rendered[0].text, /DSH \(Observed\)/)
    assert.match(rendered[0].text, /Codex \(Predicted\)/)
    assert.match(rendered[0].text, /Claude \(Predicted\)/)
    assert.match(rendered[0].text, /AGENTS\.md/)
    assert.match(rendered[0].text, /\.claude\/rules\/always\.md/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('repository-root discovery matches the DSH-style nearest marker contract', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-sightline-root-'))
  try {
    const repositoryRoot = path.join(root, 'repo')
    const cwd = path.join(repositoryRoot, 'packages', 'api')
    await mkdir(path.join(repositoryRoot, '.git'), { recursive: true })
    await mkdir(cwd, { recursive: true })

    assert.equal(await findRepositoryRoot(cwd), repositoryRoot)

    const standalone = path.join(root, 'standalone')
    await mkdir(standalone, { recursive: true })
    assert.equal(await findRepositoryRoot(standalone), standalone)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('DSH sightline tool rejects executions without an owning live agent', async () => {
  const tool = createSightlineTool()
  await assert.rejects(
    () => tool.execute({}, { signal: new AbortController().signal } as never),
    /requires an agent-owned DSH tool execution/,
  )
})

function dshSession(cwd: string, events: readonly DshSessionEventView[]): DshSessionView {
  return {
    header: { cwd },
    events,
    surface: { nodes: events.map((event) => event.seq) },
  }
}

function instructionEvent(
  seq: number,
  source: {
    baseline?: true
    baselineIdentity?: string
    changes: readonly {
      action: 'set' | 'replace' | 'remove'
      scope: string
      path: string
      digest?: string
    }[]
  },
): DshSessionEventView {
  return {
    seq,
    type: 'user/message',
    data: {
      role: 'user',
      id: `sightline-fixture-${seq}`,
      content: [{ type: 'text', text: '<system-reminder>fixture</system-reminder>' }],
      source: {
        kind: 'agent-instructions',
        form: 'instructions',
        ...source,
      },
    },
  }
}

function assertPresence(
  report: SightlineReport,
  sourceKey: string,
  expected: readonly ['present' | 'absent' | 'unknown', 'present' | 'absent' | 'unknown', 'present' | 'absent' | 'unknown'],
): void {
  const row = report.divergences.find((candidate) => candidate.sourceKey === sourceKey)
  assert.ok(row, `missing divergence row for ${sourceKey}`)
  assert.deepEqual(row.byAgent.map((entry) => entry.presence), expected)
}

async function put(root: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, 'utf8')
}
