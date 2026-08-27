# v0.1.0 Release Readiness Checklist

This checklist separates pre-release acceptance from launch execution and post-publication verification. Passing an individual item is evidence for that item only; it is not a certification of the whole project. Sections A-E determine release-candidate readiness; Sections F-H contain optional polish, external launch actions, and post-publication checks.

## A. Product and truth boundary

- [x] v0.1 product scope is frozen in `docs/PRODUCT_CONTRACT.md`.
- [x] DSH `Observed`, Codex / Claude `Predicted`, and `Unavailable` remain distinct truth states.
- [x] Core operation is read-only and local-first.
- [x] Privacy wording distinguishes the full canonical report from the model-facing projection.
- [x] Model-facing renderer omits absolute workspace paths and full diagnostic messages by default; regression-covered in CI.
- [x] Repository-scoped instruction discovery rejects canonical symlink/alias targets outside the repository while preserving targets that remain inside.

## B. Legal and community

- [x] MIT License selected and committed.
- [x] `package.json` declares `license: MIT` and public repository metadata.
- [x] `SECURITY.md` defines vulnerability reporting and product security boundaries.
- [x] `CONTRIBUTING.md` defines contribution expectations and v0.1 scope discipline.
- [x] README contains an independent-community-project disclaimer.

## C. Packaging and reproducibility

- [x] npm prebuilt package selected as the primary public installation path.
- [x] package manifest is publishable and uses `publishConfig.access: public`.
- [x] installable DSH bundle and Web client exports are implemented.
- [x] clean-profile packed-artifact installation has passed.
- [x] `pnpm-lock.yaml` generated and committed with pnpm 11.7.0.
- [x] CI installs with `pnpm install --frozen-lockfile`.
- [x] CI verifies the packed artifact contains required public surfaces and rejects unexpected development/sensitive paths.
- [x] The source manifest intentionally retains `prepare: pnpm run build:host` for source/Git installs; `pnpm pack` runs that build and omits `prepare` from the packed manifest. The exact tarball and installed profile contain neither `prepare` nor `install`, so normal npm installation uses the prebuilt artifacts without rebuilding Sightline.
- [x] Live npm lookup returned `E404 Not Found` for `dsh-sightline` immediately before first publication on 2026-08-24; the exact verified `dsh-sightline@0.1.0` artifact was then published successfully and is now the `latest` registry version.

## D. Verification

- [x] TypeScript typecheck exists.
- [x] Automated suite contains **23** tests after repository-containment hardening. Final PR CI runs `32704836493` and `32704994326` pass Ubuntu and Windows core; the Ubuntu run executes **23 / 23 PASS** with 0 skipped, while Windows passes all applicable tests including the cross-platform directory-link case for junction containment.
- [x] Real DSH `ToolRuntime + SessionStore + dsh-fs-local` integration exists.
- [x] Browser ToolView registration/render smoke exists.
- [x] Clean-profile CI exists.
- [x] Human Windows DSH Web smoke has been completed against `0.1.1-rc.2` on the pre-hardening v0.1 package.
- [x] CI run `32691715922` passes Ubuntu core, Windows core, release dependency audit, packed-artifact validation, and clean-profile installation/export resolution.
- [x] Final Windows engineering checks and isolated-profile installation/export resolution pass from the packed release-candidate artifact.
- [x] Final exact-artifact DSH Web smoke passed on 2026-08-24 with `dsh@0.1.1-rc.2` and tarball SHA-256 `aca658c5a8e3aa7cbb1ffce44a20c617d678004676e0478c3fe14feee5a399a1`: real authenticated sessions invoked `sightline`; Web replay rendered the three agent columns, `Observed` / `Predicted` / `Unavailable`, Present / Absent / Unknown, target `cwd`, and diagnostics. The model-facing result omitted absolute workspace paths and full diagnostic messages, while the fuller ToolView retained them as documented.
- [x] After PR #7 merged to `main` at `5cd815513669b8054fad6f995794735ca287269f`, the merge-to-main CI was manually confirmed green across Ubuntu core, Windows core, release-audit, and clean-profile.

## E. Security and privacy release gate

- [x] Source-backed review identified the repository-symlink containment issue; commit `7f99b314d3c801ccc7f4224dbcd96e6834a35dd7` fixes it and CI covers external-escape rejection plus legitimate internal symlinks.
- [x] Gitleaks 8.30.1 evidence is retained at both scopes: the pre-prune full-ref scan covered **64 commits** with no leaks and exit 0; after stale remote refs were pruned, the reachable-ref scan covered **26 commits** with no leaks. The count differs because the six stale remote branch refs were removed; the final closure head was scanned again with **27 commits** and no leaks, and the working tree scan also found no leaks.
- [x] Commit author/committer metadata for the release-candidate history was audited: maintainer-authored commits use `133667618+Charlie-Wang-03@users.noreply.github.com`, and GitHub-created commits use `noreply@github.com`.
- [x] The six merged development branches were removed before public visibility. After PR #7 merged and the release-readiness branch was deleted, GitHub and the local clone both show only `main` / `origin/main` as the remaining branch.
- [x] Dependency vulnerability review: CI run `32691715922` executes `pnpm audit --audit-level=high` from the frozen lockfile with project scripts disabled and reports **No known vulnerabilities found**.
- [x] Dependency license review: the same CI run inventories installed dependency licenses; the only license families reported are **MIT** and **Apache-2.0**, with no unexpected incompatible, proprietary, copyleft, or unknown license bucket.
- [x] CI rejects unexpected development/sensitive paths in the packed artifact; final human tarball inspection remains part of the release-candidate smoke.
- [x] Source-backed security review completed for the release runtime/package diff with no reportable findings; the final local follow-up was limited to tests and release-document truthfulness.

## F. Public launch surface

- [x] English README rewritten around product value, proof, quick start, trust boundary, compatibility, and verification.
- [x] Simplified Chinese README added as a first-class entry path.
- [ ] Add one real, publication-safe Sightline ToolView screenshot to the README if it materially improves the launch page.
- [ ] Configure GitHub repository Description and Topics after public release preparation is complete.
- [ ] Configure a social preview image if one is available and publication-safe.

## G. Launch execution — npm publishing

- [x] npm maintainer account access confirmed immediately before publication; `charlie-wang-03` was authenticated, the account email was verified, `auth-and-writes` 2FA was enabled, and the package name still returned `E404` immediately before first publish.
- [x] First-publish authentication path completed through npm CLI browser authentication with account 2FA; no long-lived publish token was added to the repository.
- [ ] Prefer npm Trusted Publishing + provenance for subsequent releases after the package/publisher relationship is configured.
- [x] Published the exact prebuilt `dsh-sightline@0.1.0` artifact on 2026-08-24. The published input tarball SHA-256 is `aca658c5a8e3aa7cbb1ffce44a20c617d678004676e0478c3fe14feee5a399a1`.
- [x] Verified live registry metadata after publication: `dsh-sightline@0.1.0` is `latest`, license is MIT, repository metadata points to `Charlie-Wang-03/dsh-sightline`, and the maintainer is `charlie-wang-03`. A fresh `npm pack dsh-sightline@0.1.0` download produced the same SHA-256 `aca658c5a8e3aa7cbb1ffce44a20c617d678004676e0478c3fe14feee5a399a1`, closing the exact-artifact identity loop.
- [x] Verified the public npm user path in an isolated `DSH_HOME` using `@deepseek-ai/dsh@0.1.1-rc.2`: `dsh plugin --profile npm-v010 add dsh-sightline@0.1.0` succeeded, composed config contained the `dsh-sightline` plugin row, and `scripts/verify-installed-profile.mjs` resolved both the Host entry and `dsh-sightline/client` from the isolated profile's `node_modules`, not from the source checkout.

## H. Launch execution and post-publication verification — GitHub

- [x] PR #7 merged after automated and manual gates passed; merge commit `5cd815513669b8054fad6f995794735ca287269f`.
- [x] Confirm the six stale merged development branches and the merged release-readiness branch are absent before the public visibility change; only `main` remains.
- [ ] Make the repository public.
- [ ] Enable appropriate default-branch protection.
- [ ] Enable private vulnerability reporting.
- [ ] Add `dsh-plugin` and related discovery topics.
- [ ] Create signed/annotated release tag `v0.1.0` according to the final repository release policy.
- [ ] Publish GitHub Release notes tied to the exact tested commit.
- [ ] Verify all public README links, install commands, license surfaces, and security links after visibility changes.

## Release decision

The release candidate is **NO-GO** while any of the following remain unresolved:

- license missing or inconsistent;
- privacy contract inconsistent with actual model-facing behavior;
- no verified public installation path;
- dependency lock / reproducibility gate incomplete;
- full-history secret audit incomplete;
- stale merged development branches remain and would expose branch-only history;
- final release candidate CI or smoke failing;
- live npm package-name lookup reports a conflict.

Sections A-E now pass and the npm launch/post-publication checks in Section G are complete except for the intentionally deferred Trusted Publishing/provenance migration for subsequent releases. The exact verified npm artifact is public and has passed registry-to-clean-profile validation. The remaining v0.1.0 launch work is the GitHub public-release sequence in Section H plus optional proportional polish in Section F. The current state is **GO for GitHub public launch**, subject to those explicit GitHub actions and their post-change verification.
