#!/bin/bash
# ローカルのnpm run devを起動し、一定時間アクセス(ページ表示・HMRのコンパイル含む)が
# なければ自動的にサーバーを停止する。閉じ忘れたdevサーバーが放置されるのを防ぐための開発用ツール。
#
# 使い方: scripts/dev-with-idle-timeout.sh [アイドルタイムアウト秒数(デフォルト600=10分)] [ログ出力先パス]

set -uo pipefail

IDLE_TIMEOUT="${1:-600}"
LOG_FILE="${2:-/tmp/wordbook-dev-server.log}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"

# 既存の3000番ポートのプロセスがあれば掃除してから起動する
lsof -i :3000 -t 2>/dev/null | xargs -r kill 2>/dev/null

: > "$LOG_FILE"
nohup npm run dev >> "$LOG_FILE" 2>&1 &
DEV_PID=$!

echo "dev server started (pid=$DEV_PID), log=$LOG_FILE, idle timeout=${IDLE_TIMEOUT}s"

while true; do
  sleep 30

  # devサーバープロセスが既に落ちていれば監視を終了
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "dev server process (pid=$DEV_PID) is no longer running. watchdog exiting."
    exit 0
  fi

  if [ ! -f "$LOG_FILE" ]; then
    continue
  fi

  last_mod=$(stat -f %m "$LOG_FILE" 2>/dev/null || stat -c %Y "$LOG_FILE" 2>/dev/null)
  now=$(date +%s)
  idle=$((now - last_mod))

  if [ "$idle" -ge "$IDLE_TIMEOUT" ]; then
    echo "idle for ${idle}s (>= ${IDLE_TIMEOUT}s). stopping dev server (pid=$DEV_PID)."
    kill "$DEV_PID" 2>/dev/null
    lsof -i :3000 -t 2>/dev/null | xargs -r kill 2>/dev/null
    exit 0
  fi
done
