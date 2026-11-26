"""인스타그램 Business Discovery 공식 API 수집기

다른 비즈니스·크리에이터 계정의 공개 정보(팔로워 수, 게시물, 좋아요·댓글 수)를 조회한다.
필요한 것: 조회용 인스타그램 프로페셔널 계정 ID + 그 계정과 연결된 페이스북 페이지로 받은 액세스 토큰.
개인(비공개·일반) 계정은 조회되지 않는다.
"""
import os
import time
from datetime import datetime

import httpx

from ..db import J, conn, get_setting, q
from .common import save_image, today_kst

GRAPH = "https://graph.facebook.com/" + os.environ.get("GRAPH_VERSION", "v23.0")
MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count"


class IGError(Exception):
    pass


def _creds():
    uid, tok = get_setting("ig_user_id"), get_setting("ig_access_token")
    if not uid or not tok:
        raise IGError("연동 설정에 인스타그램 계정 ID와 토큰을 먼저 넣어주세요")
    return uid, tok


def discover(username: str, limit: int = 25) -> dict:
    uid, tok = _creds()
    fields = f"business_discovery.username({username}){{username,name,followers_count,media_count,media.limit({limit}){{{MEDIA_FIELDS}}}}}"
    r = httpx.get(f"{GRAPH}/{uid}", params={"fields": fields, "access_token": tok}, timeout=30)
    data = r.json()
    if "error" in data:
        e = data["error"]
        msg = e.get("error_user_msg") or e.get("message") or "알 수 없는 오류"
        if e.get("code") in (4, 17, 32, 613):
            raise IGError("요청 한도에 걸렸어요. 1시간쯤 뒤에 다시 수집해 주세요: " + msg)
        if e.get("code") == 190:
            raise IGError("토큰이 만료됐거나 잘못됐어요. 연동 설정에서 새 토큰을 넣어주세요")
        raise IGError(f"@{username}: {msg}")
    return data["business_discovery"]


def check() -> str:
    """연동 확인: 내 조회용 계정 정보를 불러온다"""
    uid, tok = _creds()
    r = httpx.get(f"{GRAPH}/{uid}", params={"fields": "username,followers_count", "access_token": tok}, timeout=20)
    d = r.json()
    if "error" in d:
        raise IGError(d["error"].get("message", "연결 실패"))
    return f"연결됐어요: @{d.get('username')} (팔로워 {d.get('followers_count', 0)}명)"


def _media_kind(m):
    t = m.get("media_type")
    if t == "VIDEO" or m.get("media_product_type") == "REELS":
        return "video"
    if t == "CAROUSEL_ALBUM":
        return "carousel"
    return "image"


def _store(kind: str, ref_id: str, industry: str, bd: dict):
    today = today_kst()
    media = bd.get("media", {}).get("data", [])
    followers = bd.get("followers_count", 0) or 0
    eng = [(m.get("like_count") or 0) + (m.get("comments_count") or 0) for m in media[:12]]
    er = round(sum(eng) / len(eng) / followers * 100, 2) if eng and followers else 0
    brand_id = ref_id if kind == "brand" else "etc"
    creator_id = ref_id if kind == "creator" else None
    with conn() as c:
        c.execute(
            """INSERT INTO account_daily(kind,ref_id,platform,day,followers,media_count,er,avg_views)
               VALUES(%s,%s,'instagram',%s,%s,%s,%s,%s)
               ON CONFLICT(kind,ref_id,platform,day) DO UPDATE SET followers=EXCLUDED.followers,
                 media_count=EXCLUDED.media_count, er=EXCLUDED.er, avg_views=EXCLUDED.avg_views""",
            (kind, ref_id, today, followers, bd.get("media_count", 0) or 0, er, int(sum(eng) / len(eng)) if eng else 0),
        )
        pid = f"{brand_id}-p0"
        c.execute("INSERT INTO products(id,brand_id,name) VALUES(%s,%s,'제품 미지정') ON CONFLICT DO NOTHING", (pid, brand_id))
        new = 0
        for m in media:
            key = "ig:" + m["id"]
            cap = (m.get("caption") or "").strip()
            lines = [x for x in cap.split("\n") if x.strip()]
            head = (lines[0] if lines else "")[:120]
            kindm = _media_kind(m)
            likes, comments = m.get("like_count") or 0, m.get("comments_count") or 0
            row = c.execute("SELECT id, thumb FROM contents WHERE source_key=%s", (key,)).fetchone()
            if row:
                cid = row["id"]
                c.execute("UPDATE contents SET likes=%s, comments=%s, last_seen_at=now() WHERE id=%s", (likes, comments, cid))
            else:
                cid = "ig" + m["id"][-10:]
                img = m.get("thumbnail_url") or m.get("media_url")
                thumb, hist = save_image(img, key)
                ts = datetime.fromisoformat(m["timestamp"].replace("+0000", "+00:00"))
                tags = ["영상" if kindm == "video" else "캐러셀" if kindm == "carousel" else "이미지",
                        "인플루언서" if kind == "creator" else "브랜드 계정"]
                c.execute(
                    """INSERT INTO contents(id,source,source_key,source_url,platform,brand_id,product_id,store_id,creator_id,
                         industry,media,headline,body,thumb,remote_thumb,hist,is_ad,started_at,last_seen_at,likes,comments,tags,raw)
                       VALUES(%s,'ig',%s,%s,'instagram',%s,%s,'etc',%s,%s,%s,%s,%s,%s,%s,%s,false,%s,now(),%s,%s,%s,%s)
                       ON CONFLICT(id) DO NOTHING""",
                    (cid, key, m.get("permalink"), brand_id, pid, creator_id, industry, kindm, head,
                     "\n".join(lines[1:])[:4000], thumb, None if thumb else img, J(hist) if hist else None, ts,
                     likes, comments, J(tags), J(m)),
                )
                new += 1
            c.execute(
                """INSERT INTO content_daily(content_id,day,likes,comments) VALUES(%s,%s,%s,%s)
                   ON CONFLICT(content_id,day) DO UPDATE SET likes=EXCLUDED.likes, comments=EXCLUDED.comments""",
                (cid, today, likes, comments),
            )
    return new


def collect_all(log) -> str:
    _creds()
    targets = [("brand", r["id"], r["industry"], r["ig_username"]) for r in
               q("SELECT id, industry, ig_username FROM brands WHERE ig_username IS NOT NULL AND NOT is_demo")]
    targets += [("creator", r["id"], r["industry"], r["ig_username"]) for r in
                q("SELECT id, industry, ig_username FROM creators WHERE ig_username IS NOT NULL AND NOT is_demo")]
    ok, new, errors = 0, 0, []
    for kind, rid, ind, user in targets:
        try:
            new += _store(kind, rid, ind, discover(user))
            ok += 1
        except IGError as e:
            errors.append(str(e))
            if "한도" in str(e) or "토큰" in str(e):
                break
        time.sleep(2)  # 천천히 (시간당 호출 한도 보호)
    msg = f"인스타그램 {ok}/{len(targets)}개 계정 수집, 새 게시물 {new}개"
    if errors:
        msg += " · 문제: " + " / ".join(errors[:3])
    log(msg)
    return msg
