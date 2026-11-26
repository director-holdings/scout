"""수집 워커: 화면에서 누른 작업을 처리하고, 매일 정해진 시각에 전체 수집을 돌린다"""
import time
import traceback
from datetime import datetime

from .collectors import instagram, youtube
from .collectors.common import KST, save_image, today_kst
from .db import J, conn, get_setting, migrate, open_pool, q, run, set_setting
from .seed import ensure_defaults


def log(msg):
    print(datetime.now(KST).strftime("%m-%d %H:%M"), msg, flush=True)


def compute_ranks():
    """오늘 기록된 콘텐츠를 플랫폼·업종별로 반응 수(조회 → 좋아요+댓글) 순으로 줄 세워 순위 저장"""
    today = today_kst()
    with conn() as c:
        c.execute(
            """WITH r AS (
                 SELECT d.content_id, RANK() OVER (PARTITION BY x.platform, x.industry
                          ORDER BY d.views DESC, (d.likes + d.comments) DESC) AS rk
                 FROM content_daily d JOIN contents x ON x.id = d.content_id WHERE d.day = %s)
               UPDATE content_daily d SET rank = r.rk FROM r WHERE d.content_id = r.content_id AND d.day = %s""",
            (today, today),
        )


def fetch_missing_images(limit=40):
    """크롬 확장이 이미지 주소만 보낸 광고 등, 아직 서버에 저장 안 된 이미지 내려받기"""
    rows = q("SELECT id, remote_thumb FROM contents WHERE thumb IS NULL AND remote_thumb IS NOT NULL AND NOT is_demo LIMIT %s", (limit,))
    for r in rows:
        thumb, hist = save_image(r["remote_thumb"], r["id"])
        if thumb:
            run("UPDATE contents SET thumb=%s, hist=%s WHERE id=%s", (thumb, J(hist) if hist else None, r["id"]))
    # 이미지는 있는데 색 정보가 없는 경우 (확장에서 직접 올린 이미지)
    for r in q("SELECT id, thumb FROM contents WHERE thumb IS NOT NULL AND hist IS NULL LIMIT %s", (limit,)):
        from pathlib import Path
        from .collectors.common import MEDIA, histogram
        p = MEDIA / Path(r["thumb"]).name
        if p.exists():
            h = histogram(p.read_bytes())
            run("UPDATE contents SET hist=%s WHERE id=%s", (J(h) if h else J([]), r["id"]))


def do_job(kind: str) -> str:
    if kind == "check_instagram":
        return instagram.check()
    if kind == "check_youtube":
        return youtube.check()
    msgs = []
    if kind in ("collect_all", "collect_instagram"):
        try:
            msgs.append(instagram.collect_all(log))
        except instagram.IGError as e:
            msgs.append("인스타그램: " + str(e))
    if kind in ("collect_all", "collect_youtube"):
        try:
            msgs.append(youtube.collect_all(log))
        except youtube.YTError as e:
            msgs.append("유튜브: " + str(e))
    compute_ranks()
    fetch_missing_images()
    return " | ".join(msgs)


def maybe_schedule_daily():
    now = datetime.now(KST)
    try:
        hour = int(get_setting("collect_hour", "6"))
    except ValueError:
        hour = 6
    key = now.strftime("%Y-%m-%d")
    if now.hour >= hour and get_setting("last_daily") != key:
        set_setting("last_daily", key)
        run("INSERT INTO jobs(kind) VALUES('collect_all')")
        log("매일 수집 작업을 예약했어요")


def main():
    open_pool()
    migrate()
    ensure_defaults()
    # 서버가 꺼지면서 멈춘 작업 정리
    run("UPDATE jobs SET status='error', message='서버 재시작으로 중단됨', finished_at=now() WHERE status='running'")
    log("워커 시작")
    tick = 0
    while True:
        try:
            if tick % 10 == 0:
                maybe_schedule_daily()
                fetch_missing_images(10)
            with conn() as c:
                job = c.execute(
                    """UPDATE jobs SET status='running', started_at=now() WHERE id = (
                         SELECT id FROM jobs WHERE status='queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
                       RETURNING id, kind"""
                ).fetchone()
            if job:
                log(f"작업 시작: {job['kind']}")
                try:
                    msg, st = do_job(job["kind"]), "done"
                except Exception as e:  # noqa: BLE001
                    traceback.print_exc()
                    msg, st = str(e)[:500], "error"
                run("UPDATE jobs SET status=%s, message=%s, finished_at=now() WHERE id=%s", (st, msg[:2000], job["id"]))
                log(f"작업 끝: {msg}")
                continue
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        tick += 1
        time.sleep(6)


if __name__ == "__main__":
    main()
