import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

interface ClientRegistration {
  id: string
  factory: (require: (specifier: string) => unknown) => {
    apply: (ctx: unknown) => void
    inject: readonly string[]
  }
}

test('package exposes the supported DSH bundle and web client surfaces', async () => {
  const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8')) as {
    version: string
    main: string
    exports: Record<string, unknown>
    dsh: {
      bundle: { patch: string }
      client: { platform: string; inject: string[] }
    }
  }
  const patch = await readFile(path.resolve('cordis.patch.yml'), 'utf8')

  assert.equal(packageJson.version, '0.1.0')
  assert.equal(packageJson.main, 'dist/src/index.js')
  assert.equal(packageJson.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(packageJson.dsh.client.platform, 'web')
  assert.deepEqual(packageJson.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-tool'])
  assert.equal(packageJson.exports['./client'], './client.js')
  assert.match(patch, /id: sightline/)
  assert.match(patch, /name: dsh-sightline/)
})

test('client bundle registers a Sightline toolview and renders the canonical report meta', async () => {
  const registration = await loadClientRegistration()
  assert.equal(registration.id, 'dsh-sightline')

  const fakeReact = {
    createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
      return { type, props: { ...(props ?? {}), children } }
    },
  }

  const clientPlugin = registration.factory((specifier) => {
    if (specifier === 'react') return fakeReact
    throw new Error(`unexpected client require: ${specifier}`)
  })
  assert.deepEqual([...clientPlugin.inject], ['slots'])

  let injectedSlot: string | undefined
  let registeredSpec: Record<string, unknown> | undefined
  let component: ((props: { block: unknown }) => unknown) | undefined

  const ctx = {
    slots: {
      inject(name: string, callback: () => unknown) {
        injectedSlot = name
        return callback()
      },
      register(spec: Record<string, unknown>, candidate: (props: { block: unknown }) => unknown) {
        registeredSpec = spec
        component = candidate
        return () => undefined
      },
    },
  }

  clientPlugin.apply(ctx)
  assert.equal(injectedSlot, 'tool.call.toolview')
  assert.equal(registeredSpec?.name, 'tool.call.toolview')
  assert.equal(registeredSpec?.key, 'sightline')
  assert.ok(component)

  const report = sampleReport()
  const rendered = component({ block: { kind: 'tool-result', meta: report } })
  const text = collectText(rendered).join(' ')

  assert.match(text, /Sightline/)
  assert.match(text, /Same repo\. Different agents\. Different rules\./)
  assert.match(text, /cwd: \/repo\/packages\/api/)
  assert.match(text, /DSH: Observed/)
  assert.match(text, /Codex: Predicted/)
  assert.match(text, /Claude: Predicted/)
  assert.match(text, /AGENTS\.md/)
  assert.match(text, /CLAUDE\.md/)
  assert.match(text, /\.claude\/rules\/always\.md/)
  assert.match(text, /●/)
  assert.match(text, /—/)
  assert.match(text, /\?/)
  assert.match(text, /claude-code: claude-path-scoped-rules-deferred — fixture/)

  const running = collectText(component({ block: { callId: 'call-1' } })).join(' ')
  assert.match(running, /Comparing workspace instruction surfaces/)

  const incompatible = collectText(component({ block: { kind: 'tool-result', meta: null } })).join(' ')
  assert.match(incompatible, /Structured Sightline report unavailable/)

  const malformedDiagnostic = structuredClone(report)
  malformedDiagnostic.surfaces['claude-code'].diagnostics = [null] as never
  const malformed = collectText(component({ block: { kind: 'tool-result', meta: malformedDiagnostic } })).join(' ')
  assert.match(malformed, /Structured Sightline report unavailable/)
})

async function loadClientRegistration(): Promise<ClientRegistration> {
  const code = await readFile(path.resolve('client.js'), 'utf8')
  let registration: ClientRegistration | undefined
  const sandbox = {
    __ModuleLoader__: {
      load(value: ClientRegistration) {
        registration = value
      },
    },
  }

  vm.runInNewContext(code, sandbox, { filename: 'client.js' })
  assert.ok(registration, 'client.js did not register with __ModuleLoader__')
  return registration
}

function collectText(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string' || typeof value === 'number') {
    output.push(String(value))
    return output
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output)
    return output
  }
  if (value !== null && typeof value === 'object') {
    const props = (value as { props?: { children?: unknown } }).props
    if (props?.children !== undefined) collectText(props.children, output)
  }
  return output
}

function sampleReport() {
  return {
    schemaVersion: 1,
    repositoryRoot: '/repo',
    cwd: '/repo/packages/api',
    surfaces: {
      dsh: {
        agent: 'dsh',
        evidence: 'observed',
        cwd: '/repo/packages/api',
        resolverVersion: 'dsh-test',
        sources: [],
        diagnostics: [],
      },
      codex: {
        agent: 'codex',
        evidence: 'predicted',
        cwd: '/repo/packages/api',
        resolverVersion: 'codex-test',
        sources: [],
        diagnostics: [],
      },
      'claude-code': {
        agent: 'claude-code',
        evidence: 'predicted',
        cwd: '/repo/packages/api',
        resolverVersion: 'claude-test',
        sources: [],
        diagnostics: [{ code: 'claude-path-scoped-rules-deferred', message: 'fixture' }],
      },
    },
    divergences: [
      {
        sourceKey: 'repo:AGENTS.md',
        displayPath: 'AGENTS.md',
        byAgent: [
          { agent: 'dsh', presence: 'present', order: 0 },
          { agent: 'codex', presence: 'present', order: 0 },
          { agent: 'claude-code', presence: 'absent' },
        ],
      },
      {
        sourceKey: 'repo:CLAUDE.md',
        displayPath: 'CLAUDE.md',
        byAgent: [
          { agent: 'dsh', presence: 'present', order: 1 },
          { agent: 'codex', presence: 'absent' },
          { agent: 'claude-code', presence: 'present', order: 0 },
        ],
      },
      {
        sourceKey: 'repo:.claude/rules/always.md',
        displayPath: '.claude/rules/always.md',
        byAgent: [
          { agent: 'dsh', presence: 'unknown' },
          { agent: 'codex', presence: 'absent' },
          { agent: 'claude-code', presence: 'present', order: 1 },
        ],
      },
    ],
  }
}
