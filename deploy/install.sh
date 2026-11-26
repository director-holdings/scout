#!/usr/bin/env bash
# Scout 서버 설치 스크립트 (Ubuntu 22.04 / 24.04, Debian 12)
# 사용법 (Vultr 웹 콘솔에서 root로):
#   저장소가 비공개일 때:  T=읽기전용토큰; curl -fsSL -H "Authorization: Bearer $T" https://raw.githubusercontent.com/director-holdings/scout/main/deploy/install.sh | GH_TOKEN=$T bash
#   저장소가 공개일 때:    curl -fsSL https://raw.githubusercontent.com/director-holdings/scout/main/deploy/install.sh | bash
# 여러 번 실행해도 안전합니다 (기존 비밀번호·데이터는 그대로 둠).
set -euo pipefail

REPO="${SCOUT_REPO:-director-holdings/scout}"
BRANCH="${SCOUT_BRANCH:-main}"
DIR=/opt/scout
TOKEN_FILE=/root/.scout-github-token

say(){ printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
die(){ printf '\n\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "root 계정으로 실행해 주세요 (명령어 앞에 sudo 를 붙이거나 root로 로그인)"
command -v apt-get >/dev/null || die "Ubuntu 또는 Debian 서버에서만 설치할 수 있어요"

# ── 이미 80/443 포트를 쓰는 웹서버가 있는지 확인 ──────────────────────────
# 기존 웹서버가 Docker 안의 Caddy면 "함께 쓰기" 모드: Scout는 자체 Caddy를 띄우지 않고
# 기존 Caddy 설정 맨 끝에 Scout 주소 한 블록만 추가한다 (백업 → 검사 → 문제 있으면 원래대로).
SHARED=0; PROXY=""; PROXY_NET=""; CFG_IN=""; CFG_HOST=""
if command -v ss >/dev/null && ss -tlnH '( sport = :80 or sport = :443 )' | grep -q .; then
  if command -v docker >/dev/null; then
    PROXY=$(docker ps --filter publish=443 --format '{{.Names}}' | grep -v '^scout-' | head -1 || true)
  fi
  if [ -z "$PROXY" ]; then
    # Scout 자체 Caddy가 이미 떠 있으면 재설치로 보고 계속
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^scout-caddy'; then :; else
      ss -tlnp '( sport = :80 or sport = :443 )'
      die "웹 포트(80/443)를 Docker 밖의 프로그램이 쓰고 있어요. 기존 서비스를 지키기 위해 멈췄어요. 위 내용을 Claude에게 보내주세요"
    fi
  else
    docker inspect -f '{{.Config.Image}}' "$PROXY" | grep -qi caddy \
      || die "웹 포트를 쓰는 프로그램($PROXY)이 Caddy가 아니에요. 기존 서비스를 지키기 위해 멈췄어요. 이 문구를 Claude에게 보내주세요"
    SHARED=1
    PROXY_NET=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$PROXY" | awk '{print $1}')
    CFG_IN=$(docker inspect -f '{{join .Config.Cmd " "}}' "$PROXY" | sed -n 's/.*--config[ =]\([^ ]*\).*/\1/p')
    CFG_IN=${CFG_IN:-/etc/caddy/Caddyfile}
    CFG_HOST=$(docker inspect -f '{{range .Mounts}}{{.Destination}}|{{.Source}}{{"\n"}}{{end}}' "$PROXY" | while IFS='|' read -r d s; do
      [ -z "$d" ] && continue
      if [ "$d" = "$CFG_IN" ]; then echo "$s"; elif [ "${CFG_IN#"$d"/}" != "$CFG_IN" ]; then echo "$s/${CFG_IN#"$d"/}"; fi
    done | head -1)
    [ -n "$PROXY_NET" ] || die "기존 Caddy($PROXY)의 Docker 네트워크를 찾지 못했어요. 이 문구를 Claude에게 보내주세요"
    [ -n "$CFG_HOST" ] && [ -f "$CFG_HOST" ] || die "기존 Caddy 설정 파일 위치를 찾지 못했어요($CFG_IN). 이 문구를 Claude에게 보내주세요"
    case "$CFG_IN" in *.json) die "기존 Caddy가 JSON 설정을 써서 자동으로 붙일 수 없어요. 이 문구를 Claude에게 보내주세요";; esac
    echo "기존 웹서버 발견: $PROXY (설정: $CFG_HOST) → 함께 쓰기 모드로 설치해요. 기존 사이트는 그대로 둬요"
  fi
fi

say "1/7 기본 프로그램 설치"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates openssl >/dev/null

say "2/7 메모리 여유 공간(스왑) 확인"
MEM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 6000 ] && ! swapon --show | grep -q .; then
  SWAP_GB=$([ "$MEM_MB" -lt 3000 ] && echo 4 || echo 2)
  fallocate -l ${SWAP_GB}G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "메모리 ${MEM_MB}MB → 스왑 ${SWAP_GB}GB 추가"
else
  echo "메모리 ${MEM_MB}MB · 스왑 설정 필요 없음"
fi

say "3/7 Docker 설치"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null || die "Docker Compose를 찾지 못했어요"

say "4/7 GitHub에서 코드 받기"
if [ -n "${GH_TOKEN:-}" ]; then
  umask 077; printf '%s' "$GH_TOKEN" > "$TOKEN_FILE"; umask 022
fi
git config --global credential.helper "!f() { echo username=x-access-token; echo password=\$(cat $TOKEN_FILE 2>/dev/null); }; f"
git config --global --add safe.directory "$DIR" || true
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
  git clone -q --branch "$BRANCH" "https://github.com/$REPO.git" "$DIR" \
    || die "코드를 받지 못했어요. 토큰이 맞는지, 토큰에 scout 저장소 읽기 권한(Contents: Read)이 있는지 확인해 주세요"
fi
cd "$DIR"

say "5/7 설정 파일 만들기"
if [ ! -f .env ]; then
  rnd(){ openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  IP=$(curl -fsS4 --max-time 5 https://api.ipify.org || curl -fsS4 --max-time 5 https://ifconfig.me || true)
  if [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then SITE="${IP//./-}.sslip.io"; else SITE=":80"; fi
  cat > .env <<EOF
DB_PASSWORD=$(rnd 32)
SECRET_KEY=$(rnd 48)
APP_PASSWORD=$(rnd 4)-$(rnd 4)-$(rnd 4)
SITE_ADDRESS=$SITE
LOAD_DEMO=1
EOF
  chmod 600 .env
  echo "새 설정을 만들었어요"
else
  echo "기존 설정을 그대로 써요"
fi
IP=$(curl -fsS4 --max-time 5 https://api.ipify.org || curl -fsS4 --max-time 5 https://ifconfig.me || true)
setenv(){ if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
if [ "$SHARED" = 1 ]; then
  [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "서버 IP를 확인하지 못했어요"
  setenv SITE_ADDRESS "scout.${IP//./-}.sslip.io"
  setenv PROXY_NET "$PROXY_NET"
  setenv COMPOSE_FILE "docker-compose.yml:deploy/compose.shared.yml"
fi
set -a; . ./.env; set +a

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

say "6/7 프로그램 빌드·실행 (처음엔 5~10분 걸려요)"
docker compose up -d --build

if [ "$SHARED" = 1 ] && ! grep -q '# >>> scout' "$CFG_HOST"; then
  say "기존 웹서버에 Scout 주소 추가: $SITE_ADDRESS"
  BAK="/root/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)"
  cp -p "$CFG_HOST" "$BAK"
  restore(){ cat "$BAK" > "$CFG_HOST"; }   # 같은 파일에 덮어써서 컨테이너 연결 유지
  printf '\n# >>> scout (Scout 내부용 도구 — install.sh가 자동 추가. 지우면 Scout 접속이 끊겨요)\n%s {\n\tencode gzip\n\trequest_body {\n\t\tmax_size 12MB\n\t}\n\treverse_proxy scout-api:8000\n}\n# <<< scout\n' "$SITE_ADDRESS" >> "$CFG_HOST"
  if ! docker exec "$PROXY" grep -q '# >>> scout' "$CFG_IN"; then
    restore; die "기존 Caddy 컨테이너가 설정 파일 변경을 보지 못해요. 원래대로 되돌렸어요. 이 문구를 Claude에게 보내주세요"
  fi
  if ! docker exec "$PROXY" caddy validate --config "$CFG_IN" --adapter caddyfile >/tmp/scout-validate.log 2>&1; then
    restore; tail -5 /tmp/scout-validate.log
    die "설정 검사에서 문제가 나와 원래대로 되돌렸어요 (기존 사이트 영향 없음). 위 내용을 Claude에게 보내주세요"
  fi
  if ! docker exec "$PROXY" caddy reload --config "$CFG_IN" --adapter caddyfile >/tmp/scout-reload.log 2>&1; then
    restore; docker exec "$PROXY" caddy reload --config "$CFG_IN" --adapter caddyfile >/dev/null 2>&1 || true
    tail -5 /tmp/scout-reload.log
    die "기존 웹서버에 설정을 적용하지 못해 원래대로 되돌렸어요. 위 내용을 Claude에게 보내주세요"
  fi
  echo "적용 완료 (원래 설정 백업: $BAK)"
  if git -C "$(dirname "$CFG_HOST")" rev-parse >/dev/null 2>&1; then
    echo "※ 참고: 기존 Caddy 설정이 Git으로 관리되고 있어요. 그쪽 코드를 업데이트하면 Scout 블록이 지워질 수 있으니 그 저장소의 Caddyfile에도 같은 블록을 넣어두세요"
  fi
fi

say "7/7 자동 업데이트·매일 백업 켜기"
install -m 755 deploy/update.sh /usr/local/bin/scout-update
install -m 755 deploy/scout-cli.sh /usr/local/bin/scout
cat > /etc/systemd/system/scout-update.service <<EOF
[Unit]
Description=Scout: GitHub 변경 사항 반영
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/scout-update
EOF
cat > /etc/systemd/system/scout-update.timer <<EOF
[Unit]
Description=Scout: 5분마다 GitHub 확인
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/scout-backup.service <<EOF
[Unit]
Description=Scout: 데이터베이스 백업
[Service]
Type=oneshot
ExecStart=/usr/local/bin/scout backup
EOF
cat > /etc/systemd/system/scout-backup.timer <<EOF
[Unit]
Description=Scout: 매일 새벽 4시 백업
[Timer]
OnCalendar=*-*-* 19:00:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now scout-update.timer scout-backup.timer >/dev/null

printf '서버가 켜지기를 기다리는 중'
for i in $(seq 1 60); do
  if docker compose exec -T api python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/healthz')" >/dev/null 2>&1; then OK=1; break; fi
  printf '.'; sleep 5
done
echo

URL="http://$(curl -fsS4 --max-time 5 https://api.ipify.org || echo 서버IP)"
[ "${SITE_ADDRESS}" != ":80" ] && URL="https://${SITE_ADDRESS}"
cat <<EOF

==================================================================
 $( [ "${OK:-0}" = 1 ] && echo '✅ 설치 완료!' || echo '⚠️  아직 켜지는 중이에요. 2~3분 뒤 아래 주소로 들어가 보세요' )

 접속 주소      : $URL
 팀 비밀번호    : $APP_PASSWORD

 · 이 화면을 사진으로 찍어 두거나 비밀번호를 안전한 곳에 적어두세요
 · 비밀번호를 다시 보려면 콘솔에서:  scout password
 · GitHub에 새 코드가 올라오면 5분 안에 자동으로 업데이트돼요
 · 상태 확인: scout status   /  지금 바로 업데이트: scout update
==================================================================
EOF
