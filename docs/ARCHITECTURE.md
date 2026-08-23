# Architecture

## 1. Design objective

Sightline must compare three different instruction systems without mixing their semantics together.

The central architectural rule is:

> Agent-specific discovery and precedence live in adapters; comparison operates only on normalized effective surfaces.

This keeps DSH, Codex, and Claude behavior independently testable and prevents the comparison engine from becoming a pile of tool-specific conditionals.

## 2. High-level system

```text
                       +---------------------+
workspace ------------>| Codex adapter       |-- predicted surface --+
                       +---------------------+                       |
                                                                   |
                       +---------------------+                       |
workspace ------------>| Claude adapter      |-- predicted surface --+--> normalize --> compare --> report
                       +---------------------+                       |
                                                                   |
DSH session evidence ->+---------------------+                       |
                       | DSH adapter          |-- observed surface ---+
                       +---------------------+

canonical report --> DSH tool/API
                 \-> compact Web panel
```

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

## 5. DSH adapter

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

## 6. Codex adapter

The Codex resolver is static/predictive in v0.1.

It models documented Codex workspace-instruction discovery, including global/project layering, nested scope traversal to the target `cwd`, documented override/fallback naming, and the project instruction byte budget.

The resolver exposes a compatibility identifier describing the documentation/behavior version it implements.

Current tests cover:

- global plus project sources;
- nested instruction layering;
- override-file preference;
- configured fallback names;
- repository-bound cwd validation;
- Windows and POSIX path-key normalization.

## 7. Claude Code adapter

The Claude resolver is static/predictive in v0.1.

It models documented Claude Code user/project memory and rule-loading behavior relevant to the target workspace. Always-loaded memory/rules remain distinct from path-scoped rules.

The resolver exposes a compatibility identifier.

Current tests cover:

- user/project `CLAUDE.md` layering;
- nested project memory;
- `.claude/rules/` always-loaded entries;
- detection and explicit deferral of path-scoped rules.

Path-scoped rules are not labelled effective from `cwd` alone because Claude activates them when matching files are read.

## 8. Normalization

Normalization converts adapter-owned source records into comparable identities without erasing meaningful differences.

Rules:

- Use repository-relative logical paths when a source belongs to the repository.
- Preserve an explicit namespace for global/user-level sources.
- Normalize separators for comparison while retaining the original display path.
- Do not case-fold paths unless the owning filesystem semantics justify it and tests prove the intended behavior.
- Do not use content digest as the sole source key.
- Preserve agent-specific order separately from cross-agent source identity.

## 9. Comparison engine

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

## 10. Presentation surfaces

### Machine-readable surface

A DSH tool or host API should return the canonical `SightlineReport` or a lossless serializable projection of it.

### Web panel

The first UI should be deliberately small:

- target `cwd`;
- three agent columns;
- evidence badges (`Observed`, `Predicted`, `Unavailable`);
- source rows;
- divergence count/filter;
- expandable provenance details.

Avoid building a general settings dashboard or context analytics suite.

## 11. Package/integration shape

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
│   └── DSH_RUNTIME_SEAM.md
├── src/
│   ├── contracts.ts
│   ├── filesystem.ts
│   ├── compare.ts
│   ├── report.ts
│   ├── index.ts
│   └── adapters/
│       ├── dsh.ts
│       ├── codex.ts
│       └── claude-code.ts
└── tests/
    ├── core.test.ts
    ├── dsh-observed.integration.test.ts
    └── dsh-public-session.compat.ts
```

`src/host/` and `src/client/` should be created only when host/tool wiring and the compact panel begin; do not pre-fill them with placeholders.

## 12. Dependency policy

The core comparison engine should stay dependency-light.

Before adding a runtime package, ask whether the same behavior can be expressed with:

- platform APIs;
- DSH public services already present in the host;
- a small pure function.

Do not bundle duplicate DSH/Cordis runtimes into the plugin. `@deepseek-ai/dsh-session` is currently a **development-only compatibility dependency** used to prove the structural Session seam at typecheck time; the adapter itself has no runtime import from it.

## 13. Test strategy

Current verified layers:

1. pure unit tests for normalization/comparison;
2. fixture-driven tests for Codex and Claude discovery semantics;
3. focused DSH provenance integration tests over the documented durable event/source shape;
4. compile-time compatibility against published `@deepseek-ai/dsh-session@0.1.1-rc.2`.

Remaining v0.1 integration layers:

5. DSH host/tool wiring that obtains the live agent/session through a supported public host seam;
6. packed-plugin install smoke in a clean DSH profile;
7. one visual/snapshot smoke for the compact panel if the current DSH client testing surface supports it.

A passing static resolver test must never be used as proof of DSH runtime observation.

## 14. Current compatibility baseline

As of 2026-08-23:

- DeepSeek Harness: `0.1.1-rc.2`
- upstream commit: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- published DSH Session compatibility package: `@deepseek-ai/dsh-session@0.1.1-rc.2`
- Node: `^22.19.0 || >=24.0.0`
- pnpm: `11.7.0`

Before host wiring, bundle creation, or client integration, re-fetch upstream `master` and re-read the exact public seam being bound because DSH remains a developer preview.
