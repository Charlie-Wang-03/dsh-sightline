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
 * filesystem provider. Repository-scoped reads additionally use the public
 * canonical `contains()` seam so symlinks/aliases cannot escape their trust
 * boundary while still allowing aliases whose resolved target remains inside.
 */
export function createDshReadOnlyFileAccess(fileSystem: FileSystem): ReadOnlyFileAccess {
  return {
    async stat(absolutePath, signal, containmentRoot) {
      const target = await resolve(fileSystem, absolutePath, signal, containmentRoot)
      const info = await fileSystem.stat(target, signal)
      if (info === undefined) return undefined
      return toFileInfo(info)
    },

    async readText(absolutePath, signal, containmentRoot) {
      const target = await resolve(fileSystem, absolutePath, signal, containmentRoot)
      return fileSystem.readText(target, signal)
    },

    async listDir(absolutePath, signal, containmentRoot) {
      const target = await resolve(fileSystem, absolutePath, signal, containmentRoot)
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

async function resolve(
  fileSystem: FileSystem,
  absolutePath: string,
  signal?: AbortSignal,
  containmentRoot?: string,
) {
  signal?.throwIfAborted()
  const target = await fileSystem.resolve(
    absolutePath,
    signal === undefined ? undefined : { signal },
  )

  if (containmentRoot !== undefined) {
    const root = await fileSystem.resolve(
      containmentRoot,
      signal === undefined ? undefined : { signal },
    )
    signal?.throwIfAborted()
    if (!fileSystem.contains(root, target)) {
      throw new Error(`instruction discovery refused a path outside the repository containment root: ${absolutePath}`)
    }
  }

  return target
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
