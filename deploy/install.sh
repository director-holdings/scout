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

# 이미 다른 웹사이트가 80/443 포트를 쓰고 있으면 기존 서비스를 건드리지 않도록 멈춤
if [ ! -d /opt/scout/.git ] && command -v ss >/dev/null && ss -tlnH '( sport = :80 or sport = :443 )' | grep -q . \
   && [ "${SCOUT_FORCE:-}" != 1 ]; then
  ss -tlnp '( sport = :80 or sport = :443 )'
  die "이 서버는 이미 다른 프로그램이 웹 포트(80/443)를 쓰고 있어요. 기존 서비스를 지키기 위해 설치를 멈췄어요. 위 내용을 Claude에게 보내주세요"
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
set -a; . ./.env; set +a

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

say "6/7 프로그램 빌드·실행 (처음엔 5~10분 걸려요)"
docker compose up -d --build

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
