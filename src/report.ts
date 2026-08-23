import type {
  AgentId,
  EffectiveInstructionSurface,
  InstructionAdapter,
  ResolveInput,
  SightlineReport,
} from './contracts.js'
import { AGENT_ORDER, compareInstructionSurfaces } from './compare.js'

export async function buildSightlineReport(
  adapters: readonly InstructionAdapter[],
  input: ResolveInput,
): Promise<SightlineReport> {
  const resolved = await Promise.all(adapters.map((adapter) => adapter.resolve(input)))
  const surfaces = toSurfaceRecord(resolved)

  return {
    schemaVersion: 1,
    repositoryRoot: input.repositoryRoot,
    cwd: input.cwd,
    surfaces,
    divergences: compareInstructionSurfaces(surfaces),
  }
}

function toSurfaceRecord(
  surfaces: readonly EffectiveInstructionSurface[],
): Readonly<Record<AgentId, EffectiveInstructionSurface>> {
  const result = new Map<AgentId, EffectiveInstructionSurface>()

  for (const surface of surfaces) {
    if (result.has(surface.agent)) {
      throw new Error(`duplicate adapter result for ${surface.agent}`)
    }
    result.set(surface.agent, surface)
  }

  for (const agent of AGENT_ORDER) {
    if (!result.has(agent)) {
      throw new Error(`missing adapter result for ${agent}`)
    }
  }

  return {
    dsh: result.get('dsh')!,
    codex: result.get('codex')!,
    'claude-code': result.get('claude-code')!,
  }
}
