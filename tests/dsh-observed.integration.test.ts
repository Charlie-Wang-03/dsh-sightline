import assert from 'node:assert/strict'
import test from 'node:test'

import { DshObservedAdapter } from '../src/index.js'
import type { DshSessionEventView, DshSessionView } from '../src/index.js'

const CWD = '/workspace/repo/packages/api'
const REPOSITORY_ROOT = '/workspace/repo'

test('DSH observed adapter folds visible typed agent-instructions transitions', async () => {
  const session = dshSession([
    userMessageEvent(1, {
      baseline: true,
      baselineIdentity: '{"projectRoot":"/workspace/repo"}',
      changes: [
        { action: 'set', scope: '.\u0000AGENTS.md', path: 'AGENTS.md', digest: 'root-v1' },
        {
          action: 'set',
          scope: 'packages/api\u0000AGENTS.md',
          path: 'packages/api/AGENTS.md',
          digest: 'api-v1',
        },
      ],
    }),
    unrelatedEvent(2),
    userMessageEvent(3, {
      changes: [
        {
          action: 'replace',
          scope: 'packages/api\u0000AGENTS.md',
          path: 'packages/api/AGENTS.md',
          digest: 'api-v2',
        },
      ],
    }),
    userMessageEvent(4, {
      changes: [{ action: 'remove', scope: '.\u0000AGENTS.md', path: 'AGENTS.md' }],
    }),
  ], [1, 2, 3, 4])

  const surface = await new DshObservedAdapter({ getSession: () => session }).resolve({
    repositoryRoot: REPOSITORY_ROOT,
    cwd: CWD,
  })

  assert.equal(surface.evidence, 'observed')
  assert.deepEqual(surface.diagnostics, [])
  assert.deepEqual(
    surface.sources.map((source) => ({
      sourceKey: source.sourceKey,
      digest: source.digest,
      scope: source.scope,
      order: source.order,
      action: source.provenance?.action,
      eventSeq: source.provenance?.eventSeq,
    })),
    [
      {
        sourceKey: 'repo:packages/api/AGENTS.md',
        digest: 'api-v2',
        scope: 'nested',
        order: 0,
        action: 'replace',
        eventSeq: 3,
      },
    ],
  )
})

test('DSH observed adapter uses the current Session surface rather than hidden historical context', async () => {
  const session = dshSession([
    userMessageEvent(1, {
      baseline: true,
      changes: [{ action: 'set', scope: '.\u0000AGENTS.md', path: 'AGENTS.md', digest: 'old' }],
    }),
    userMessageEvent(5, {
      baseline: true,
      changes: [
        { action: 'set', scope: '.\u0000CLAUDE.md', path: 'CLAUDE.md', digest: 'current' },
      ],
    }),
  ], [5])

  const surface = await new DshObservedAdapter({ getSession: () => session }).resolve({
    repositoryRoot: REPOSITORY_ROOT,
    cwd: CWD,
  })

  assert.equal(surface.evidence, 'observed')
  assert.deepEqual(surface.sources.map((source) => source.sourceKey), ['repo:CLAUDE.md'])
})

test('DSH observed adapter fails closed when no typed instruction provenance exists', async () => {
  const session = dshSession([unrelatedEvent(1)], [1])

  const surface = await new DshObservedAdapter({ getSession: () => session }).resolve({
    repositoryRoot: REPOSITORY_ROOT,
    cwd: CWD,
  })

  assert.equal(surface.evidence, 'unavailable')
  assert.equal(surface.sources.length, 0)
  assert.equal(surface.diagnostics[0]?.code, 'dsh-agent-instructions-provenance-unavailable')
})

test('DSH observed adapter refuses a live Session belonging to another cwd', async () => {
  const session = dshSession([
    userMessageEvent(1, {
      baseline: true,
      changes: [{ action: 'set', scope: '.\u0000AGENTS.md', path: 'AGENTS.md', digest: 'root' }],
    }),
  ], [1], '/workspace/another-repo')

  const surface = await new DshObservedAdapter({ getSession: () => session }).resolve({
    repositoryRoot: REPOSITORY_ROOT,
    cwd: CWD,
  })

  assert.equal(surface.evidence, 'unavailable')
  assert.equal(surface.diagnostics[0]?.code, 'dsh-session-cwd-mismatch')
})

test('DSH observed adapter fails closed on an incompatible visible source shape', async () => {
  const malformed: DshSessionEventView = {
    seq: 1,
    type: 'user/message',
    data: {
      source: {
        kind: 'agent-instructions',
        form: 'instructions',
        changes: [{ action: 'set', scope: '.\u0000AGENTS.md' }],
      },
    },
  }
  const session = dshSession([malformed], [1])

  const surface = await new DshObservedAdapter({ getSession: () => session }).resolve({
    repositoryRoot: REPOSITORY_ROOT,
    cwd: CWD,
  })

  assert.equal(surface.evidence, 'unavailable')
  assert.equal(surface.diagnostics[0]?.code, 'dsh-agent-instructions-source-incompatible')
})

function dshSession(
  events: readonly DshSessionEventView[],
  visibleNodes: readonly number[],
  cwd = CWD,
): DshSessionView {
  return {
    header: { cwd },
    events,
    surface: { nodes: visibleNodes },
  }
}

function userMessageEvent(
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
      content: [{ type: 'text', text: '<system-reminder>fixture</system-reminder>' }],
      source: {
        kind: 'agent-instructions',
        form: 'instructions',
        ...source,
      },
      role: 'user',
      id: `fixture-${seq}`,
    },
  }
}

function unrelatedEvent(seq: number): DshSessionEventView {
  return {
    seq,
    type: 'step/start',
    data: { turn: 1, step: seq },
  }
}
