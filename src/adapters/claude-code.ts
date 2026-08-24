import os from 'node:os'
import path from 'node:path'

import type {
  EffectiveInstructionSurface,
  InstructionAdapter,
  InstructionSource,
  ResolveInput,
  SurfaceDiagnostic,
} from '../contracts.js'
import {
  directoryChain,
  listMarkdownFilesRecursively,
  nodeReadOnlyFileAccess,
  readFileSnapshot,
  repositoryDisplayPath,
  repositorySourceKey,
} from '../filesystem.js'
import type { ReadOnlyFileAccess } from '../filesystem.js'

export interface ClaudeCodeAdapterOptions {
  claudeHome?: string
  resolverVersion?: string
  fileAccess?: ReadOnlyFileAccess
}

export class ClaudeCodeAdapter implements InstructionAdapter {
  readonly agent = 'claude-code' as const

  readonly #claudeHome: string
  readonly #resolverVersion: string
  readonly #fileAccess: ReadOnlyFileAccess

  constructor(options: ClaudeCodeAdapterOptions = {}) {
    this.#claudeHome = options.claudeHome ?? path.join(os.homedir(), '.claude')
    this.#resolverVersion = options.resolverVersion ?? 'claude-docs-2026-08-23-cwd-view'
    this.#fileAccess = options.fileAccess ?? nodeReadOnlyFileAccess
  }

  async resolve(input: ResolveInput): Promise<EffectiveInstructionSurface> {
    try {
      input.signal?.throwIfAborted()
      const sources: InstructionSource[] = []
      const diagnostics: SurfaceDiagnostic[] = []
      let order = 0

      const global = await readFileSnapshot(
        path.join(this.#claudeHome, 'CLAUDE.md'),
        this.#fileAccess,
        input.signal,
      )
      if (global) {
        sources.push({
          sourceKey: 'global:claude-code:CLAUDE.md',
          displayPath: '~/.claude/CLAUDE.md',
          scope: 'user-global',
          order: order++,
          digest: global.digest,
          provenance: { loading: 'session-start' },
        })
      }

      for (const directory of directoryChain(input.repositoryRoot, input.cwd)) {
        input.signal?.throwIfAborted()
        const snapshot = await readFileSnapshot(
          path.join(directory, 'CLAUDE.md'),
          this.#fileAccess,
          input.signal,
        )
        if (!snapshot) continue

        sources.push({
          sourceKey: repositorySourceKey(input.repositoryRoot, snapshot.absolutePath),
          displayPath: repositoryDisplayPath(input.repositoryRoot, snapshot.absolutePath),
          scope: directory === path.resolve(input.repositoryRoot) ? 'repository' : 'nested',
          order: order++,
          digest: snapshot.digest,
          provenance: { loading: 'cwd-ancestor-session-start' },
        })
      }

      const rulesRoot = path.join(input.repositoryRoot, '.claude', 'rules')
      const rulePaths = await listMarkdownFilesRecursively(
        rulesRoot,
        this.#fileAccess,
        input.signal,
      )
      let deferredPathScopedRules = 0

      for (const rulePath of rulePaths) {
        input.signal?.throwIfAborted()
        const snapshot = await readFileSnapshot(rulePath, this.#fileAccess, input.signal)
        if (!snapshot) continue

        if (hasPathScope(snapshot.content)) {
          deferredPathScopedRules += 1
          continue
        }

        sources.push({
          sourceKey: repositorySourceKey(input.repositoryRoot, snapshot.absolutePath),
          displayPath: repositoryDisplayPath(input.repositoryRoot, snapshot.absolutePath),
          scope: 'rule',
          order: order++,
          digest: snapshot.digest,
          provenance: { loading: 'always-loaded-rule' },
        })
      }

      if (deferredPathScopedRules > 0) {
        diagnostics.push({
          code: 'claude-path-scoped-rules-deferred',
          message:
            `${deferredPathScopedRules} path-scoped Claude rule(s) were discovered but are not labelled effective from cwd alone; ` +
            'Claude loads them when matching files are read.',
        })
      }

      return {
        agent: this.agent,
        evidence: 'predicted',
        cwd: input.cwd,
        resolverVersion: this.#resolverVersion,
        sources,
        diagnostics,
      }
    } catch (error) {
      input.signal?.throwIfAborted()
      return unavailableSurface(input, this.#resolverVersion, error)
    }
  }
}

function hasPathScope(content: string): boolean {
  if (!content.startsWith('---')) return false
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)
  return match ? /^paths\s*:/m.test(match[1] ?? '') : false
}

function unavailableSurface(
  input: ResolveInput,
  resolverVersion: string,
  error: unknown,
): EffectiveInstructionSurface {
  return {
    agent: 'claude-code',
    evidence: 'unavailable',
    cwd: input.cwd,
    resolverVersion,
    sources: [],
    diagnostics: [
      {
        code: 'claude-resolution-failed',
        message: error instanceof Error ? error.message : 'Claude Code instruction resolution failed.',
      },
    ],
  }
}
