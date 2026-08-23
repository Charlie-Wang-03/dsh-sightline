export { ClaudeCodeAdapter } from './adapters/claude-code.js'
export type { ClaudeCodeAdapterOptions } from './adapters/claude-code.js'
export { CodexAdapter } from './adapters/codex.js'
export type { CodexAdapterOptions } from './adapters/codex.js'
export { UnavailableDshAdapter } from './adapters/dsh.js'
export type { UnavailableDshAdapterOptions } from './adapters/dsh.js'
export { AGENT_ORDER, compareInstructionSurfaces } from './compare.js'
export {
  directoryChain,
  isWithinRepository,
  normalizePathForKey,
  repositoryDisplayPath,
  repositorySourceKey,
} from './filesystem.js'
export { buildSightlineReport } from './report.js'

export type {
  AgentId,
  AgentPresence,
  DivergenceRow,
  EffectiveInstructionSurface,
  EvidenceKind,
  InstructionAdapter,
  InstructionSource,
  Presence,
  ResolveInput,
  ScopeKind,
  SightlineReport,
  SurfaceDiagnostic,
} from './contracts.js'
