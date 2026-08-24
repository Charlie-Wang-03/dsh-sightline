# Architecture

## 1. Design objective

Sightline must compare three different instruction systems without mixing their semantics together.

The central architectural rule is:

> Agent-specific discovery and precedence live in adapters; comparison operates only on normalized effective surfaces.

This keeps DSH, Codex, and Claude behavior independently testable and prevents the comparison engine from becoming a pile of tool-specific conditionals.

## 2. High-level system

```text
                              +---------------------+
read-only file capability --->| Codex adapter       |-- predicted surface --+
                              +---------------------+                       |
                                                                          |
                              +---------------------+                       |
read-only file capability --->| Claude adapter      |-- predicted surface --+--> normalize --> compare --> report
                              +---------------------+                       |
                                                                          |
DSH session evidence -------->+---------------------+                       |
                              | DSH adapter          |-- observed surface ---+
                              +---------------------+

canonical report --> DSH tool/API
                 \-> compact Web panel
```

The read-only file capability has two bindings:

- standalone/core use defaults to the local Node filesystem;
- DSH host use is always adapted from the public `ctx.fs` service.

## 3. Core domain model

The initial public internal contract lives in `src/contracts.ts`.

### `AgentId`

Exactly:

- `dsh`
- `codex`
- `claude-code`

Do not add generic string extension points in v0.1. A closed union makes accidental product-scope expansion visible in code review.

### `EvidenceKind`

- `observed` — derived from an authoritative runtime/session seam.
- `predicted` — derived from documented semantics plus local state.
- `unavailable` — Sightline cannot establish a trustworthy surface.

`unavailable` is not equivalent to an empty surface.

### `InstructionSource`

Represents one logical instruction source after adapter resolution. It should carry:

- a stable normalized source key;
- display path/name;
- scope kind;
- order within that adapter's effective instruction surface;
- optional content digest when available and safe;
- adapter-owned metadata needed to explain provenance.

Source identity and content identity must remain separate.

### `EffectiveInstructionSurface`

One adapter's result for one `cwd`:

- agent;
- evidence kind;
- resolver compatibility identity;
- ordered sources;
- diagnostics.

### `ResolveInput`

Resolver input contains the target repository root and `cwd`, plus an optional `AbortSignal`. The signal is execution control only; it is not part of the canonical semantic report.

### `SightlineReport`

The comparison engine's canonical result. It is presentation-neutral and deterministic.

The DSH tool/API and Web panel must render the same report model rather than implementing two independent comparison paths.

## 4. Adapter boundary

Each adapter implements the conceptual contract:

```ts
interface InstructionAdapter {
  readonly agent: AgentId
  resolve(input: ResolveInput): Promise<EffectiveInstructionSurface>
}
```

Adapters own:

- where they look for sources;
- how they determine project/global scope;
- discovery order;
- precedence/order semantics;
- compatibility/version notes;
- diagnostics for unsupported cases.

Adapters do **not** own:

- cross-agent comparison;
- UI formatting;
- generic path normalization policy shared by all adapters;
- semantic evaluation of instruction text.

## 5. Read-only filesystem boundary

Codex and Claude prediction require filesystem state, but the core resolvers must not be tied to one host execution world.

`src/filesystem.ts` therefore exposes a deliberately small `ReadOnlyFileAccess` contract:

```text
stat(path)
readText(path)
listDir(path)
```

The shared resolver helpers layer deterministic hashing, first-match selection, bounded documented traversal, and Markdown-rule recursion on top of that contract.

The default implementation uses Node `fs` so adapters remain useful as a standalone library. DSH integration must not select that default. `src/host/dsh-file-access.ts` adapts the public DSH `FileSystem` service by delegating to `resolve`, `stat`, `readText`, and `listDir`; cancellation is passed through to the DSH provider.

This separation matters because `ctx.fs` is the DSH filesystem capability seam. A Harness deployment may swap the local provider for a sandboxed, remote, virtual, or project-scoped implementation without requiring the Sightline adapters to acquire a second filesystem model.

The capability remains read-only from Sightline's perspective. The plugin never calls `writeText` or `editText`.

## 6. DSH adapter

### Evidence source

The DSH column is runtime-observed from the public Session authority chain verified against DSH `0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

The public `Agent` handle exposes `agent.session`. The Session log is append-only, `session/event` is its post-commit observer feed, and `dsh-agent-instructions` records durable `user/message` events with typed `agent-instructions` source data. The current model-visible authority is selected through `session.surface.nodes`.

`DshObservedAdapter` deliberately accepts a structural subset of the public Session handle instead of importing the internal `AgentInstructionSource` interface from `@deepseek-ai/dsh-agent-instructions/src/state.ts`, which is not re-exported from the plugin root. A compile-time compatibility check pins the adapter view against the published `@deepseek-ai/dsh-session@0.1.1-rc.2` type.

See [`DSH_RUNTIME_SEAM.md`](DSH_RUNTIME_SEAM.md) for the detailed evidence chain.

### Required behavior

- If authoritative typed instruction provenance exists for the requested Session/cwd, return `observed`.
- Fold visible `set`, `replace`, and `remove` transitions by their logical DSH instruction scope.
- Use only events present on the current Session surface when deriving the effective set.
- If the Session, cwd binding, source shape, or typed provenance cannot establish a trustworthy view, return `unavailable` with a diagnostic.
- Do not silently reimplement DSH filesystem discovery and label it observed.

The adapter's `order` currently means latest effective **visible-session transition order**, not a separately reconstructed static DSH filesystem precedence model. That distinction is exposed in provenance.

A future product version may add an explicitly labelled DSH prediction mode, but that is outside the v0.1 contract.

## 7. Codex adapter

The Codex resolver is static/predictive in v0.1.

It models documented Codex workspace-instruction discovery, including global/project layering, nested scope traversal to the target `cwd`, documented override/fallback naming, and the project instruction byte budget.

The resolver consumes `ReadOnlyFileAccess` and exposes a compatibility identifier describing the documentation/behavior version it implements.

Current tests cover:

- global plus project sources;
- nested instruction layering;
- override-file preference;
- configured fallback names;
- repository-bound cwd validation;
- Windows and POSIX path-key normalization.

## 8. Claude Code adapter

The Claude resolver is static/predictive in v0.1.

It models documented Claude Code user/project memory and rule-loading behavior relevant to the target workspace. Always-loaded memory/rules remain distinct from path-scoped rules.

The resolver consumes the same `ReadOnlyFileAccess` capability and exposes a compatibility identifier.

Current tests cover:

- user/project `CLAUDE.md` layering;
- nested project memory;
- `.claude/rules/` always-loaded entries;
- detection and explicit deferral of path-scoped rules.

Path-scoped rules are not labelled effective from `cwd` alone because Claude activates them when matching files are read.

## 9. Normalization

Normalization converts adapter-owned source records into comparable identities without erasing meaningful differences.

Rules:

- Use repository-relative logical paths when a source belongs to the repository.
- Preserve an explicit namespace for global/user-level sources.
- Normalize separators for comparison while retaining the original display path.
- Do not case-fold paths unless the owning filesystem semantics justify it and tests prove the intended behavior.
- Do not use content digest as the sole source key.
- Preserve agent-specific order separately from cross-agent source identity.

## 10. Comparison engine

The comparison layer is a pure function over normalized surfaces.

For each normalized source key it derives per-agent presence:

- `present`
- `absent`
- `unknown`

`unknown` is used when an adapter surface is `unavailable` or when that adapter cannot establish the source's status.

The engine can therefore report:

- sources shared by all established surfaces;
- subset-only sources;
- ordering differences when the same source set is ordered differently;
- per-agent evidence kind and diagnostics.

No prose-content similarity or contradiction inference belongs here in v0.1.

## 11. DSH host/tool surface

The first machine-readable host surface is implemented in `src/host/dsh-tool.ts`.

It registers one argument-free `sightline` tool through the public DSH `ctx.tools` registry and requires both `tools` and `fs`. DSH places the calling agent on `ToolRunContext.agent`, so runtime ownership is explicit:

```text
sightline tool call
  -> exec.agent
  -> exec.agent.session
  -> DshObservedAdapter
```

The tool does not consult a global agent list and does not infer which Session the caller intended. A call without an owning agent fails closed.

The Session `cwd` is authoritative. Repository-root discovery walks upward for the nearest `.git` marker and, matching the current DSH workspace-root fallback, uses `cwd` if no marker exists. In the DSH plugin this lookup itself uses the mounted `ctx.fs` adapter. The same `{ repositoryRoot, cwd }`, file capability, and caller signal are supplied to both static adapters.

The tool returns the canonical `SightlineReport` as JSON. Its model-facing Markdown table is a pure projection of that same report, so there is still only one comparison path. Caller cancellation is observed during root/resolver I/O, and presentation of an incompatible replayed JSON value falls back to an explicit unavailable message instead of throwing.

See [`DSH_HOST_TOOL.md`](DSH_HOST_TOOL.md) for the seam evidence and first three-column example.

## 12. Presentation surfaces

### Machine-readable surface — implemented

The DSH `sightline` tool returns the canonical report as its structured JSON value and renders a compact source-by-agent matrix for the model.

### Web panel — pending

The first UI should be deliberately small:

- target `cwd`;
- three agent columns;
- evidence badges (`Observed`, `Predicted`, `Unavailable`);
- source rows;
- divergence count/filter;
- expandable provenance details.

Avoid building a general settings dashboard or context analytics suite.

## 13. Package/integration shape

DeepSeek Harness currently distributes third-party plugins as installable bundles with a `dsh.bundle` manifest and `cordis.patch.yml` layer. Runtime packaging should follow the current supported bundle mechanism rather than patching the DSH repository.

Current repository shape:

```text
dsh-sightline/
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── docs/
│   ├── PRODUCT_CONTRACT.md
│   ├── ARCHITECTURE.md
│   ├── COMPATIBILITY.md
│   ├── DSH_RUNTIME_SEAM.md
│   └── DSH_HOST_TOOL.md
├── src/
│   ├── contracts.ts
│   ├── filesystem.ts
│   ├── compare.ts
│   ├── report.ts
│   ├── index.ts
│   ├── adapters/
│   │   ├── dsh.ts
│   │   ├── codex.ts
│   │   └── claude-code.ts
│   └── host/
│       ├── dsh-file-access.ts
│       └── dsh-tool.ts
└── tests/
    ├── core.test.ts
    ├── dsh-observed.integration.test.ts
    ├── dsh-host.integration.test.ts
    └── dsh-public-session.compat.ts
```

The installable `dsh.bundle` manifest, `cordis.patch.yml`, build/prepare packaging path, and clean-profile installation smoke are intentionally not claimed by this milestone. `src/client/` should not be created until the compact panel begins.

## 14. Dependency policy

The core comparison engine and resolver abstraction remain free of DSH runtime dependencies.

The host layer uses DSH packages only at the boundary where they are required:

- `@deepseek-ai/dsh-tools` supplies the supported `defineTool` / `ctx.tools` contract;
- `@deepseek-ai/dsh-fs` supplies the public filesystem capability type consumed through `ctx.fs`;
- `@deepseek-ai/cordis` supplies the plugin `Context` type;
- these host packages are peer dependencies rather than bundled duplicate runtimes.

`@deepseek-ai/dsh-session` remains a development-only compatibility dependency used to prove the structural Session seam at typecheck time; the observed adapter itself has no runtime import from it. `@deepseek-ai/dsh-fs-local` and the other DSH packages used to reproduce the first-party host-test stack are development-only test dependencies.

Before adding another runtime package, ask whether the same behavior can be expressed with platform APIs, an existing DSH public service, or a small pure function.

## 15. Test strategy

Current verified layers:

1. pure unit tests for normalization/comparison;
2. fixture-driven tests for Codex and Claude discovery semantics using the default Node read-only adapter;
3. focused DSH provenance integration tests over the documented durable event/source shape;
4. compile-time compatibility against published `@deepseek-ai/dsh-session@0.1.1-rc.2`;
5. real Cordis + published DSH `SystemPrompt` + `ToolRuntime` + `SessionStore` + `LocalFileSystem` host integration, mounting Sightline through `ctx.plugin(...)` and invoking the registered tool through `ctx.tools.execute(...)` against a real DSH Session.

The host integration fixture deliberately demonstrates:

- `AGENTS.md`: DSH + Codex;
- `CLAUDE.md`: DSH + Claude;
- nested `packages/api/AGENTS.md`: DSH + Codex;
- `.claude/rules/always.md`: Claude only;
- explicit `Observed` / `Predicted` labels in the tool rendering;
- DSH `ctx.fs` as the host filesystem provider;
- caller cancellation before filesystem work;
- total rendering for incompatible replayed generic JSON.

Remaining v0.1 integration layers:

6. packed-plugin install smoke in a clean DSH profile;
7. one visual/snapshot smoke for the compact panel if the current DSH client testing surface supports it.

A passing static resolver test must never be used as proof of DSH runtime observation.

## 16. Current compatibility baseline

As rechecked on 2026-08-24:

- DeepSeek Harness: `0.1.1-rc.2`
- upstream commit: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- published DSH Session compatibility package: `@deepseek-ai/dsh-session@0.1.1-rc.2`
- host tool API: `@deepseek-ai/dsh-tools@0.1.1-rc.2`
- filesystem capability API: `@deepseek-ai/dsh-fs@0.1.1-rc.2`
- host integration filesystem provider: `@deepseek-ai/dsh-fs-local@0.1.1-rc.2`
- Cordis host API: `@deepseek-ai/cordis@4.0.1`
- Node: `^22.19.0 || >=24.0.0`
- pnpm: `11.7.0`

Before bundle creation or client integration, re-fetch upstream `master` and re-read the exact public seam being bound because DSH remains a developer preview.
