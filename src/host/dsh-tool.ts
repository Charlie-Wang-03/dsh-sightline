import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { stat } from 'node:fs/promises'
import path from 'node:path'

import { ClaudeCodeAdapter } from '../adapters/claude-code.js'
import { CodexAdapter } from '../adapters/codex.js'
import { DshObservedAdapter } from '../adapters/dsh.js'
import type { SightlineReport } from '../contracts.js'
import { buildSightlineReport } from '../report.js'

export const name = 'dsh-sightline'
export const inject = ['tools']

export interface SightlineToolOptions {
  codexHome?: string
  claudeHome?: string
  projectRootMarkers?: readonly string[]
}

const DEFAULT_PROJECT_ROOT_MARKERS = ['.git'] as const

/**
 * Register the first model-facing Sightline surface in DSH.
 *
 * The tool is intentionally argument-free in v0.1: it reports the exact live
 * agent session that invoked it, preventing a model from claiming runtime
 * observation for an unrelated session or cwd.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(createSightlineTool())
}

/** Exported for focused host integration tests and future bundle wiring. */
export function createSightlineTool(options: SightlineToolOptions = {}) {
  return defineTool({
    name: 'sightline',
    description:
      'Compare the effective workspace instruction surfaces of DeepSeek Harness, Codex, and Claude Code for this live session.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [
        {
          type: 'text',
          text: formatSightlineReportMarkdown(value as unknown as SightlineReport),
        },
      ],
    },
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      if (exec.agent === undefined) {
        throw new Error('Sightline requires an agent-owned DSH tool execution.')
      }

      const cwd = exec.agent.session.header.cwd
      if (cwd === undefined) {
        throw new Error('Sightline requires the live DSH Session to expose a cwd.')
      }

      const repositoryRoot = await findRepositoryRoot(
        cwd,
        options.projectRootMarkers ?? DEFAULT_PROJECT_ROOT_MARKERS,
      )

      const report = await buildSightlineReport(
        [
          new DshObservedAdapter({ getSession: () => exec.agent?.session }),
          new CodexAdapter({ ...(options.codexHome === undefined ? {} : { codexHome: options.codexHome }) }),
          new ClaudeCodeAdapter({
            ...(options.claudeHome === undefined ? {} : { claudeHome: options.claudeHome }),
          }),
        ],
        { repositoryRoot, cwd },
      )

      // The canonical report is deliberately JSON-only. Materializing it once
      // also strips TypeScript readonly/interface identity before it crosses the
      // generic DSH `json` tool-output boundary.
      return JSON.parse(JSON.stringify(report))
    },
  })
}

/**
 * Match DSH's default project-root behavior without importing an internal
 * instruction-discovery implementation: walk upward to the first marker and
 * fall back to cwd when none exists.
 */
export async function findRepositoryRoot(
  cwd: string,
  markers: readonly string[] = DEFAULT_PROJECT_ROOT_MARKERS,
): Promise<string> {
  const resolvedCwd = path.resolve(cwd)
  let current = resolvedCwd

  for (;;) {
    for (const marker of markers) {
      if (await pathExists(path.join(current, marker))) return current
    }

    const parent = path.dirname(current)
    if (parent === current) return resolvedCwd
    current = parent
  }
}

/** Compact model-facing rendering of the same canonical report returned by the tool. */
export function formatSightlineReportMarkdown(report: SightlineReport): string {
  const labels = {
    dsh: `DSH (${evidenceLabel(report.surfaces.dsh.evidence)})`,
    codex: `Codex (${evidenceLabel(report.surfaces.codex.evidence)})`,
    claude: `Claude (${evidenceLabel(report.surfaces['claude-code'].evidence)})`,
  }

  const lines = [
    'Same repo. Different agents. Different rules.',
    '',
    `cwd: ${report.cwd}`,
    '',
    `| Source | ${labels.dsh} | ${labels.codex} | ${labels.claude} |`,
    '| --- | --- | --- | --- |',
  ]

  if (report.divergences.length === 0) {
    lines.push('| *(no instruction sources established)* | — | — | — |')
  } else {
    for (const row of report.divergences) {
      const presence = new Map(row.byAgent.map((entry) => [entry.agent, entry.presence]))
      lines.push(
        `| ${escapeTableCell(row.displayPath)} | ${presenceMark(presence.get('dsh'))} | ${presenceMark(presence.get('codex'))} | ${presenceMark(presence.get('claude-code'))} |`,
      )
    }
  }

  const diagnostics = Object.values(report.surfaces).flatMap((surface) =>
    surface.diagnostics.map((diagnostic) => `${surface.agent}: ${diagnostic.code} — ${diagnostic.message}`),
  )
  if (diagnostics.length > 0) {
    lines.push('', 'Diagnostics:', ...diagnostics.map((diagnostic) => `- ${diagnostic}`))
  }

  return lines.join('\n')
}

function evidenceLabel(value: SightlineReport['surfaces']['dsh']['evidence']): string {
  switch (value) {
    case 'observed':
      return 'Observed'
    case 'predicted':
      return 'Predicted'
    case 'unavailable':
      return 'Unavailable'
  }
}

function presenceMark(value: 'present' | 'absent' | 'unknown' | undefined): string {
  switch (value) {
    case 'present':
      return '●'
    case 'absent':
      return ''
    case 'unknown':
    case undefined:
      return '?'
  }
}

function escapeTableCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ((error as { code?: unknown }).code === 'ENOENT' || (error as { code?: unknown }).code === 'ENOTDIR')
    ) {
      return false
    }
    throw error
  }
}
