#!/usr/bin/env sh
# DevStation installer for Linux and macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/devstationtech/devstation/main/install.sh | sh
#
# Fully GitHub-native: the release manifest (`latest.json`) and the
# platform archive are pulled straight from the repo's GitHub Releases —
# no custom domain, no CDN, nothing to keep serving. `releases/latest`
# resolves to the newest published (non pre-release) release.
#
# The binary ships everything (engine, OpenTofu, provisioning templates,
# blueprint catalog) embedded inside the wrapper. The install is a
# single file: the binary. First run extracts the assets to
# `${DEVSTATION_HOME:-$HOME/.devstation}/runtime/<VERSION>/`.
#
# macOS Gatekeeper gets the quarantine bit cleared post-download so the
# binary launches without "Apple cannot check it" prompts on first use.
#
# Overrides:
#   DEVSTATION_BASE_URL  manifest source
#                        (default https://github.com/devstationtech/devstation/releases/latest/download)
#   DEVSTATION_BIN_DIR   install dir     (default $HOME/.local/bin)
set -eu

# Everything runs inside main() and the call is the LAST line of the
# file: `curl | sh` executes top-down as bytes arrive, so a dropped
# connection mid-transfer would otherwise run a truncated prefix of
# this script. With the wrapper, nothing executes until the closing
# brace has fully arrived.
main() {

BASE_URL="${DEVSTATION_BASE_URL:-https://github.com/devstationtech/devstation/releases/latest/download}"
BIN_DIR="${DEVSTATION_BIN_DIR:-$HOME/.local/bin}"
LATEST_URL="${BASE_URL%/}/latest.json"

log() { printf 'devstation install: %s\n' "$*"; }
fail() { printf 'devstation install: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"; }

# --- platform detect ----------------------------------------------------

uname_s="$(uname -s)"
uname_m="$(uname -m)"

case "$uname_s" in
  Linux)   os_label='linux'  ;;
  Darwin)  os_label='darwin' ;;
  *) fail "unsupported OS: $uname_s (expected Linux or Darwin)" ;;
esac

case "$uname_m" in
  x86_64 | amd64) arch_label='x64'   ;;
  arm64 | aarch64)
    if [ "$os_label" = "linux" ]; then
      fail "linux-arm64 not yet published; only linux-x64 is available right now"
    fi
    arch_label='arm64' ;;
  *) fail "unsupported architecture: $uname_m" ;;
esac

asset_key="${os_label}-${arch_label}"
asset_name="devstation-${asset_key}.tar.gz"

# --- prerequisites ------------------------------------------------------

need curl
need tar
need sed
need mktemp
need install

if command -v sha256sum >/dev/null 2>&1; then
  sha_cmd='sha256sum'
elif command -v shasum >/dev/null 2>&1; then
  sha_cmd='shasum -a 256'
else
  fail "missing required command: sha256sum (or shasum)"
fi

# --- download + verify --------------------------------------------------

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

log "fetching $LATEST_URL"
curl -fsSL "$LATEST_URL" -o "$tmp_dir/latest.json"

asset_url="$(sed -n "/\"${asset_key}\"/,/}/s/.*\"url\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$tmp_dir/latest.json" | head -n 1)"
asset_sha="$(sed -n "/\"${asset_key}\"/,/}/s/.*\"sha256\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$tmp_dir/latest.json" | head -n 1)"

[ -n "$asset_url" ] || fail "latest.json does not include a ${asset_key} URL"
[ -n "$asset_sha" ] || fail "latest.json does not include a ${asset_key} sha256"

log "downloading $asset_name"
curl -fsSL "$asset_url" -o "$tmp_dir/$asset_name"

log "verifying sha256"
if ! printf '%s  %s\n' "$asset_sha" "$tmp_dir/$asset_name" | $sha_cmd -c - >/dev/null 2>&1; then
  fail "sha256 mismatch for $asset_name — refusing to install (download corrupt or tampered)"
fi

# --- install the single binary -----------------------------------------

log "extracting"
tar -xzf "$tmp_dir/$asset_name" -C "$tmp_dir"

[ -x "$tmp_dir/devstation" ] || fail "extracted archive missing devstation binary"

mkdir -p "$BIN_DIR"
install -m 0755 "$tmp_dir/devstation" "$BIN_DIR/devstation"

# macOS: strip the quarantine bit so the binary launches without
# Gatekeeper's first-use "Apple cannot check it" prompt.
if [ "$os_label" = "darwin" ] && command -v xattr >/dev/null 2>&1; then
  log "clearing macOS quarantine attribute"
  xattr -d com.apple.quarantine "$BIN_DIR/devstation" 2>/dev/null || true
fi

# Optional: notices file alongside the binary so distros find it.
if [ -f "$tmp_dir/THIRD-PARTY-NOTICES.md" ]; then
  install -m 0644 "$tmp_dir/THIRD-PARTY-NOTICES.md" "$BIN_DIR/devstation.notices.md" 2>/dev/null || true
fi

# --- PATH check ---------------------------------------------------------

case ":$PATH:" in
  *":$BIN_DIR:"*) on_path=1 ;;
  *) on_path=0 ;;
esac

log "installed: $BIN_DIR/devstation"

if [ "$on_path" = "0" ]; then
  printf '\n'
  printf 'devstation install: %s is NOT on your PATH yet.\n' "$BIN_DIR"
  printf '  Add to your shell rc (~/.bashrc, ~/.zshrc, etc.):\n'
  printf '    export PATH="%s:$PATH"\n' "$BIN_DIR"
  printf '  Open a new terminal to pick it up.\n\n'
fi

printf '\nNext: run `devstation` — first launch will extract the bundled tofu, templates, and blueprints to ~/.devstation/runtime/<version>/ automatically.\n'

}

main "$@"
