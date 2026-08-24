export { ClaudeCodeAdapter } from './adapters/claude-code.js'
export type { ClaudeCodeAdapterOptions } from './adapters/claude-code.js'
export { CodexAdapter } from './adapters/codex.js'
export type { CodexAdapterOptions } from './adapters/codex.js'
export { DshObservedAdapter, UnavailableDshAdapter } from './adapters/dsh.js'
export type {
  DshObservedAdapterOptions,
  DshSessionEventView,
  DshSessionView,
  UnavailableDshAdapterOptions,
} from './adapters/dsh.js'
export { AGENT_ORDER, compareInstructionSurfaces } from './compare.js'
export {
  directoryChain,
  isWithinRepository,
  nodeReadOnlyFileAccess,
  normalizePathForKey,
  repositoryDisplayPath,
  repositorySourceKey,
} from './filesystem.js'
export type {
  ReadOnlyDirectoryEntry,
  ReadOnlyFileAccess,
  ReadOnlyFileInfo,
} from './filesystem.js'
export {
  apply as applyDshSightlineTool,
  createSightlineTool,
  findRepositoryRoot,
  formatSightlineReportMarkdown,
  inject as dshSightlineInject,
  name as dshSightlinePluginName,
} from './host/dsh-tool.js'
export type { SightlineToolOptions } from './host/dsh-tool.js'
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
