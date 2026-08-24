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
  firstExistingFile,
  nodeReadOnlyFileAccess,
  repositoryDisplayPath,
  repositorySourceKey,
} from '../filesystem.js'
import type { ReadOnlyFileAccess } from '../filesystem.js'

const DEFAULT_PROJECT_BUDGET = 32 * 1024
const DEFAULT_CANDIDATES = ['AGENTS.override.md', 'AGENTS.md'] as const

export interface CodexAdapterOptions {
  codexHome?: string
  fallbackFilenames?: readonly string[]
  maxProjectBytes?: number
  resolverVersion?: string
  fileAccess?: ReadOnlyFileAccess
}

export class CodexAdapter implements InstructionAdapter {
  readonly agent = 'codex' as const

  readonly #codexHome: string
  readonly #fallbackFilenames: readonly string[]
  readonly #maxProjectBytes: number
  readonly #resolverVersion: string
  readonly #fileAccess: ReadOnlyFileAccess

  constructor(options: CodexAdapterOptions = {}) {
    this.#codexHome = options.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex')
    this.#fallbackFilenames = dedupe(options.fallbackFilenames ?? [])
    this.#maxProjectBytes = options.maxProjectBytes ?? DEFAULT_PROJECT_BUDGET
    this.#resolverVersion = options.resolverVersion ?? 'codex-docs-2026-08-23'
    this.#fileAccess = options.fileAccess ?? nodeReadOnlyFileAccess
  }

  async resolve(input: ResolveInput): Promise<EffectiveInstructionSurface> {
    try {
      input.signal?.throwIfAborted()
      const sources: InstructionSource[] = []
      const diagnostics: SurfaceDiagnostic[] = []
      let order = 0

      const global = await firstExistingFile(
        this.#codexHome,
        DEFAULT_CANDIDATES,
        this.#fileAccess,
        input.signal,
      )
      if (global) {
        sources.push({
          sourceKey: `global:codex:${path.basename(global.absolutePath)}`,
          displayPath: `~/.codex/${path.basename(global.absolutePath)}`,
          scope: 'user-global',
          order: order++,
          digest: global.digest,
          provenance: {
            selection: 'override-preferred',
            bytes: global.bytes,
          },
        })
      }

      const candidates = dedupe([...DEFAULT_CANDIDATES, ...this.#fallbackFilenames])
      let remainingBytes = this.#maxProjectBytes

      for (const directory of directoryChain(input.repositoryRoot, input.cwd)) {
        input.signal?.throwIfAborted()
        if (remainingBytes <= 0) {
          diagnostics.push({
            code: 'codex-project-instruction-budget-exhausted',
            message: `Project instruction discovery stopped at the configured ${this.#maxProjectBytes}-byte budget.`,
          })
          break
        }

        const selected = await firstExistingFile(
          directory,
          candidates,
          this.#fileAccess,
          input.signal,
        )
        if (!selected) continue

        const bytesIncluded = Math.min(remainingBytes, selected.bytes)
        const truncated = bytesIncluded < selected.bytes
        const displayPath = repositoryDisplayPath(input.repositoryRoot, selected.absolutePath)

        sources.push({
          sourceKey: repositorySourceKey(input.repositoryRoot, selected.absolutePath),
          displayPath,
          scope: directory === path.resolve(input.repositoryRoot) ? 'repository' : 'nested',
          order: order++,
          digest: selected.digest,
          provenance: {
            selection: 'first-match-per-directory',
            bytes: selected.bytes,
            bytesIncluded,
            truncated,
          },
        })

        remainingBytes -= bytesIncluded
        if (truncated) {
          diagnostics.push({
            code: 'codex-project-instruction-truncated',
            message: `${displayPath} reaches the configured project instruction byte budget; deeper sources are not included.`,
          })
          break
        }
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

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))]
}

function unavailableSurface(
  input: ResolveInput,
  resolverVersion: string,
  error: unknown,
): EffectiveInstructionSurface {
  return {
    agent: 'codex',
    evidence: 'unavailable',
    cwd: input.cwd,
    resolverVersion,
    sources: [],
    diagnostics: [
      {
        code: 'codex-resolution-failed',
        message: error instanceof Error ? error.message : 'Codex instruction resolution failed.',
      },
    ],
  }
}
