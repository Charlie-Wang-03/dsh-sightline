import type {
  AgentId,
  AgentPresence,
  DivergenceRow,
  EffectiveInstructionSurface,
} from './contracts.js'

export const AGENT_ORDER = ['dsh', 'codex', 'claude-code'] as const satisfies readonly AgentId[]

export function compareInstructionSurfaces(
  surfaces: Readonly<Record<AgentId, EffectiveInstructionSurface>>,
): DivergenceRow[] {
  const sourceCatalog = new Map<string, string>()

  for (const agent of AGENT_ORDER) {
    for (const source of surfaces[agent].sources) {
      if (!sourceCatalog.has(source.sourceKey)) {
        sourceCatalog.set(source.sourceKey, source.displayPath)
      }
    }
  }

  return [...sourceCatalog.entries()]
    .sort(([sourceKeyA, displayPathA], [sourceKeyB, displayPathB]) => {
      const byDisplay = displayPathA.localeCompare(displayPathB)
      return byDisplay !== 0 ? byDisplay : sourceKeyA.localeCompare(sourceKeyB)
    })
    .map(([sourceKey, displayPath]) => ({
      sourceKey,
      displayPath,
      byAgent: AGENT_ORDER.map((agent) => presenceForAgent(surfaces[agent], sourceKey)),
    }))
}

function presenceForAgent(
  surface: EffectiveInstructionSurface,
  sourceKey: string,
): AgentPresence {
  if (surface.evidence === 'unavailable') {
    return { agent: surface.agent, presence: 'unknown' }
  }

  const source = surface.sources.find((candidate) => candidate.sourceKey === sourceKey)
  if (!source) return { agent: surface.agent, presence: 'absent' }

  return {
    agent: surface.agent,
    presence: 'present',
    order: source.order,
  }
}
