#!/usr/bin/env bash
# ─── VoidShell: Rebuild native modules for macOS arm64 (Apple Silicon) ─────────
#
# Run this script ONCE after `npm install` on your M4 Mac:
#   chmod +x scripts/rebuild-arm64.sh
#   ./scripts/rebuild-arm64.sh
#
# What it does:
#   1. Uses electron-builder install-app-deps to rebuild node-pty
#      against the correct Electron ABI for arm64
#   2. Verifies the resulting .node binary is arm64
#
# Why this is necessary:
#   `npm install` compiles node-pty for the system Node.js ABI.
#   Electron uses a DIFFERENT V8/ABI version, so the binary will either
#   crash silently or throw MODULE_NOT_FOUND at runtime on arm64.
# ─────────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   VoidShell — arm64 Native Module Rebuild            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Check prerequisites ────────────────────────────────────────────────────────
command -v node  >/dev/null 2>&1 || { echo "❌  node not found"; exit 1; }
command -v npm   >/dev/null 2>&1 || { echo "❌  npm not found";  exit 1; }

ELECTRON_VERSION=$(node -e "console.log(require('./node_modules/electron/package.json').version)")
echo "✓  Electron version: $ELECTRON_VERSION"
echo "✓  Node version:     $(node --version)"
echo "✓  Platform:         $(uname -m)"
echo ""

# ── Rebuild via electron-builder (recommended approach) ───────────────────────
echo "⚙  Running: electron-builder install-app-deps --arch arm64"
echo ""

node_modules/.bin/electron-builder install-app-deps --arch arm64

echo ""

# ── Verify binary architecture ────────────────────────────────────────────────
PTY_NODE="node_modules/node-pty/build/Release/pty.node"
if [ -f "$PTY_NODE" ]; then
  ARCH=$(file "$PTY_NODE" | grep -o 'arm64\|x86_64' | head -1)
  if [ "$ARCH" = "arm64" ]; then
    echo "✅  node-pty rebuilt successfully for arm64"
    echo "    Binary: $PTY_NODE"
  else
    echo "⚠️   Binary architecture is '$ARCH', expected 'arm64'"
    echo "    Try: npm install && ./scripts/rebuild-arm64.sh"
  fi
else
  echo "⚠️   Could not find $PTY_NODE — rebuild may have failed"
  exit 1
fi

echo ""
echo "✅  Done! You can now run:"
echo "    npm run build:mac     → build macOS arm64 DMG"
echo "    npx electron .        → run in development mode"
echo ""
