.PHONY: help deps run check test test-coverage build release install uninstall logs reset-auth

# The from-source dev CLI runs straight from the project (`make run`) and keeps
# its state under ~/devstation-dev (isolated). The installed prod CLI is a
# single self-contained binary (engine + OpenTofu + templates + blueprint
# catalog embedded) that keeps its state under ~/devstation. `make install`
# builds it and puts `devstation` on your PATH — analogous to ../harness.

BINARY      := devstation
INSTALL_DIR ?= /usr/local/bin
DIST        := dist
LABEL       := linux-x64
BUILT       := $(DIST)/$(BINARY)-$(LABEL)/$(BINARY)
VERSION     := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# Cache dependencies for local development.
deps: ## Cache Deno dependencies for local dev
	deno install

# Run the TUI from source (dev state at ~/devstation-dev; tolerates self-signed Proxmox certs).
run: ## Run the from-source dev CLI (state at ~/devstation-dev)
	deno task --cwd tui/ink dev

check: ## Type-check every workspace member
	deno task check

test: ## Full test suite (unit, integration, architecture, UI)
	deno task test

test-coverage: ## Full test suite with coverage
	deno task test:coverage

# Compile the single self-contained binary for this host into ./dist.
build: ## Build the prod binary for this host into ./dist
	deno task build:linux -- --version "$(VERSION)"
	@echo "built $(BUILT) ($(VERSION))"

# Local release chain (release/scripts/README.md): the version-stamped linux
# artifact plus checksums and the latest.json manifest, all into ./dist.
release: check test ## Check + test + build the linux release artifacts (tarball, checksums, manifest)
	deno task build:linux -- --version "$$(deno task --quiet release:version)"
	deno task release:checksums
	deno task release:manifest

# Build from source and install the prod binary to $(INSTALL_DIR) (sudo if needed).
install: build ## Build and install the prod `devstation` binary (state at ~/devstation)
	@if [ -d "$(INSTALL_DIR)" ] && [ -w "$(INSTALL_DIR)" ]; then \
		install -m 0755 "$(BUILT)" "$(INSTALL_DIR)/$(BINARY)"; \
	else \
		echo "Elevated permissions required to write to $(INSTALL_DIR) (using sudo)."; \
		sudo install -d -m 0755 "$(INSTALL_DIR)"; \
		sudo install -m 0755 "$(BUILT)" "$(INSTALL_DIR)/$(BINARY)"; \
	fi
	@echo "installed $(INSTALL_DIR)/$(BINARY) ($(VERSION)) — prod state at ~/devstation"

uninstall: ## Remove the installed prod binary (state under ~/devstation is left intact)
	@if [ -w "$(INSTALL_DIR)/$(BINARY)" ]; then rm -f "$(INSTALL_DIR)/$(BINARY)"; \
	else sudo rm -f "$(INSTALL_DIR)/$(BINARY)"; fi
	@echo "removed $(INSTALL_DIR)/$(BINARY)"

# Tail the current engine log (dev home; installed CLI logs under ~/devstation).
logs: ## Tail the current dev engine log
	tail -f $(HOME)/devstation-dev/logs/$$(date -u +%Y-%m-%d-%H).log

# Forget the local master password of the dev CLI (re-runs first-time setup).
reset-auth: ## Reset the dev CLI master password
	rm -f $(HOME)/devstation-dev/config/.salt $(HOME)/devstation-dev/config/.auth
