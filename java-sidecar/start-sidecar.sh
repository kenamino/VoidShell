#!/bin/bash
# ─── VoidShell Java Sidecar Launcher ──────────────────────────────────────────
# This script builds (if needed) and starts the Java Sidecar service.
# It is called automatically by the Electron main process on startup.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAR="$SCRIPT_DIR/VoidSidecar.jar"
SRC="$SCRIPT_DIR/src/main/java/com/voidshell/VoidSidecar.java"
OUT="$SCRIPT_DIR/out"

# Build if JAR doesn't exist or source is newer
if [ ! -f "$JAR" ] || [ "$SRC" -nt "$JAR" ]; then
  echo "[VoidSidecar] Building..."
  mkdir -p "$OUT"
  javac -source 11 -target 11 -d "$OUT" "$SRC"
  jar cfe "$JAR" com.voidshell.VoidSidecar -C "$OUT" .
  echo "[VoidSidecar] Build complete."
fi

echo "[VoidSidecar] Starting..."
exec java \
  -Xms16m \
  -Xmx64m \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=50 \
  -jar "$JAR"
