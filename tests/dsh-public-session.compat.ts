import type { Session } from '@deepseek-ai/dsh-session'

import type { DshSessionView } from '../src/index.js'

/**
 * Compile-time integration contract: the published public DSH Session handle
 * must remain structurally assignable to the minimal view consumed by
 * DshObservedAdapter. A DSH API change that breaks this seam fails typecheck.
 */
export function asSightlineDshSession(session: Session): DshSessionView {
  return session
}
