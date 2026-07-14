# Release scripts

Tooling that produces the public release artifacts. The orchestrator is `make release` (or the
equivalent `deno task` chain); the rest of this folder are the building blocks.

## What each script does

| Script               | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release-version.ts` | Reads `version` from the root `deno.json` and emits it as plain text or as GitHub Actions output. Validates SemVer. Source of truth for everything downstream.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `build-all.ts`       | Local dev convenience: compiles both binaries into `dist/` without target/stamping. Calls `build-server.ts` + `build-ui-ink.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `build-server.ts`    | Compiles `dist/devstation-server` from `server/bin/devstation-server` (Cliffy entry with `rpc serve` / `mcp serve` subcommands). Dev build — no version stamping.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `build-ui-ink.ts`    | Compiles `dist/devstation` from `tui/ink/bin/devstation`. Dev build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `build-release.ts`   | **Release build, multi-target.** Stamps `VERSION` / `GIT_SHA` / `BUILD_DATE` into both build-info files (`server/src/build-info.ts` + `tui/ink/src/cli/version.ts`), then loops compiling both binaries + sidecar `blueprints/` for each platform. Default targets: `linux-x64` (`tar.gz`), `darwin-x64` (`tar.gz`), `darwin-arm64` (`tar.gz`), `windows-x64` (`zip`). Filter to one via `--target linux-x64` or any of the labels above. Restores the build-info files in `finally`. The legacy `deno task build:linux` is a thin wrapper around this with `--target linux-x64`. |
| `checksums.ts`       | Computes SHA-256 of the release tarballs into `dist/checksums.txt`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `latest-manifest.ts` | Writes `dist/latest.json` (URL + sha for each asset) — the manifest the curl-pipe installer (`server/scripts/install.sh`) reads.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `deno-adapter.ts`    | Thin wrapper around Deno fs/path/process APIs the other scripts share.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Bump procedure

`version` lives in **one place**: the root `deno.json`. Everything downstream reads from there.

1. **Edit `/deno.json`**:
   ```json
   "version": "0.2.0"
   ```
2. (optional) Update the two dev-mode stubs so `deno run -A …/devstation` without a release build
   also reports the new version:
   - `server/src/build-info.ts`
   - `tui/ink/src/cli/version.ts`

   Skip this if you don't care about dev-mode reporting — the release pipeline overwrites both files
   anyway before compiling.

3. **Confirm**:
   ```bash
   deno task release:version    # prints the new version
   ```
4. **Build the release**:
   ```bash
   make release                  # check + test + build:linux + checksums + manifest
   ```
   Or step-by-step:
   ```bash
   deno task build:linux         # tarball with stamped binaries
   deno task release:checksums
   deno task release:manifest
   ```

## Anti-drift notes

- **Member `deno.json` files do NOT carry `version`.** Deno workspace allows members to omit it. A
  member only adds its own version field at the moment it's published independently (none are
  today). Adding version back to a member would re-introduce the drift this layout exists to
  prevent.
- **`build-info.ts` defaults are dev-mode only.** They print `0.1.0` / `dev` / `dev` when you run
  from source. The release build rewrites them in place with the real values and restores the
  defaults in `finally` — the working tree never carries a release-tagged stub.
- **The MCP server adapter** (`server/src/shared/inbound/mcp/server.ts`) imports `VERSION` from
  `@server/build-info.ts` — do NOT hardcode the version literal there or you'll silently desync from
  the rest of the engine.
