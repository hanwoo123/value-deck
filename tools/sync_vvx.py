#!/usr/bin/env python3
"""Vaulted Values X 가치표 -> data/<game>.json 동기화 스크립트.

사용법 (value-deck 폴더에서):
    python tools/sync_vvx.py            # 모든 게임
    python tools/sync_vvx.py blox-fruits

- 값이 바뀐 아이템은 이전 값을 prevValue로 옮겨서 사이트에 변동률이 표시된다.
- 이미지는 images/<게임id>/ 에 없을 때만 내려받는다.
"""
import json, re, sys, os, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0"}

GAMES = {
    "cameraman-td": {
        "host": "cameraman-td.vaultedvaluesx.com",
        "hubId": "a8e4e827-7069-4dee-a89c-3ecfff47d9e6",
        "listId": "0d2a00fc-86ef-898e-a0fc-c047bc5daf93",
    },
    "blox-fruits": {
        "host": "blox-fruits.vaultedvaluesx.com",
        "hubId": "1edda585-0e40-4014-b1f9-753a7429a447",
        "listId": "faed5cc6-be8d-4114-aef3-344dcc879783",
    },
}

TREND_KO = {"stable": "안정", "overpaid": "고평가", "underpaid": "저평가", "heavily underpaid": "크게 저평가",
            "dropping": "하락세", "rising": "상승세", "fluctuating": "변동 큼", "unstable": "불안정"}
FRUIT_TYPE_KO = {"Natural": "자연계", "Beast": "동물계", "Logia": "원소계"}


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def num(v):
    """'25000000–30000000' -> 평균, '-2'/'N/A'/None -> None"""
    if v is None:
        return None
    s = str(v).replace(",", "").strip()
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", s)]
    if not nums or s.startswith("-") or s.upper() == "N/A":
        return None
    return int(round(sum(nums[:2]) / len(nums[:2])))


def is_range(v):
    return v is not None and len(re.findall(r"\d+", str(v))) >= 2 and not str(v).strip().endswith("/10")


def demand(v):
    if v is None:
        return 0
    m = re.match(r"\s*(\d+(?:\.\d+)?)", str(v))
    return float(m.group(1)) if m and not str(v).strip().startswith("-") else 0


def trend_info(stab):
    st = (stab or "").lower()
    if not st or st.startswith("-"):
        return "stable", ""
    t = "up" if "rising" in st else "down" if "dropping" in st else "stable"
    parts = [p.strip() for p in re.split(r"[/|]", st) if p.strip()]
    return t, " · ".join(TREND_KO.get(p, p) for p in parts)


def short(n):
    for d, s in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if n >= d:
            return f"{n / d:.2f}".rstrip("0").rstrip(".") + s
    return str(n)


def fields_by_label(item):
    """own_xxx 필드를 라벨(Demand/Stability)로 찾기"""
    raw = item.get("rawValues") or {}
    out = dict(raw)
    for f in (item.get("ownFieldVariants") or {}).get("fields", []):
        if f["id"] in raw:
            out[f["label"].lower()] = raw[f["id"]]
    return out


def convert_cameraman(items):
    tier = {"Exclusive": "Exclusive", "Godly": "Godly", "Mythic": "Mythic", "Legendary": "Legendary",
            "Epic": "Epic", "Rare": "Rare", "Uncommon": "Uncommon", "Common": "Common", "vekind's wife": "Epic"}
    out = []
    for it in items:
        f = fields_by_label(it)
        v = num(f.get("value"))
        if not v:
            continue  # 가치 없는 기본 유닛 제외
        c = it["category"]
        cat, r = ("게임패스", "") if c == "Gamepasses" else ("상자", "") if c == "Crates" else ("유닛", tier.get(c, ""))
        t, note = trend_info(f.get("stability"))
        out.append(dict(id=slug(it["name"]), name=it["name"], category=cat, rarity=r, value=v,
                        demand=demand(f.get("demand")), trend=t, imageUrl=it.get("imageUrl"),
                        note=f"시세: {note}" if note else ""))
    return out, {"rarities": ["Exclusive", "Godly", "Mythic", "Legendary", "Epic"],
                 "categories": ["유닛", "게임패스", "상자"],
                 "source": "Vaulted Values X 공식 가치표 참고 (1 가치 = 1 젬)"}


def convert_blox_fruits(items):
    rar = {"Mythical": "Mythic", "Legendary": "Legendary", "Rare": "Rare", "Uncommon": "Uncommon",
           "Common": "Common", "Limited": "Limited"}
    out = []
    for it in items:
        f = it.get("rawValues") or {}
        c = it["category"]
        v = num(f.get("value"))
        if not v:
            continue
        t, tnote = trend_info(f.get("stability"))
        notes = []
        if tnote:
            notes.append(f"시세: {tnote}")
        if is_range(f.get("value")):
            a, b = [int(x) for x in re.findall(r"\d+", str(f["value"]))[:2]]
            notes.append(f"범위 {short(a)}~{short(b)}")
        ft = FRUIT_TYPE_KO.get(f.get("fruitType"))
        rb = num(f.get("robuxPrice"))
        if c == "Gamepass":
            cat, r = "게임패스", ""
        elif c == "Limited":
            cat, r = "한정 아이템", "Limited"
        else:
            cat, r = "열매", rar.get(c, "")
        if ft:
            notes.insert(0, ft)
        if rb:
            notes.append(f"{rb:,} 로벅스")
        base = dict(id=slug(it["name"]), name=it["name"], category=cat, rarity=r, value=v,
                    demand=demand(f.get("demand")), trend=t, imageUrl=it.get("imageUrl"), note=" · ".join(notes))
        out.append(base)
        pv = num(f.get("permValue"))
        if cat == "열매" and pv:
            pn = [ft] if ft else []
            if is_range(f.get("permValue")):
                a, b = [int(x) for x in re.findall(r"\d+", str(f["permValue"]))[:2]]
                pn.append(f"범위 {short(a)}~{short(b)}")
            out.append(dict(base, id=base["id"] + "-perm", name=it["name"] + " (영구)", category="영구 열매",
                            value=pv, demand=demand(f.get("permDemand")), note=" · ".join(pn)))
    return out, {"rarities": ["Limited", "Mythic", "Legendary", "Rare", "Uncommon", "Common"],
                 "categories": ["열매", "영구 열매", "한정 아이템", "게임패스"],
                 "source": "Vaulted Values X 공식 가치표 참고 (단위: 벨리)"}


CONVERTERS = {"cameraman-td": convert_cameraman, "blox-fruits": convert_blox_fruits}


def download_image(url, gid, iid):
    folder = os.path.join(ROOT, "images", gid)
    os.makedirs(folder, exist_ok=True)
    for ext in ("png", "webp", "jpg"):
        p = os.path.join(folder, f"{iid}.{ext}")
        if os.path.exists(p):
            return f"images/{gid}/{iid}.{ext}"
    if not url:
        return ""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            data, ctype = r.read(), r.headers.get("Content-Type", "")
    except Exception as e:  # noqa
        print(f"  ! 이미지 실패 {iid}: {e}")
        return ""
    ext = "webp" if "webp" in ctype or data[8:12] == b"WEBP" else "jpg" if data[:3] == b"\xff\xd8\xff" else "png"
    with open(os.path.join(folder, f"{iid}.{ext}"), "wb") as fh:
        fh.write(data)
    return f"images/{gid}/{iid}.{ext}"


def sync(gid):
    cfg = GAMES[gid]
    api = f"https://{cfg['host']}/api/value-lists/live?hubId={cfg['hubId']}&listId={cfg['listId']}&surface=default"
    items, meta = CONVERTERS[gid](get_json(api)["items"])
    path = os.path.join(ROOT, "data", f"{gid}.json")
    old = {}
    if os.path.exists(path):
        old = {i["id"]: i for i in json.load(open(path, encoding="utf-8")).get("items", [])}
    seen, changed = set(), 0
    for i in items:
        while i["id"] in seen:
            i["id"] += "-2"
        seen.add(i["id"])
        i["image"] = download_image(i.pop("imageUrl", None), gid, i["id"].removesuffix("-perm"))
        o = old.get(i["id"])
        if o:
            if o.get("value") != i["value"]:
                i["prevValue"] = o["value"]
                changed += 1
            elif o.get("prevValue"):
                i["prevValue"] = o["prevValue"]
    keys = ["id", "name", "category", "rarity", "value", "prevValue", "demand", "trend", "image", "note"]
    items = [{k: i[k] for k in keys if k in i} for i in items]
    data = {"updated": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat(), "valueUnit": "", "demandMax": 10, **meta, "items": items}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"{gid}: 아이템 {len(items)}개, 시세 변경 {changed}개")


if __name__ == "__main__":
    for g in (sys.argv[1:] or GAMES):
        sync(g)
