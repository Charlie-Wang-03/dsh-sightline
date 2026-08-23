import type { EffectiveInstructionSurface, InstructionAdapter, ResolveInput } from '../contracts.js'

export interface UnavailableDshAdapterOptions {
  reason?: string
  resolverVersion?: string
}

/**
 * v0.1 placeholder used until Sightline binds to an authoritative public DSH
 * runtime/session provenance seam. It intentionally returns `unavailable`
 * rather than reimplementing DSH filesystem discovery and calling it observed.
 */
export class UnavailableDshAdapter implements InstructionAdapter {
  readonly agent = 'dsh' as const

  readonly #reason: string
  readonly #resolverVersion: string

  constructor(options: UnavailableDshAdapterOptions = {}) {
    this.#reason =
      options.reason ??
      'Authoritative DSH runtime instruction provenance is not connected in this build.'
    this.#resolverVersion = options.resolverVersion ?? 'dsh-runtime-seam-unbound'
  }

  async resolve(input: ResolveInput): Promise<EffectiveInstructionSurface> {
    return {
      agent: this.agent,
      evidence: 'unavailable',
      cwd: input.cwd,
      resolverVersion: this.#resolverVersion,
      sources: [],
      diagnostics: [
        {
          code: 'dsh-runtime-evidence-unavailable',
          message: this.#reason,
        },
      ],
    }
  }
}
