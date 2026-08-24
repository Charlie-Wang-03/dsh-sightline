import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { CallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type JsonValue } from '@deepseek-ai/dsh-tools'

import {
  createSightlineTool,
  findRepositoryRoot,
  formatSightlineReportMarkdown,
} from '../src/index.js'
import type { SightlineReport } from '../src/index.js'
import * as sightlinePlugin from '../src/host/dsh-tool.js'

const TEST_SIGNAL = new AbortController().signal

test('real DSH ToolRuntime and ctx.fs produce the first three-column Sightline report', async () => {
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

    const ctx = await setupSightline({ codexHome, claudeHome })
    assert.ok(ctx.fs instanceof LocalFileSystem)

    const session = ctx.sessions.create(SessionId('sightline-three-column'), { meta: { cwd } })
    appendInstructionBaseline(session, [
      { action: 'set', scope: '.\u0000AGENTS.md', path: 'AGENTS.md', digest: 'dsh-root-agents' },
      { action: 'set', scope: '.\u0000CLAUDE.md', path: 'CLAUDE.md', digest: 'dsh-root-claude' },
      {
        action: 'set',
        scope: 'packages/api\u0000AGENTS.md',
        path: 'packages/api/AGENTS.md',
        digest: 'dsh-api-agents',
      },
    ])
    const agent = agentWithSession(session)

    assert.ok(ctx.tools.schemas().some((schema) => schema.name === 'sightline'))

    const result = await ctx.tools.execute({
      signal: TEST_SIGNAL,
      callId: CallId('sightline-call-1'),
      name: 'sightline',
      arguments: {},
      agent,
    })

    if (result.isError) throw new Error(result.error.message)
    assert.equal(result.isError, false)
    const report = result.value as unknown as SightlineReport

    // The client panel consumes replayable ToolResult meta. It must be the same
    // canonical report, not a separately derived UI projection.
    assert.deepEqual(result.meta, result.value)

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

    const rendered = result.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n')
    assert.match(rendered, /DSH \(Observed\)/)
    assert.match(rendered, /Codex \(Predicted\)/)
    assert.match(rendered, /Claude \(Predicted\)/)
    assert.match(rendered, /AGENTS\.md/)
    assert.match(rendered, /\.claude\/rules\/always\.md/)
    assert.doesNotMatch(rendered, new RegExp(escapeRegExp(repositoryRoot)))
    assert.doesNotMatch(rendered, new RegExp(escapeRegExp(cwd)))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('model-facing renderer omits absolute workspace paths and full diagnostic messages', () => {
  const privateRoot = '/Users/example/private/repo'
  const privateCwd = '/Users/example/private/repo/packages/api'
  const report: SightlineReport = {
    schemaVersion: 1,
    repositoryRoot: privateRoot,
    cwd: privateCwd,
    surfaces: {
      dsh: {
        agent: 'dsh',
        evidence: 'unavailable',
        cwd: privateCwd,
        resolverVersion: 'dsh-test',
        sources: [],
        diagnostics: [
          {
            code: 'dsh-session-cwd-mismatch',
            message: `Private diagnostic mentions ${privateCwd}`,
          },
        ],
      },
      codex: {
        agent: 'codex',
        evidence: 'predicted',
        cwd: privateCwd,
        resolverVersion: 'codex-test',
        sources: [],
        diagnostics: [],
      },
      'claude-code': {
        agent: 'claude-code',
        evidence: 'predicted',
        cwd: privateCwd,
        resolverVersion: 'claude-test',
        sources: [],
        diagnostics: [],
      },
    },
    divergences: [],
  }

  const rendered = formatSightlineReportMarkdown(report)
  assert.match(rendered, /dsh: dsh-session-cwd-mismatch/)
  assert.doesNotMatch(rendered, /Private diagnostic mentions/)
  assert.doesNotMatch(rendered, new RegExp(escapeRegExp(privateRoot)))
  assert.doesNotMatch(rendered, new RegExp(escapeRegExp(privateCwd)))
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

test('DSH sightline tool observes caller cancellation before filesystem work', async () => {
  const tool = createSightlineTool()
  const controller = new AbortController()
  controller.abort(new Error('sightline test cancellation'))

  await assert.rejects(
    () => tool.execute({}, { signal: controller.signal } as never),
    /sightline test cancellation/,
  )
})

test('DSH sightline renderer stays total for incompatible replayed JSON', () => {
  const tool = createSightlineTool()
  const rendered = tool.output.render({}, null as JsonValue)

  assert.equal(rendered.length, 1)
  assert.equal(rendered[0]?.type, 'text')
  if (rendered[0]?.type !== 'text') throw new Error('Sightline tool did not render text output')
  assert.match(rendered[0].text, /report unavailable/i)
})

async function setupSightline(options: sightlinePlugin.SightlineToolOptions): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(LocalFileSystem, { cwd: process.cwd() })
  await ctx.plugin(sightlinePlugin, options)
  return ctx
}

function agentWithSession(session: ReturnType<Context['sessions']['create']>): Agent {
  return {
    id: session.id,
    session,
  } as unknown as Agent
}

function appendInstructionBaseline(
  session: ReturnType<Context['sessions']['create']>,
  changes: readonly {
    action: 'set' | 'replace' | 'remove'
    scope: string
    path: string
    digest?: string
  }[],
): void {
  session.append(
    'user/message',
    createUserMessage({
      content: [{ type: 'text', text: '<system-reminder>fixture</system-reminder>' }],
      source: {
        kind: 'agent-instructions',
        form: 'instructions',
        baseline: true,
        baselineIdentity: '{"projectRoot":"repo"}',
        changes,
      } as never,
    }),
    { surfaceOp: 'append' },
  )
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
