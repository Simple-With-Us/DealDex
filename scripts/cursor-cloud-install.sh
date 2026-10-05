#!/usr/bin/env bash
# Cursor Cloud install for DealDex.  Runs during Cursor Build.
# Idempotent on Ubuntu Linux.  Never prints secret VALUES; names only.
#
# Toolchain: Node 22 (matches CI), npm, package-lock.json, vite.
# Web app only.  macOS / iOS / Xcode ship steps are Mac-only and intentionally
# skipped here (DealDex ships iOS via Mac Grok lanes, not Cursor Cloud).
set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"

log() {
  printf '==> %s\n' "$*"
}

# macOS / iOS / Xcode ship are Mac-only.  Print a one-line note so any agent
# reading Cursor Cloud output knows why they are absent here.
case "$(uname -s 2>/dev/null)" in
  Darwin)
    log "macOS detected — iOS / Xcode ship steps live on Mac Grok lanes, not Cursor Cloud."
    ;;
esac

# --- Node 22 ----------------------------------------------------------------
# Cursor's composer-latest images ship a recent Node, but we still align to the
# CI toolchain (Node 22) when available.  Use nvm if present, otherwise fall
# back to the system node — never block install on a missing version manager.
NODE_MAJOR_NEEDED=22

node_major() {
  node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0
}

if command -v nvm >/dev/null 2>&1 && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if ! nvm ls --no-colors "$NODE_MAJOR_NEEDED" >/dev/null 2>&1; then
    log "Installing Node ${NODE_MAJOR_NEEDED}.x via nvm"
    nvm install "$NODE_MAJOR_NEEDED" >/dev/null
  fi
  nvm use "$NODE_MAJOR_NEEDED" >/dev/null
elif command -v fnm >/dev/null 2>&1; then
  if ! fnm ls --json 2>/dev/null | grep -q "\"${NODE_MAJOR_NEEDED}\""; then
    log "Installing Node ${NODE_MAJOR_NEEDED}.x via fnm"
    fnm install "$NODE_MAJOR_NEEDED" >/dev/null
  fi
  fnm use "$NODE_MAJOR_NEEDED" >/dev/null
fi

if [ "$(node_major)" -lt "$NODE_MAJOR_NEEDED" ]; then
  log "Node $(node --version 2>/dev/null || echo missing) is older than ${NODE_MAJOR_NEEDED}; continuing with whatever Node is on PATH."
fi

log "Node: $(node --version 2>/dev/null || echo missing)  npm: $(npm --version 2>/dev/null || echo missing)"

# --- npm ci ------------------------------------------------------------------
# Uses package-lock.json.  DealDex uses npm.  skip-iOS ship note above.
if [ -f "$REPO_ROOT/package-lock.json" ]; then
  log "Running npm ci (includes dev deps so lint/typecheck/test work)"
  npm ci --include=dev --no-audit --no-fund
else
  log "No package-lock.json — running npm install"
  npm install --no-audit --no-fund
fi

# --- Infisical CLI ----------------------------------------------------------
# Prefer the official CLI so `infisical run --env dev -- npm run dev` works
# from any agent shell.  The CLI is the fleet-standard loader (see DealDex
# INFISICAL.md).  Falling back to a curl+python3 fetch is acceptable when the
# CLI cannot be installed (e.g. air-gapped or restricted network); the start
# script detects whichever one is on PATH.
INFISICAL_BIN="$(command -v infisical || true)"
if [ -z "$INFISICAL_BIN" ]; then
  log "Installing Infisical CLI (https://app.infisical.com/cli)"
  # Official Linux install path.  Idempotent — the installer is a no-op when
  # the binary already exists at /usr/local/bin/infisical.
  curl -fsSL https://raw.githubusercontent.com/infisical/infisical/main/install.sh -o /tmp/infisical-install.sh \
    && bash /tmp/infisical-install.sh \
    && rm -f /tmp/infisical-install.sh || true
  INFISICAL_BIN="$(command -v infisical || true)"
fi

if [ -n "$INFISICAL_BIN" ]; then
  log "Infisical CLI: $("$INFISICAL_BIN" --version 2>/dev/null || echo installed)"
else
  log "Infisical CLI unavailable — start script will fall back to a curl + python3 fetch."
fi

# --- Playwright browsers ----------------------------------------------------
# e2e suites need a Chromium.  Skip silently when offline; typecheck + unit
# tests still work without browsers.
if [ -d "$REPO_ROOT/node_modules/@playwright/test" ]; then
  if [ -z "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" ]; then
    log "Ensuring Playwright Chromium is installed (no-op if already cached)"
    npx --no playwright install chromium --with-deps >/dev/null 2>&1 || log "Playwright browser install skipped (offline or restricted)."
  fi
fi

log "Cursor Cloud install complete for DealDex."
log "  Verify:  npm run typecheck && npm test"
log "  Dev:     npm run dev   (Vite on http://localhost:8080)"