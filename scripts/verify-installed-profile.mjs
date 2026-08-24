import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const profileDirArg = process.argv[2]
if (profileDirArg === undefined) {
  throw new Error('usage: node scripts/verify-installed-profile.mjs <profile-dir>')
}

const profileDir = path.resolve(profileDirArg)
const requireFromProfile = createRequire(path.join(profileDir, 'package.json'))

const packagePath = requireFromProfile.resolve('dsh-sightline/package.json')
const manifest = JSON.parse(await readFile(packagePath, 'utf8'))

assert.equal(manifest.name, 'dsh-sightline')
assert.equal(manifest.version, '0.1.0')
assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
assert.equal(manifest.dsh?.client?.platform, 'web')
assert.deepEqual(manifest.dsh?.client?.inject, ['@deepseek-ai/dsh-client-ui-tool'])

const pluginPath = requireFromProfile.resolve('dsh-sightline')
const plugin = await import(pathToFileURL(pluginPath).href)
assert.equal(plugin.name, 'dsh-sightline')
assert.equal(typeof plugin.apply, 'function')
assert.ok(Array.isArray(plugin.inject))
assert.ok(plugin.inject.includes('tools'))
assert.ok(plugin.inject.includes('fs'))

const clientPath = requireFromProfile.resolve('dsh-sightline/client')
const clientSource = await readFile(clientPath, 'utf8')
assert.match(clientSource, /__ModuleLoader__/)
assert.match(clientSource, /id: 'dsh-sightline'/)
assert.match(clientSource, /key: 'sightline'/)

console.log(`verified installed dsh-sightline@${manifest.version}`)
console.log(`plugin: ${pluginPath}`)
console.log(`client: ${clientPath}`)
