import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildSightlineReport,
  ClaudeCodeAdapter,
  CodexAdapter,
  compareInstructionSurfaces,
  normalizePathForKey,
  UnavailableDshAdapter,
} from '../src/index.js'
import type { AgentId, EffectiveInstructionSurface, InstructionSource } from '../src/contracts.js'

test('Codex predicts global, override, nested, and configured fallback sources in order', async () => {
  const fixture = await createFixture('codex')
  try {
    const repositoryRoot = path.join(fixture.root, 'repo')
    const cwd = path.join(repositoryRoot, 'packages', 'api')
    const codexHome = path.join(fixture.root, 'codex-home')

    await put(repositoryRoot, 'AGENTS.md', 'root normal')
    await put(repositoryRoot, 'AGENTS.override.md', 'root override')
    await put(repositoryRoot, 'packages/AGENTS.md', 'packages rules')
    await put(repositoryRoot, 'packages/api/GUIDANCE.md', 'api fallback')
    await put(codexHome, 'AGENTS.md', 'global rules')

    const surface = await new CodexAdapter({
      codexHome,
      fallbackFilenames: ['GUIDANCE.md'],
    }).resolve({ repositoryRoot, cwd })

    assert.equal(surface.evidence, 'predicted')
    assert.deepEqual(
      surface.sources.map((source) => source.sourceKey),
      [
        'global:codex:AGENTS.md',
        'repo:AGENTS.override.md',
        'repo:packages/AGENTS.md',
        'repo:packages/api/GUIDANCE.md',
      ],
    )
    assert.equal(surface.sources.some((source) => source.sourceKey === 'repo:AGENTS.md'), false)
    assert.deepEqual(
      surface.sources.map((source) => source.order),
      [0, 1, 2, 3],
    )
  } finally {
    await fixture.cleanup()
  }
})

test('Codex reports an unavailable surface when cwd escapes the repository root', async () => {
  const fixture = await createFixture('codex-outside')
  try {
    const repositoryRoot = path.join(fixture.root, 'repo')
    const outside = path.join(fixture.root, 'outside')
    await mkdir(repositoryRoot, { recursive: true })
    await mkdir(outside, { recursive: true })

    const surface = await new CodexAdapter({ codexHome: path.join(fixture.root, 'home') }).resolve({
      repositoryRoot,
      cwd: outside,
    })

    assert.equal(surface.evidence, 'unavailable')
    assert.equal(surface.sources.length, 0)
    assert.equal(surface.diagnostics[0]?.code, 'codex-resolution-failed')
  } finally {
    await fixture.cleanup()
  }
})

test('Claude predicts user/project memory and always-loaded rules while deferring path rules', async () => {
  const fixture = await createFixture('claude')
  try {
    const repositoryRoot = path.join(fixture.root, 'repo')
    const cwd = path.join(repositoryRoot, 'packages', 'api')
    const claudeHome = path.join(fixture.root, 'claude-home')

    await put(claudeHome, 'CLAUDE.md', 'global memory')
    await put(repositoryRoot, 'CLAUDE.md', 'root memory')
    await put(repositoryRoot, 'packages/CLAUDE.md', 'package memory')
    await put(repositoryRoot, '.claude/rules/always.md', 'Always use pnpm.')
    await put(
      repositoryRoot,
      '.claude/rules/api.md',
      '---\npaths:\n  - "packages/api/**"\n---\nValidate API inputs.',
    )

    const surface = await new ClaudeCodeAdapter({ claudeHome }).resolve({ repositoryRoot, cwd })

    assert.equal(surface.evidence, 'predicted')
    assert.deepEqual(
      surface.sources.map((source) => source.sourceKey),
      [
        'global:claude-code:CLAUDE.md',
        'repo:CLAUDE.md',
        'repo:packages/CLAUDE.md',
        'repo:.claude/rules/always.md',
      ],
    )
    assert.equal(
      surface.sources.some((source) => source.sourceKey === 'repo:.claude/rules/api.md'),
      false,
    )
    assert.equal(surface.diagnostics[0]?.code, 'claude-path-scoped-rules-deferred')
  } finally {
    await fixture.cleanup()
  }
})

test('comparison preserves unavailable as unknown instead of absence', () => {
  const surfaces = {
    dsh: makeSurface('dsh', 'unavailable', []),
    codex: makeSurface('codex', 'predicted', [source('repo:AGENTS.md', 'AGENTS.md', 0)]),
    'claude-code': makeSurface('claude-code', 'predicted', [
      source('repo:CLAUDE.md', 'CLAUDE.md', 0),
    ]),
  } satisfies Record<AgentId, EffectiveInstructionSurface>

  const rows = compareInstructionSurfaces(surfaces)
  const agentsRow = rows.find((row) => row.sourceKey === 'repo:AGENTS.md')
  assert.ok(agentsRow)
  assert.deepEqual(
    agentsRow.byAgent.map((entry) => [entry.agent, entry.presence]),
    [
      ['dsh', 'unknown'],
      ['codex', 'present'],
      ['claude-code', 'absent'],
    ],
  )
})

test('report composes all adapters into one deterministic canonical result', async () => {
  const fixture = await createFixture('report')
  try {
    const repositoryRoot = path.join(fixture.root, 'repo')
    const cwd = path.join(repositoryRoot, 'pkg')
    await put(repositoryRoot, 'AGENTS.md', 'codex root')
    await put(repositoryRoot, 'CLAUDE.md', 'claude root')
    await mkdir(cwd, { recursive: true })

    const report = await buildSightlineReport(
      [
        new UnavailableDshAdapter(),
        new CodexAdapter({ codexHome: path.join(fixture.root, 'no-codex-home') }),
        new ClaudeCodeAdapter({ claudeHome: path.join(fixture.root, 'no-claude-home') }),
      ],
      { repositoryRoot, cwd },
    )

    assert.equal(report.schemaVersion, 1)
    assert.equal(report.surfaces.dsh.evidence, 'unavailable')
    assert.equal(report.surfaces.codex.evidence, 'predicted')
    assert.equal(report.surfaces['claude-code'].evidence, 'predicted')
    assert.deepEqual(
      report.divergences.map((row) => row.sourceKey),
      ['repo:AGENTS.md', 'repo:CLAUDE.md'],
    )
  } finally {
    await fixture.cleanup()
  }
})

test('path-key normalization is stable for Windows and POSIX spellings', () => {
  assert.equal(normalizePathForKey('packages\\api\\AGENTS.md'), 'packages/api/AGENTS.md')
  assert.equal(normalizePathForKey('packages/api/AGENTS.md'), 'packages/api/AGENTS.md')
})

function source(sourceKey: string, displayPath: string, order: number): InstructionSource {
  return {
    sourceKey,
    displayPath,
    scope: 'repository',
    order,
  }
}

function makeSurface(
  agent: AgentId,
  evidence: EffectiveInstructionSurface['evidence'],
  sources: readonly InstructionSource[],
): EffectiveInstructionSurface {
  return {
    agent,
    evidence,
    cwd: '/repo',
    resolverVersion: 'test',
    sources,
    diagnostics: [],
  }
}

async function createFixture(name: string): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), `sightline-${name}-`))
  return {
    root,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  }
}

async function put(root: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, 'utf8')
}
