"""화면이 처음 열릴 때 내려주는 데이터. 프로토타입의 window.SCOUT 모양과 똑같이 맞춘다."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from .db import q

WEEKS = 26
MAX_CONTENTS = 6000


def _today() -> date:
    # 한국 시간 기준 오늘
    return (datetime.now(timezone.utc) + timedelta(hours=9)).date()


def _weekly(points: dict, today: date, fallback: list | None, default=0):
    """{날짜: 값} → 최근 26주 주간 값 (빈 주는 앞의 값으로 채움)"""
    if not points:
        if fallback and len(fallback) == WEEKS:
            return fallback
        return [default] * WEEKS
    days = sorted(points)
    out, j, last = [], 0, points[days[0]]
    for i in range(WEEKS):
        end = today - timedelta(days=(WEEKS - 1 - i) * 7)
        while j < len(days) and days[j] <= end:
            last = points[days[j]]
            j += 1
        out.append(last)
    return out


def build(state: dict) -> dict:
    today = _today()
    brands = q("SELECT * FROM brands ORDER BY hidden, created_at, name")
    products = q("SELECT * FROM products ORDER BY id")
    stores = q("SELECT * FROM stores ORDER BY is_demo DESC, name")
    creators = q("SELECT * FROM creators ORDER BY created_at, name")
    contents = q("SELECT * FROM contents ORDER BY started_at DESC LIMIT %s", (MAX_CONTENTS,))

    acc = defaultdict(lambda: defaultdict(lambda: {"followers": 0, "er": 0.0, "n": 0, "avg_views": 0}))
    for r in q("SELECT * FROM account_daily WHERE day >= %s", (today - timedelta(days=WEEKS * 7 + 7),)):
        a = acc[(r["kind"], r["ref_id"])][r["day"]]
        a["followers"] += r["followers"]
        a["er"] += r["er"]
        a["avg_views"] += r["avg_views"]
        a["n"] += 1

    ranks = defaultdict(dict)
    for r in q("SELECT content_id, day, rank FROM content_daily WHERE day >= %s AND rank IS NOT NULL", (today - timedelta(days=30),)):
        ranks[r["content_id"]][r["day"]] = r["rank"]

    by_brand = defaultdict(list)
    for p in products:
        by_brand[p["brand_id"]].append({"id": p["id"], "name": p["name"], "shape": p["shape"], "brand": p["brand_id"]})

    out_brands = []
    for b in brands:
        pts = acc.get(("brand", b["id"]), {})
        ex = b["extra"] or {}
        out_brands.append({
            "id": b["id"], "name": b["name"], "industry": b["industry"], "color": b["color"],
            "products": by_brand.get(b["id"], []), "hidden": b["hidden"], "demo": b["is_demo"],
            "ig": b["ig_username"], "yt": b["yt_channel"], "metaPage": b["meta_page"],
            "followerTrend": _weekly({d: v["followers"] for d, v in pts.items()}, today, ex.get("followerTrend")),
            "erTrend": _weekly({d: round(v["er"] / max(v["n"], 1), 2) for d, v in pts.items()}, today, ex.get("erTrend")),
        })

    out_creators = []
    for c in creators:
        pts = acc.get(("creator", c["id"]), {})
        ex = c["extra"] or {}
        trend = _weekly({d: v["followers"] for d, v in pts.items()}, today, ex.get("trend"))
        last = pts[max(pts)] if pts else None
        out_creators.append({
            "id": c["id"], "name": c["name"], "handle": c["handle"], "industry": c["industry"],
            "platforms": c["platforms"] or ["instagram"], "followers": trend[-1], "trend": trend,
            "er": round(last["er"] / max(last["n"], 1), 1) if last else ex.get("er", 0),
            "avgViews": last["avg_views"] if last else ex.get("avgViews", 0),
            "ig": c["ig_username"], "yt": c["yt_channel"], "demo": c["is_demo"],
        })

    out_contents = []
    for x in contents:
        start = x["started_at"].astimezone(timezone(timedelta(hours=9))).date()
        ago = max(0, (today - start).days)
        if x["is_ad"]:
            active = not x["ended"]
            last = x["last_seen_at"].astimezone(timezone(timedelta(hours=9))).date()
            run = ago + 1 if active else max(1, (last - start).days + 1)
        else:
            active, run = None, 0
        ex = x["extra"] or {}
        rk = ranks.get(x["id"])
        if rk and len(rk) >= 2:
            series, cur = [], rk[min(rk)]
            for i in range(30):
                d = today - timedelta(days=29 - i)
                cur = rk.get(d, cur)
                series.append(cur)
        else:
            series = ex.get("rank") or []
        out_contents.append({
            "id": x["id"], "platform": x["platform"], "brand": x["brand_id"], "industry": x["industry"],
            "product": x["product_id"] or f"{x['brand_id']}-p0", "media": x["media"], "layout": x["layout"],
            "pal": x["pal"], "headline": x["headline"], "body": x["body"], "cta": x["cta"],
            "transcript": x["transcript"], "start": start.isoformat(), "ago": ago, "run": run, "active": active,
            "isAd": x["is_ad"], "creator": x["creator_id"], "views": x["views"], "likes": x["likes"],
            "comments": x["comments"], "ages": ex.get("ages") or [], "rank": series, "tags": x["tags"] or [],
            "store": x["store_id"] or "etc", "thumb": x["thumb"] or x["remote_thumb"], "hist": x["hist"],
            "url": x["source_url"], "source": x["source"], "demo": x["is_demo"], "savedBy": x["saved_by"],
        })

    return {
        "today": today.isoformat(),
        "brands": out_brands,
        "creators": out_creators,
        "stores": [{"id": s["id"], "name": s["name"], "industries": s["industries"], "desc": s["descr"], "url": s["url"]} for s in stores],
        "contents": out_contents,
        "state": state,
    }
