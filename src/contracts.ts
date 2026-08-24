export type AgentId = 'dsh' | 'codex' | 'claude-code'

export type EvidenceKind = 'observed' | 'predicted' | 'unavailable'

export type ScopeKind =
  | 'user-global'
  | 'repository'
  | 'nested'
  | 'local-overlay'
  | 'rule'
  | 'other'

export interface InstructionSource {
  /** Stable identity used for cross-agent comparison. */
  sourceKey: string
  /** Human-readable path or logical source name. */
  displayPath: string
  /** Scope classification owned by the adapter. */
  scope: ScopeKind
  /** Zero-based position in this agent's effective instruction surface. */
  order: number
  /** Optional content identity; never the sole source identity. */
  digest?: string
  /** Adapter-owned provenance that is safe to expose in the report. */
  provenance?: Readonly<Record<string, string | number | boolean>>
}

export interface SurfaceDiagnostic {
  code: string
  message: string
}

export interface EffectiveInstructionSurface {
  agent: AgentId
  evidence: EvidenceKind
  cwd: string
  /** Identifies the documented/runtime semantics implemented by the adapter. */
  resolverVersion: string
  sources: readonly InstructionSource[]
  diagnostics: readonly SurfaceDiagnostic[]
}

export interface ResolveInput {
  repositoryRoot: string
  cwd: string
  /** Optional caller cancellation propagated through resolver I/O. */
  signal?: AbortSignal
}

export interface InstructionAdapter {
  readonly agent: AgentId
  resolve(input: ResolveInput): Promise<EffectiveInstructionSurface>
}

export type Presence = 'present' | 'absent' | 'unknown'

export interface AgentPresence {
  agent: AgentId
  presence: Presence
  order?: number
}

export interface DivergenceRow {
  sourceKey: string
  displayPath: string
  byAgent: readonly AgentPresence[]
}

export interface SightlineReport {
  schemaVersion: 1
  repositoryRoot: string
  cwd: string
  surfaces: Readonly<Record<AgentId, EffectiveInstructionSurface>>
  divergences: readonly DivergenceRow[]
}
