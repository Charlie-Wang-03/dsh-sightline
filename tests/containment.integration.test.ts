import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { CallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'

import { CodexAdapter } from '../src/index.js'
import type { SightlineReport } from '../src/index.js'
import * as sightlinePlugin from '../src/host/dsh-tool.js'

const POSIX_ONLY = { skip: process.platform === 'win32' }
const TEST_SIGNAL = new AbortController().signal

test('standalone prediction fails closed when a repository instruction symlink escapes the root', POSIX_ONLY, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sightline-containment-node-'))
  try {
    const repositoryRoot = path.join(root, 'repo')
    const codexHome = path.join(root, 'codex-home')
    const external = path.join(root, 'outside-AGENTS.md')
    await mkdir(repositoryRoot, { recursive: true })
    await mkdir(codexHome, { recursive: true })
    await writeFile(external, 'outside repository instructions', 'utf8')
    await symlink(external, path.join(repositoryRoot, 'AGENTS.md'))

    const surface = await new CodexAdapter({ codexHome }).resolve({
      repositoryRoot,
      cwd: repositoryRoot,
    })

    assert.equal(surface.evidence, 'unavailable')
    assert.equal(surface.sources.length, 0)
    assert.equal(surface.diagnostics[0]?.code, 'codex-resolution-failed')
    assert.match(surface.diagnostics[0]?.message ?? '', /outside the repository containment root/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('DSH hosted prediction fails closed when a repository instruction symlink escapes the root', POSIX_ONLY, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sightline-containment-dsh-'))
  try {
    const repositoryRoot = path.join(root, 'repo')
    const codexHome = path.join(root, 'codex-home')
    const claudeHome = path.join(root, 'claude-home')
    const external = path.join(root, 'outside-AGENTS.md')
    await mkdir(path.join(repositoryRoot, '.git'), { recursive: true })
    await mkdir(codexHome, { recursive: true })
    await mkdir(claudeHome, { recursive: true })
    await writeFile(external, 'outside repository instructions', 'utf8')
    await symlink(external, path.join(repositoryRoot, 'AGENTS.md'))

    const ctx = await setupSightline({ codexHome, claudeHome })
    const report = await executeSightline(ctx, repositoryRoot, 'containment-external')

    assert.equal(report.surfaces.codex.evidence, 'unavailable')
    assert.equal(report.surfaces.codex.sources.length, 0)
    assert.equal(report.surfaces.codex.diagnostics[0]?.code, 'codex-resolution-failed')
    assert.match(
      report.surfaces.codex.diagnostics[0]?.message ?? '',
      /outside the repository containment root/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('DSH hosted prediction preserves repository symlinks whose canonical target stays inside the root', POSIX_ONLY, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sightline-containment-inside-'))
  try {
    const repositoryRoot = path.join(root, 'repo')
    const codexHome = path.join(root, 'codex-home')
    const claudeHome = path.join(root, 'claude-home')
    const internalTarget = path.join(repositoryRoot, 'instructions', 'shared.md')
    await mkdir(path.join(repositoryRoot, '.git'), { recursive: true })
    await mkdir(path.dirname(internalTarget), { recursive: true })
    await mkdir(codexHome, { recursive: true })
    await mkdir(claudeHome, { recursive: true })
    await writeFile(internalTarget, 'inside repository instructions', 'utf8')
    await symlink(internalTarget, path.join(repositoryRoot, 'AGENTS.md'))

    const ctx = await setupSightline({ codexHome, claudeHome })
    const report = await executeSightline(ctx, repositoryRoot, 'containment-internal')

    assert.equal(report.surfaces.codex.evidence, 'predicted')
    assert.deepEqual(
      report.surfaces.codex.sources.map((source) => source.sourceKey),
      ['repo:AGENTS.md'],
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
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

async function executeSightline(ctx: Context, cwd: string, id: string): Promise<SightlineReport> {
  const session = ctx.sessions.create(SessionId(id), { meta: { cwd } })
  const agent = { id: session.id, session } as unknown as Agent
  const result = await ctx.tools.execute({
    signal: TEST_SIGNAL,
    callId: CallId(`${id}-call`),
    name: 'sightline',
    arguments: {},
    agent,
  })

  if (result.isError) throw new Error(result.error.message)
  return result.value as unknown as SightlineReport
}
