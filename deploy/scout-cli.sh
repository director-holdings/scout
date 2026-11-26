#!/usr/bin/env bash
# 서버 관리용 간단 명령어: scout [status|password|update|logs|backup|restart]
DIR=/opt/scout
cd "$DIR" || exit 1
case "${1:-status}" in
  status)
    echo "== 실행 상태 =="; docker compose ps --format 'table {{.Service}}\t{{.Status}}'
    echo; echo "== 최근 업데이트 =="; tail -n 5 /var/log/scout-update.log 2>/dev/null || echo "기록 없음"
    echo; echo "== 현재 버전 =="; git log -1 --format='%h %s (%cr)'
    echo; echo "== 디스크 =="; df -h / | tail -1
    echo; echo "== 메모리 =="; free -h | head -2 ;;
  password)
    grep '^APP_PASSWORD=' .env | cut -d= -f2-
    echo "(화면의 '연동 설정'에서 비밀번호를 바꿨다면 바꾼 비밀번호가 우선이에요)" ;;
  update)
    /usr/local/bin/scout-update --force && tail -n 3 /var/log/scout-update.log ;;
  logs)
    docker compose logs --tail=80 "${2:-api}" ;;
  restart)
    docker compose restart ;;
  backup)
    mkdir -p /opt/scout-backups
    F=/opt/scout-backups/scout-$(date +%F).sql.gz
    docker compose exec -T db pg_dump -U scout scout | gzip > "$F" && echo "백업: $F"
    find /opt/scout-backups -name 'scout-*.sql.gz' -mtime +14 -delete ;;
  *)
    echo "사용법: scout [status|password|update|logs|backup|restart]" ;;
esac
