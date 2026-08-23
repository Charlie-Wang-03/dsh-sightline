import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

export interface FileSnapshot {
  absolutePath: string
  content: string
  digest: string
  bytes: number
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

export async function readFileSnapshot(absolutePath: string): Promise<FileSnapshot | undefined> {
  try {
    const fileStat = await stat(absolutePath)
    if (!fileStat.isFile()) return undefined
    const content = await readFile(absolutePath, 'utf8')
    return {
      absolutePath,
      content,
      digest: createHash('sha256').update(content).digest('hex'),
      bytes: Buffer.byteLength(content),
    }
  } catch (error) {
    if (isMissingPathError(error)) return undefined
    throw error
  }
}

export async function firstExistingFile(
  directory: string,
  filenames: readonly string[],
): Promise<FileSnapshot | undefined> {
  for (const filename of filenames) {
    const snapshot = await readFileSnapshot(path.join(directory, filename))
    if (snapshot) return snapshot
  }
  return undefined
}

export async function listMarkdownFilesRecursively(directory: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (isMissingPathError(error)) return []
    throw error
  }

  const files: string[] = []
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFilesRecursively(absolutePath)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath)
    }
  }
  return files
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}
