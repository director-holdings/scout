#!/usr/bin/env bash
# GitHub에 새 커밋이 있으면 받아서 다시 빌드·실행 (systemd 타이머가 5분마다 실행)
set -euo pipefail
DIR=/opt/scout
BRANCH="${SCOUT_BRANCH:-main}"
LOG=/var/log/scout-update.log
cd "$DIR"
exec 9>/run/scout-update.lock
flock -n 9 || exit 0

git fetch -q origin "$BRANCH" || { echo "$(date '+%F %T') GitHub 연결 실패 (토큰 만료 여부 확인)" >> "$LOG"; exit 1; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" = "$REMOTE" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi
echo "$(date '+%F %T') 업데이트 시작 ${LOCAL:0:7} → ${REMOTE:0:7}" >> "$LOG"
git reset -q --hard "origin/$BRANCH"
install -m 755 deploy/update.sh /usr/local/bin/scout-update
install -m 755 deploy/scout-cli.sh /usr/local/bin/scout
if docker compose up -d --build >> "$LOG" 2>&1; then
  echo "$(date '+%F %T') 업데이트 완료 $(git log -1 --format='%h %s')" >> "$LOG"
  docker image prune -f >/dev/null 2>&1 || true
else
  echo "$(date '+%F %T') 빌드 실패 — 이전 버전이 계속 실행 중일 수 있어요" >> "$LOG"
  exit 1
fi
