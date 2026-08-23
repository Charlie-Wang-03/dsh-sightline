import type {
  EffectiveInstructionSurface,
  InstructionAdapter,
  InstructionSource,
  ResolveInput,
  ScopeKind,
} from '../contracts.js'
import { normalizePathForKey } from '../filesystem.js'

export interface UnavailableDshAdapterOptions {
  reason?: string
  resolverVersion?: string
}

/** Minimal public Session shape Sightline needs from a live DSH Agent.session handle. */
export interface DshSessionView {
  readonly header: {
    readonly cwd?: string
  }
  readonly events: readonly DshSessionEventView[]
  readonly surface: {
    readonly nodes: readonly number[]
  }
}

/** Minimal durable event envelope consumed from the public DSH Session log. */
export interface DshSessionEventView {
  readonly seq: number
  readonly type: string
  readonly data?: unknown
}

export interface DshObservedAdapterOptions {
  getSession: () => DshSessionView | undefined | Promise<DshSessionView | undefined>
  resolverVersion?: string
}

interface AgentInstructionChange {
  action: 'set' | 'replace' | 'remove'
  scope: string
  path: string
  digest?: string
}

interface ParsedAgentInstructionSource {
  baseline: boolean
  baselineIdentity?: string
  changes: readonly AgentInstructionChange[]
}

interface ActiveInstruction {
  change: AgentInstructionChange
  eventSeq: number
  baseline: boolean
  baselineIdentity?: string
  transitionOrder: number
}

/**
 * Reads DSH's durable typed `agent-instructions` message provenance from the
 * current public Session surface. It never reimplements DSH filesystem
 * discovery and therefore may truthfully label its result `observed`.
 */
export class DshObservedAdapter implements InstructionAdapter {
  readonly agent = 'dsh' as const

  readonly #getSession: DshObservedAdapterOptions['getSession']
  readonly #resolverVersion: string

  constructor(options: DshObservedAdapterOptions) {
    this.#getSession = options.getSession
    this.#resolverVersion =
      options.resolverVersion ?? 'dsh-session-agent-instructions@0.1.1-rc.2/b150a551'
  }

  async resolve(input: ResolveInput): Promise<EffectiveInstructionSurface> {
    try {
      const session = await this.#getSession()
      if (session === undefined) {
        return unavailableSurface(
          input,
          this.#resolverVersion,
          'dsh-session-unavailable',
          'No live DSH Session was available for this Sightline query.',
        )
      }

      if (session.header.cwd === undefined) {
        return unavailableSurface(
          input,
          this.#resolverVersion,
          'dsh-session-cwd-unavailable',
          'The live DSH Session does not expose a cwd, so Sightline cannot bind it to the requested workspace.',
        )
      }

      if (!samePathIdentity(session.header.cwd, input.cwd)) {
        return unavailableSurface(
          input,
          this.#resolverVersion,
          'dsh-session-cwd-mismatch',
          `The live DSH Session cwd (${session.header.cwd}) does not match the requested cwd (${input.cwd}).`,
        )
      }

      const visibleSeqs = new Set(session.surface.nodes)
      const active = new Map<string, ActiveInstruction>()
      let sawAuthoritativeSource = false
      let transitionOrder = 0

      for (const event of [...session.events].sort((left, right) => left.seq - right.seq)) {
        const parsed = parseAgentInstructionSource(event)
        if (parsed.kind === 'none') continue
        if (parsed.kind === 'malformed') {
          return unavailableSurface(
            input,
            this.#resolverVersion,
            'dsh-agent-instructions-source-incompatible',
            `DSH emitted an agent-instructions source at event ${event.seq}, but its durable shape is not compatible with this Sightline resolver.`,
          )
        }

        sawAuthoritativeSource = true
        if (!visibleSeqs.has(event.seq)) continue

        for (const change of parsed.source.changes) {
          if (change.action === 'remove') {
            active.delete(change.scope)
            transitionOrder += 1
            continue
          }

          active.set(change.scope, {
            change,
            eventSeq: event.seq,
            baseline: parsed.source.baseline,
            ...(parsed.source.baselineIdentity === undefined
              ? {}
              : { baselineIdentity: parsed.source.baselineIdentity }),
            transitionOrder: transitionOrder++,
          })
        }
      }

      if (!sawAuthoritativeSource) {
        return unavailableSurface(
          input,
          this.#resolverVersion,
          'dsh-agent-instructions-provenance-unavailable',
          'The Session contains no durable typed agent-instructions provenance. Sightline cannot distinguish an empty instruction surface from a composition where the instruction plugin is absent.',
        )
      }

      const sources = [...active.values()]
        .sort((left, right) => left.transitionOrder - right.transitionOrder)
        .map((item, order) => toInstructionSource(item, order))

      return {
        agent: this.agent,
        evidence: 'observed',
        cwd: input.cwd,
        resolverVersion: this.#resolverVersion,
        sources,
        diagnostics: [],
      }
    } catch (error) {
      return unavailableSurface(
        input,
        this.#resolverVersion,
        'dsh-observed-resolution-failed',
        error instanceof Error ? error.message : 'DSH observed instruction resolution failed.',
      )
    }
  }
}

/**
 * Explicit fallback retained for hosts that cannot supply a live DSH Session.
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
    return unavailableSurface(
      input,
      this.#resolverVersion,
      'dsh-runtime-evidence-unavailable',
      this.#reason,
    )
  }
}

function parseAgentInstructionSource(
  event: DshSessionEventView,
):
  | { kind: 'none' }
  | { kind: 'malformed' }
  | { kind: 'valid'; source: ParsedAgentInstructionSource } {
  if (event.type !== 'user/message' || !isRecord(event.data)) return { kind: 'none' }
  const source = event.data.source
  if (!isRecord(source) || source.kind !== 'agent-instructions') return { kind: 'none' }
  if (source.form !== 'instructions' || !Array.isArray(source.changes)) return { kind: 'malformed' }

  const changes: AgentInstructionChange[] = []
  for (const value of source.changes) {
    if (!isRecord(value)) return { kind: 'malformed' }
    if (value.action !== 'set' && value.action !== 'replace' && value.action !== 'remove') {
      return { kind: 'malformed' }
    }
    if (typeof value.scope !== 'string' || value.scope.length === 0) return { kind: 'malformed' }
    if (typeof value.path !== 'string' || value.path.length === 0) return { kind: 'malformed' }
    if (value.digest !== undefined && typeof value.digest !== 'string') return { kind: 'malformed' }
    changes.push({
      action: value.action,
      scope: value.scope,
      path: value.path,
      ...(value.digest === undefined ? {} : { digest: value.digest }),
    })
  }

  if (source.baseline !== undefined && source.baseline !== true) return { kind: 'malformed' }
  if (source.baselineIdentity !== undefined && typeof source.baselineIdentity !== 'string') {
    return { kind: 'malformed' }
  }

  return {
    kind: 'valid',
    source: {
      baseline: source.baseline === true,
      ...(source.baselineIdentity === undefined
        ? {}
        : { baselineIdentity: source.baselineIdentity }),
      changes,
    },
  }
}

function toInstructionSource(item: ActiveInstruction, order: number): InstructionSource {
  const displayPath = normalizePathForKey(item.change.path)
  const provenance: Record<string, string | number | boolean> = {
    action: item.change.action,
    instructionScope: item.change.scope,
    eventSeq: item.eventSeq,
    baseline: item.baseline,
    ordering: 'visible-session-transition-order',
  }
  if (item.baselineIdentity !== undefined) provenance.baselineIdentity = item.baselineIdentity

  return {
    sourceKey: dshSourceKey(displayPath),
    displayPath,
    scope: dshScopeKind(displayPath),
    order,
    ...(item.change.digest === undefined ? {} : { digest: item.change.digest }),
    provenance,
  }
}

function dshSourceKey(displayPath: string): string {
  if (displayPath.startsWith('~/')) return `global:dsh:${displayPath.slice(2)}`
  const repositoryPath = displayPath.replace(/^\.\//, '')
  return `repo:${repositoryPath}`
}

function dshScopeKind(displayPath: string): ScopeKind {
  if (displayPath.startsWith('~/')) return 'user-global'
  const filename = displayPath.split('/').at(-1) ?? displayPath
  if (filename.includes('.local.')) return 'local-overlay'
  return displayPath.includes('/') ? 'nested' : 'repository'
}

function samePathIdentity(left: string, right: string): boolean {
  return trimTrailingSlash(normalizePathForKey(left)) === trimTrailingSlash(normalizePathForKey(right))
}

function trimTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/+$/, '') : value
}

function unavailableSurface(
  input: ResolveInput,
  resolverVersion: string,
  code: string,
  message: string,
): EffectiveInstructionSurface {
  return {
    agent: 'dsh',
    evidence: 'unavailable',
    cwd: input.cwd,
    resolverVersion,
    sources: [],
    diagnostics: [{ code, message }],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
