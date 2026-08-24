;(function registerSightlineClient(global) {
  const loader = global.__ModuleLoader__
  if (loader === undefined || typeof loader.load !== 'function') {
    throw new Error('dsh-sightline/client requires the DSH client module loader')
  }

  loader.load({
    id: 'dsh-sightline',
    factory(require) {
      const React = require('react')
      const h = React.createElement

      const inject = ['slots']

      function apply(ctx) {
        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register(
            { name: 'tool.call.toolview', key: 'sightline' },
            SightlineToolView,
          ),
        )
      }

      function SightlineToolView({ block }) {
        if (!isSettledToolResult(block)) {
          return h(
            'div',
            { style: cardStyle },
            h('div', { style: titleStyle }, 'Sightline'),
            h('div', { style: mutedStyle }, 'Comparing workspace instruction surfaces…'),
          )
        }

        const report = parseReport(block.meta)
        if (report === undefined) {
          return h(
            'div',
            { style: cardStyle },
            h('div', { style: titleStyle }, 'Sightline'),
            h('div', { style: mutedStyle }, 'Structured Sightline report unavailable.'),
          )
        }

        const evidence = [
          ['DSH', report.surfaces.dsh.evidence],
          ['Codex', report.surfaces.codex.evidence],
          ['Claude', report.surfaces['claude-code'].evidence],
        ]

        const rows = report.divergences.length === 0
          ? [h(
              'tr',
              { key: 'empty' },
              h('td', { style: sourceCellStyle }, 'No instruction sources established'),
              h('td', { style: markCellStyle }, '—'),
              h('td', { style: markCellStyle }, '—'),
              h('td', { style: markCellStyle }, '—'),
            )]
          : report.divergences.map((row) => {
              const byAgent = new Map(row.byAgent.map((entry) => [entry.agent, entry.presence]))
              return h(
                'tr',
                { key: row.sourceKey },
                h('td', { style: sourceCellStyle }, row.displayPath),
                h('td', { style: markCellStyle, title: presenceTitle(byAgent.get('dsh')) }, presenceMark(byAgent.get('dsh'))),
                h('td', { style: markCellStyle, title: presenceTitle(byAgent.get('codex')) }, presenceMark(byAgent.get('codex'))),
                h('td', { style: markCellStyle, title: presenceTitle(byAgent.get('claude-code')) }, presenceMark(byAgent.get('claude-code'))),
              )
            })

        const diagnostics = Object.values(report.surfaces)
          .flatMap((surface) => surface.diagnostics.map(
            (item) => `${surface.agent}: ${item.code} — ${item.message}`,
          ))

        return h(
          'div',
          { style: cardStyle, 'data-sightline-panel': 'v0.1' },
          h(
            'div',
            { style: headerStyle },
            h('div', null,
              h('div', { style: titleStyle }, 'Sightline'),
              h('div', { style: mutedStyle }, 'Same repo. Different agents. Different rules.'),
              h('div', { style: cwdStyle, title: report.cwd }, `cwd: ${report.cwd}`),
            ),
            h(
              'div',
              { style: evidenceRowStyle },
              ...evidence.map(([agent, kind]) => h(
                'span',
                { key: agent, style: badgeStyle },
                `${agent}: ${evidenceLabel(kind)}`,
              )),
            ),
          ),
          h(
            'div',
            { style: tableWrapStyle },
            h(
              'table',
              { style: tableStyle, 'aria-label': 'Sightline instruction surface comparison' },
              h(
                'thead',
                null,
                h(
                  'tr',
                  null,
                  h('th', { style: headerCellStyle }, 'Instruction source'),
                  h('th', { style: headerCellStyle }, 'DSH'),
                  h('th', { style: headerCellStyle }, 'Codex'),
                  h('th', { style: headerCellStyle }, 'Claude'),
                ),
              ),
              h('tbody', null, ...rows),
            ),
          ),
          diagnostics.length === 0
            ? null
            : h('div', { style: diagnosticStyle }, `Diagnostics: ${diagnostics.join(' · ')}`),
        )
      }

      return { apply, inject }

      function isSettledToolResult(value) {
        return value !== null && typeof value === 'object' && value.kind === 'tool-result'
      }

      function parseReport(value) {
        if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.cwd !== 'string') return undefined
        if (!isRecord(value.surfaces) || !Array.isArray(value.divergences)) return undefined
        for (const agent of ['dsh', 'codex', 'claude-code']) {
          const surface = value.surfaces[agent]
          if (!isRecord(surface) || surface.agent !== agent || !isEvidence(surface.evidence)) return undefined
          if (!Array.isArray(surface.diagnostics)) return undefined
          if (!surface.diagnostics.every((item) =>
            isRecord(item) && typeof item.code === 'string' && typeof item.message === 'string'
          )) return undefined
        }
        for (const row of value.divergences) {
          if (!isRecord(row) || typeof row.sourceKey !== 'string' || typeof row.displayPath !== 'string') return undefined
          if (!Array.isArray(row.byAgent)) return undefined
          if (!row.byAgent.every((entry) => isRecord(entry) && isAgent(entry.agent) && isPresence(entry.presence))) return undefined
        }
        return value
      }

      function isRecord(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value)
      }

      function isAgent(value) {
        return value === 'dsh' || value === 'codex' || value === 'claude-code'
      }

      function isEvidence(value) {
        return value === 'observed' || value === 'predicted' || value === 'unavailable'
      }

      function isPresence(value) {
        return value === 'present' || value === 'absent' || value === 'unknown'
      }

      function evidenceLabel(value) {
        if (value === 'observed') return 'Observed'
        if (value === 'predicted') return 'Predicted'
        return 'Unavailable'
      }

      function presenceMark(value) {
        if (value === 'present') return '●'
        if (value === 'absent') return '—'
        return '?'
      }

      function presenceTitle(value) {
        if (value === 'present') return 'Present'
        if (value === 'absent') return 'Absent'
        return 'Unknown'
      }
    },
  })

  const cardStyle = {
    border: '1px solid rgba(127,127,127,.28)',
    borderRadius: '12px',
    padding: '12px',
    margin: '6px 0',
    background: 'rgba(127,127,127,.055)',
    color: 'inherit',
  }
  const headerStyle = { display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }
  const titleStyle = { fontSize: '14px', fontWeight: 650, lineHeight: 1.3 }
  const mutedStyle = { fontSize: '12px', opacity: .68, marginTop: '2px' }
  const cwdStyle = { fontSize: '11px', opacity: .72, marginTop: '5px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', overflowWrap: 'anywhere' }
  const evidenceRowStyle = { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }
  const badgeStyle = { fontSize: '11px', border: '1px solid rgba(127,127,127,.28)', borderRadius: '999px', padding: '2px 7px', whiteSpace: 'nowrap' }
  const tableWrapStyle = { overflowX: 'auto', marginTop: '10px' }
  const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' }
  const headerCellStyle = { textAlign: 'left', fontWeight: 600, padding: '5px 7px', borderBottom: '1px solid rgba(127,127,127,.24)', whiteSpace: 'nowrap' }
  const sourceCellStyle = { padding: '6px 7px', borderBottom: '1px solid rgba(127,127,127,.14)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }
  const markCellStyle = { padding: '6px 10px', borderBottom: '1px solid rgba(127,127,127,.14)', textAlign: 'center', minWidth: '52px' }
  const diagnosticStyle = { fontSize: '11px', opacity: .7, marginTop: '8px' }
})(globalThis)
