"""YouTube Data API v3 수집기 (무료 할당량: 하루 10,000 단위, 채널 하나당 약 3단위 사용)"""
from datetime import datetime

import httpx

from ..db import J, conn, get_setting, q
from .common import save_image, today_kst

API = "https://www.googleapis.com/youtube/v3"


class YTError(Exception):
    pass


def _get(path, **params):
    key = get_setting("yt_api_key")
    if not key:
        raise YTError("연동 설정에 YouTube API 키를 먼저 넣어주세요")
    r = httpx.get(f"{API}/{path}", params={**params, "key": key}, timeout=30)
    d = r.json()
    if "error" in d:
        raise YTError(d["error"].get("message", "YouTube 오류"))
    return d


def check() -> str:
    d = _get("videos", part="id", chart="mostPopular", regionCode="KR", maxResults=1)
    return "연결됐어요: YouTube API 키가 정상이에요" if "items" in d else "응답이 이상해요"


def _channel(ch: str):
    ch = ch.strip()
    if "youtube.com/" in ch:
        ch = ch.rstrip("/").split("/")[-1]
    params = {"part": "snippet,statistics,contentDetails"}
    if ch.startswith("UC") and len(ch) == 24:
        params["id"] = ch
    else:
        params["forHandle"] = ch if ch.startswith("@") else "@" + ch
    items = _get("channels", **params).get("items") or []
    if not items:
        raise YTError(f"채널을 찾지 못했어요: {ch}")
    return items[0]


def _store(kind, ref_id, industry, ch):
    today = today_kst()
    stats = ch.get("statistics", {})
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids = [i["contentDetails"]["videoId"] for i in
           _get("playlistItems", part="contentDetails", playlistId=uploads, maxResults=20).get("items", [])]
    vids = _get("videos", part="snippet,statistics,contentDetails", id=",".join(ids)).get("items", []) if ids else []
    views = [int(v["statistics"].get("viewCount", 0)) for v in vids]
    eng = [int(v["statistics"].get("likeCount", 0)) + int(v["statistics"].get("commentCount", 0)) for v in vids]
    subs = int(stats.get("subscriberCount", 0))
    er = round(sum(eng) / max(sum(views), 1) * 100, 2) if views else 0
    brand_id = ref_id if kind == "brand" else "etc"
    creator_id = ref_id if kind == "creator" else None
    new = 0
    with conn() as c:
        c.execute(
            """INSERT INTO account_daily(kind,ref_id,platform,day,followers,media_count,er,avg_views)
               VALUES(%s,%s,'youtube',%s,%s,%s,%s,%s)
               ON CONFLICT(kind,ref_id,platform,day) DO UPDATE SET followers=EXCLUDED.followers,
                 media_count=EXCLUDED.media_count, er=EXCLUDED.er, avg_views=EXCLUDED.avg_views""",
            (kind, ref_id, today, subs, int(stats.get("videoCount", 0)), er, int(sum(views) / len(views)) if views else 0),
        )
        pid = f"{brand_id}-p0"
        c.execute("INSERT INTO products(id,brand_id,name) VALUES(%s,%s,'제품 미지정') ON CONFLICT DO NOTHING", (pid, brand_id))
        for v in vids:
            key = "yt:" + v["id"]
            sn, st = v["snippet"], v["statistics"]
            vw, lk, cm = int(st.get("viewCount", 0)), int(st.get("likeCount", 0)), int(st.get("commentCount", 0))
            row = c.execute("SELECT id FROM contents WHERE source_key=%s", (key,)).fetchone()
            if row:
                cid = row["id"]
                c.execute("UPDATE contents SET views=%s, likes=%s, comments=%s, last_seen_at=now() WHERE id=%s", (vw, lk, cm, cid))
            else:
                cid = "yt" + v["id"]
                th = sn.get("thumbnails", {})
                url = (th.get("high") or th.get("medium") or th.get("default") or {}).get("url")
                thumb, hist = save_image(url, key)
                tags = ["영상", "인플루언서" if kind == "creator" else "브랜드 계정"]
                c.execute(
                    """INSERT INTO contents(id,source,source_key,source_url,platform,brand_id,product_id,store_id,creator_id,
                         industry,media,headline,body,thumb,remote_thumb,hist,is_ad,started_at,last_seen_at,views,likes,comments,tags)
                       VALUES(%s,'yt',%s,%s,'youtube',%s,%s,'etc',%s,%s,'video',%s,%s,%s,%s,%s,false,%s,now(),%s,%s,%s,%s)
                       ON CONFLICT(id) DO NOTHING""",
                    (cid, key, "https://www.youtube.com/watch?v=" + v["id"], brand_id, pid, creator_id, industry,
                     sn.get("title", "")[:200], (sn.get("description") or "")[:4000], thumb, None if thumb else url,
                     J(hist) if hist else None, datetime.fromisoformat(sn["publishedAt"].replace("Z", "+00:00")),
                     vw, lk, cm, J(tags)),
                )
                new += 1
            c.execute(
                """INSERT INTO content_daily(content_id,day,views,likes,comments) VALUES(%s,%s,%s,%s,%s)
                   ON CONFLICT(content_id,day) DO UPDATE SET views=EXCLUDED.views, likes=EXCLUDED.likes, comments=EXCLUDED.comments""",
                (cid, today, vw, lk, cm),
            )
    return new


def collect_all(log) -> str:
    if not get_setting("yt_api_key"):
        raise YTError("연동 설정에 YouTube API 키를 먼저 넣어주세요")
    targets = [("brand", r["id"], r["industry"], r["yt_channel"]) for r in
               q("SELECT id, industry, yt_channel FROM brands WHERE yt_channel IS NOT NULL AND NOT is_demo")]
    targets += [("creator", r["id"], r["industry"], r["yt_channel"]) for r in
                q("SELECT id, industry, yt_channel FROM creators WHERE yt_channel IS NOT NULL AND NOT is_demo")]
    ok, new, errors = 0, 0, []
    for kind, rid, ind, ch in targets:
        try:
            new += _store(kind, rid, ind, _channel(ch))
            ok += 1
        except YTError as e:
            errors.append(str(e))
    msg = f"유튜브 {ok}/{len(targets)}개 채널 수집, 새 영상 {new}개"
    if errors:
        msg += " · 문제: " + " / ".join(errors[:3])
    log(msg)
    return msg
