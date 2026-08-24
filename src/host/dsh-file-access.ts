import type { FileSystem } from '@deepseek-ai/dsh-fs'

import type {
  ReadOnlyDirectoryEntry,
  ReadOnlyFileAccess,
  ReadOnlyFileInfo,
} from '../filesystem.js'

/**
 * Adapt the public DSH `ctx.fs` service to Sightline's minimal read-only
 * instruction-discovery capability.
 *
 * The adapter deliberately preserves the caller's absolute logical paths while
 * delegating resolution, identity, I/O, and cancellation to the mounted DSH
 * filesystem provider. This keeps Sightline inside the Harness execution world
 * without coupling the core resolvers to DSH packages.
 */
export function createDshReadOnlyFileAccess(fileSystem: FileSystem): ReadOnlyFileAccess {
  return {
    async stat(absolutePath, signal) {
      const target = await resolve(fileSystem, absolutePath, signal)
      const info = await fileSystem.stat(target, signal)
      if (info === undefined) return undefined
      return toFileInfo(info)
    },

    async readText(absolutePath, signal) {
      const target = await resolve(fileSystem, absolutePath, signal)
      return fileSystem.readText(target, signal)
    },

    async listDir(absolutePath, signal) {
      const target = await resolve(fileSystem, absolutePath, signal)
      const info = await fileSystem.stat(target, signal)
      if (info === undefined || info.type !== 'directory') return undefined

      const entries = await fileSystem.listDir(target, signal)
      return entries.map(
        (entry): ReadOnlyDirectoryEntry => ({
          name: entry.name,
          type: entry.type,
        }),
      )
    },
  }
}

async function resolve(fileSystem: FileSystem, absolutePath: string, signal?: AbortSignal) {
  signal?.throwIfAborted()
  return fileSystem.resolve(
    absolutePath,
    signal === undefined ? undefined : { signal },
  )
}

function toFileInfo(info: {
  type: 'file' | 'directory' | 'other'
  size?: number
}): ReadOnlyFileInfo {
  return {
    type: info.type,
    ...(info.size === undefined ? {} : { size: info.size }),
  }
}
