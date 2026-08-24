# Security Policy

## Supported versions

Sightline is currently a pre-1.0 project. Security fixes are provided for the latest published `0.1.x` release and the current default branch when practical.

| Version | Supported |
| --- | --- |
| latest `0.1.x` | Yes |
| older prerelease snapshots | No guarantee |

## Reporting a vulnerability

Please do not publish exploit details, credentials, private workspace paths, or sensitive session material in a public issue.

After this repository is public and GitHub private vulnerability reporting is enabled, use the repository's **Security → Report a vulnerability** flow.

If private reporting is temporarily unavailable, open a minimal public issue asking the maintainer for a private reporting channel. Do not include sensitive reproduction details in that issue.

A useful report includes:

- affected Sightline version or commit;
- DeepSeek Harness version;
- operating system;
- a minimal reproduction;
- expected versus observed behavior;
- impact and the security boundary you believe is crossed.

## Security boundaries

Sightline is a read-only inspection plugin. Its v0.1 security posture is intentionally narrow:

- core operation does not require a Sightline-owned network service;
- Sightline does not edit workspace instruction files;
- hosted filesystem discovery uses the public DSH `ctx.fs` capability;
- DSH runtime evidence is labelled `Observed` only when authoritative session provenance is available;
- missing or incompatible evidence fails closed as `Unavailable` / `Unknown` rather than being guessed.

Sightline does **not** provide or replace:

- the DeepSeek Harness sandbox, authentication, authorization, or permission system;
- isolation between a compromised Harness runtime and the host machine;
- protection against malicious dependencies or install-time scripts outside Sightline's runtime;
- guarantees that a model follows an instruction merely because the instruction is visible;
- security guarantees for Codex, Claude Code, or DeepSeek Harness themselves.

When Sightline runs as a DSH tool, its model-facing projection is handled by the model/provider configured for that DSH session like other tool output. Sightline itself does not make an additional network request for that projection. See `docs/PRODUCT_CONTRACT.md` for the exact privacy contract.

## Upstream issues

If a report is caused by DeepSeek Harness or another dependency rather than Sightline, we may redirect it upstream after confirming that no Sightline-specific exposure remains.
