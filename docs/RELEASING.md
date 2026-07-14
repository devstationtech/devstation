# Releasing DevStation

Releases are created **in the GitHub UI**. Publishing a release triggers the
[`Release`](../.github/workflows/release.yml) workflow, which builds every
cross-platform binary, writes `checksums.txt` and the `latest.json` update
manifest, and uploads them to that release with `--clobber` (keep-existing — it
never touches the release notes you wrote).

Distribution is **fully GitHub-native**: `install.sh`, `install.ps1`, and the
in-app self-update all read from `releases/latest/download/…` on this repo — no
GitHub Pages, no custom domain, nothing to keep serving beyond the release
assets themselves. GitHub's `releases/latest` redirect always points at the
newest **published (non pre-release)** release.

CI (`fmt` / `lint` / `check` / `test`) lives in
[`main.yml`](../.github/workflows/main.yml) and gates every push and PR to
`main`; the release workflow trusts that `main` was green when the tag was cut.

This mirrors the flow in `devstationtech/harness` (there GoReleaser does the
build; here it's Deno's `deno compile` multi-target build).

## 1. Pre-flight

- Make sure `main` is green — CI must pass (`make check && make test` locally
  mirrors it).
- Pick the next version following [Semantic Versioning](https://semver.org):
  - `v0.Y.Z` while DevStation is still **Alpha** (current phase) — signal the
    Alpha in the release **title** (e.g. `Alpha - v0.0.1`), not the pre-release
    checkbox (see the note below).
  - patch (`Z`) for fixes, minor (`Y`) for features, major (`X`) for breaking
    changes.
- Keep `deno.json`'s `version` in step with the tag you're about to cut (the
  build stamps the tag's version into the binary regardless, but the two should
  agree).
- (Optional) dry-run the build locally to catch config errors first:

  ```sh
  make build            # deno compile for this host into ./dist
  deno task release:checksums
  GITHUB_REPOSITORY=devstationtech/devstation \
    deno task release:manifest -- --version 0.0.1 --tag v0.0.1
  ```

## 2. Create the release on GitHub

1. Go to **Releases → Draft a new release**.
2. **Choose a tag**: type the new version (e.g. `v0.0.1`) with "Create new tag
   on publish" — target `main`.
3. Title it `Alpha - vX.Y.Z` while in the Alpha phase; write the release notes.
4. **Leave "Set as a pre-release" unticked** for a normal `vX.Y.Z` tag — see the
   note below. Only tick it for `-rc` / `-beta` pre-release tags.
5. Click **Publish release**.

Publishing fires the workflow. Within a few minutes it:

1. checks out the repo at the release tag,
2. builds `devstation` for `linux-x64`, `darwin-x64`, `darwin-arm64`,
   `windows-x64` (each a single self-contained binary — engine + OpenTofu +
   templates + official blueprint catalog embedded),
3. writes `checksums.txt` (SHA-256) and `latest.json` (the self-update
   manifest, with per-target download URLs on this release), and
4. uploads them all to the release you just published.

Re-run a build against an existing tag from **Actions → Release → Run workflow**
(`workflow_dispatch`), passing the tag.

> **Why not the "pre-release" checkbox for Alpha?** GitHub's
> `releases/latest/download/…` redirect — which `install.sh` and the self-update
> depend on — **skips releases flagged as pre-release**. So an Alpha marked
> pre-release would be invisible to the installer. We keep `vX.Y.Z` tags as
> normal releases and convey "Alpha" through the title and the README badge,
> exactly like `devstationtech/harness` (`Alpha - v0.0.3` is its `Latest`).

## 3. Verify

- **Install script** —
  `curl -fsSL https://raw.githubusercontent.com/devstationtech/devstation/main/install.sh | sh`
  (honors `DEVSTATION_BASE_URL` to point at a staging release-download base).
- **Self-update** — an older binary shows `New version <v> available — press U
  to update` on the main menu; `U` (or `/update`) fetches `latest.json` from
  `releases/latest/download/latest.json` and swaps the binary in place.
