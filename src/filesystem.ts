import { createHash } from 'node:crypto'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

export interface FileSnapshot {
  absolutePath: string
  content: string
  digest: string
  bytes: number
}

export interface ReadOnlyFileInfo {
  type: 'file' | 'directory' | 'other'
  size?: number
}

export interface ReadOnlyDirectoryEntry {
  name: string
  type: 'file' | 'directory' | 'other'
}

/**
 * Minimal read-only filesystem capability required by instruction resolvers.
 *
 * Standalone use defaults to the host Node filesystem. DSH host integration
 * supplies an implementation backed by the public `ctx.fs` capability so the
 * same adapters run in the Harness filesystem execution world.
 *
 * `containmentRoot` is a trust boundary, not a display/path-prefix hint. When
 * supplied, implementations must resolve aliases/symlinks canonically and
 * refuse a target outside that root before reading or listing its contents.
 */
export interface ReadOnlyFileAccess {
  stat(
    absolutePath: string,
    signal?: AbortSignal,
    containmentRoot?: string,
  ): Promise<ReadOnlyFileInfo | undefined>
  readText(
    absolutePath: string,
    signal?: AbortSignal,
    containmentRoot?: string,
  ): Promise<string>
  listDir(
    absolutePath: string,
    signal?: AbortSignal,
    containmentRoot?: string,
  ): Promise<readonly ReadOnlyDirectoryEntry[] | undefined>
}

export const nodeReadOnlyFileAccess: ReadOnlyFileAccess = {
  async stat(absolutePath, signal, containmentRoot) {
    signal?.throwIfAborted()
    try {
      const resolvedPath = await resolveReadPath(absolutePath, containmentRoot, signal)
      const info = await stat(resolvedPath)
      signal?.throwIfAborted()
      return {
        type: info.isFile() ? 'file' : info.isDirectory() ? 'directory' : 'other',
        size: info.size,
      }
    } catch (error) {
      signal?.throwIfAborted()
      if (isMissingPathError(error)) return undefined
      throw error
    }
  },

  async readText(absolutePath, signal, containmentRoot) {
    signal?.throwIfAborted()
    const resolvedPath = await resolveReadPath(absolutePath, containmentRoot, signal)
    const content = await readFile(resolvedPath, 'utf8')
    signal?.throwIfAborted()
    return content
  },

  async listDir(absolutePath, signal, containmentRoot) {
    signal?.throwIfAborted()
    try {
      const resolvedPath = await resolveReadPath(absolutePath, containmentRoot, signal)
      const entries = await readdir(resolvedPath, { withFileTypes: true })
      signal?.throwIfAborted()
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.isFile() ? 'file' : entry.isDirectory() ? 'directory' : 'other',
      }))
    } catch (error) {
      signal?.throwIfAborted()
      if (isMissingPathError(error) || isNotDirectoryError(error)) return undefined
      throw error
    }
  },
}

export function normalizePathForKey(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/{2,}/g, '/')
}

export function isWithinRepository(repositoryRoot: string, target: string): boolean {
  const root = path.resolve(repositoryRoot)
  const resolvedTarget = path.resolve(target)
  const relative = path.relative(root, resolvedTarget)

  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}

export function directoryChain(repositoryRoot: string, cwd: string): string[] {
  const root = path.resolve(repositoryRoot)
  const target = path.resolve(cwd)

  if (!isWithinRepository(root, target)) {
    throw new Error('cwd must be inside repositoryRoot')
  }

  const relative = path.relative(root, target)
  if (relative === '') return [root]

  const result = [root]
  let current = root
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    result.push(current)
  }
  return result
}

export function repositorySourceKey(repositoryRoot: string, absolutePath: string): string {
  const root = path.resolve(repositoryRoot)
  const target = path.resolve(absolutePath)
  if (!isWithinRepository(root, target)) {
    throw new Error('repository source must be inside repositoryRoot')
  }

  return `repo:${normalizePathForKey(path.relative(root, target))}`
}

export function repositoryDisplayPath(repositoryRoot: string, absolutePath: string): string {
  return normalizePathForKey(path.relative(path.resolve(repositoryRoot), path.resolve(absolutePath)))
}

export async function readFileSnapshot(
  absolutePath: string,
  fileAccess: ReadOnlyFileAccess = nodeReadOnlyFileAccess,
  signal?: AbortSignal,
  containmentRoot?: string,
): Promise<FileSnapshot | undefined> {
  signal?.throwIfAborted()
  const fileInfo = await fileAccess.stat(absolutePath, signal, containmentRoot)
  if (fileInfo?.type !== 'file') return undefined

  const content = await fileAccess.readText(absolutePath, signal, containmentRoot)
  signal?.throwIfAborted()
  return {
    absolutePath,
    content,
    digest: createHash('sha256').update(content).digest('hex'),
    bytes: Buffer.byteLength(content),
  }
}

export async function firstExistingFile(
  directory: string,
  filenames: readonly string[],
  fileAccess: ReadOnlyFileAccess = nodeReadOnlyFileAccess,
  signal?: AbortSignal,
  containmentRoot?: string,
): Promise<FileSnapshot | undefined> {
  for (const filename of filenames) {
    signal?.throwIfAborted()
    const snapshot = await readFileSnapshot(
      path.join(directory, filename),
      fileAccess,
      signal,
      containmentRoot,
    )
    if (snapshot) return snapshot
  }
  return undefined
}

export async function listMarkdownFilesRecursively(
  directory: string,
  fileAccess: ReadOnlyFileAccess = nodeReadOnlyFileAccess,
  signal?: AbortSignal,
  containmentRoot?: string,
): Promise<string[]> {
  signal?.throwIfAborted()
  const entries = await fileAccess.listDir(directory, signal, containmentRoot)
  if (entries === undefined) return []

  const files: string[] = []
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    signal?.throwIfAborted()
    const absolutePath = path.join(directory, entry.name)
    if (entry.type === 'directory') {
      files.push(...(await listMarkdownFilesRecursively(
        absolutePath,
        fileAccess,
        signal,
        containmentRoot,
      )))
    } else if (entry.type === 'file' && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath)
    }
  }
  return files
}

async function resolveReadPath(
  absolutePath: string,
  containmentRoot: string | undefined,
  signal?: AbortSignal,
): Promise<string> {
  if (containmentRoot === undefined) return absolutePath

  signal?.throwIfAborted()
  const [canonicalRoot, canonicalTarget] = await Promise.all([
    realpath(containmentRoot),
    realpath(absolutePath),
  ])
  signal?.throwIfAborted()

  if (!isWithinRepository(canonicalRoot, canonicalTarget)) {
    throw new Error(`instruction discovery refused a path outside the repository containment root: ${absolutePath}`)
  }
  return canonicalTarget
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

function isNotDirectoryError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOTDIR'
  )
}
