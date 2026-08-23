# DSH runtime seam reconnaissance

Authority rechecked on 2026-08-23 against DeepSeek Harness `0.1.1-rc.2` at `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

## Chosen authority chain

Sightline's DSH column is runtime-observed through the durable Session surface, not through a reimplementation of DSH instruction discovery.

The relevant public contracts are:

1. The public DSH `Agent` handle exposes its live `session`.
2. The Session log is append-only and is the runtime source of truth.
3. `session/event` is the post-commit observer feed for newly appended events.
4. `dsh-agent-instructions` emits model-visible `user/message` events whose source has `kind: "agent-instructions"`, `form: "instructions"`, and ordered `{ action, scope, path, digest? }` changes.
5. `session.surface.nodes` identifies events on the current model-visible Session surface.

Upstream authority:

- `docs/subsystems/core.md`
- `packages/core/session/src/index.ts`
- `packages/context/agent-instructions/README.md`
- `packages/context/agent-instructions/src/state.ts`
- `examples/acp-agent/tests/snapshots/agent-instructions/session.jsonl`

## Why Sightline consumes a structural Session view

The durable `agent-instructions` source shape is documented and present in canonical snapshot evidence, but the `AgentInstructionSource` TypeScript interface is currently defined in the plugin's internal `state.ts` and is not re-exported from the package root.

Sightline therefore does **not** import `@deepseek-ai/dsh-agent-instructions/src/*` or otherwise bind to a private implementation path. `DshObservedAdapter` accepts the minimal public Session shape it needs:

```ts
interface DshSessionView {
  header: { cwd?: string }
  events: readonly { seq: number; type: string; data?: unknown }[]
  surface: { nodes: readonly number[] }
}
```

A future DSH host plugin can pass `Agent.session` directly because it is structurally richer than this view. The adapter remains independent from host lookup/initiator mechanics.

## Fold contract

Sightline scans the durable log for typed `agent-instructions` provenance and folds only instruction messages whose event sequence is present in the current Session surface.

For every visible transition:

- `set` activates a logical instruction scope;
- `replace` replaces that scope with the newly observed path/digest;
- `remove` removes the scope from the effective set.

The resulting sources are labelled **Observed**.

Ordering is intentionally described as `visible-session-transition-order`: it reflects the order of the latest effective durable transitions on the current model-visible surface. Sightline does not pretend this is a separately reconstructed static DSH filesystem precedence model.

## Fail-closed cases

The adapter returns `unavailable` rather than guessing when:

- no live Session is available;
- the Session has no cwd;
- its cwd does not match the requested Sightline cwd;
- no durable typed `agent-instructions` source exists, because an empty workspace cannot then be distinguished from a composition where the instruction plugin is absent;
- an observed `agent-instructions` payload no longer matches the documented durable shape;
- Session access throws.

An unavailable DSH surface remains `unknown`, not `absent`, in cross-agent comparison.

## Focused integration-test boundary

The first integration test uses the same durable event/source shape demonstrated by upstream's committed `agent-instructions` snapshot. It exercises baseline `set`, dynamic `replace`, `remove`, current-surface filtering, cwd binding, absence of provenance, and incompatible source shape.

This proves the adapter's runtime-provenance fold without claiming that the full installable DSH bundle or UI integration is complete. Host wiring and packed-plugin smoke remain later milestones.
