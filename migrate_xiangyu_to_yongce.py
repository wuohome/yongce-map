"""
從享寓 Ragic 撈所有「案件所屬公司=永策不動產」的物件，寫進永策 Ragic。

Source: ap12.ragic.com/xiangyu/forms2/48 (享寓「委託資料-總(聯盟)」, 200 筆共)
Target: ap16.ragic.com/YongCe/property-data-kept/1 (永策「租賃物件」)
"""
import json
import sys
import time
import urllib.parse
import urllib.request

# 享寓 (xiangyu)
SRC_BASE = "https://ap12.ragic.com/xiangyu/forms2/48"
SRC_KEY = "ZGlvWFNFb1FKazM4OU0xd1BZR2poSEcwbExsc2JsaHB1WVZRaVBrWEp1WDBubGhJUTZvWFhoeXBza2hnbGtTTFF1NTN0UlQzR2U2TGgvbXVvR0RIdkE9PQ=="

# 永策 (YongCe)
DST_BASE = "https://ap16.ragic.com/YongCe/property-data-kept/1"
DST_KEY = "VEZsOEwzYzVJdWdoWXRDM3ptS2YwRkllTFlXVXlwaEpEcG1IajBXM0NiU1A0emdURlN1WFZHMDRQS28zM2F1bA=="

# 享寓欄位 fid → 永策欄位 fid 對照
FIELD_MAP_DIRECT = [
    ("1012261", "1000007"),      # 房屋簡稱
    ("1012267", "1000011"),      # 物件地址 (詳細)
    ("1012271", "1000035"),      # 物件用途 (Listing) - 「住宅」直接 match
    ("1012272", "1000034"),      # 物件型態 (Listing) - 「電梯大樓」直接 match
    ("1012274", "1000047"),      # 格局
    ("1012269", "1000089"),      # 權狀坪數 → 登記坪數
    ("1012287", "1000030"),      # 租金 → 月租金
    ("1012290", "1000032"),      # 押金金額
    ("1012292", "1000038"),      # 管理費 → 房屋管理費
    ("1012338", "1000027"),      # 591連結
    ("1012420", "1000015"),      # 委託日期 → 委託時間(起)
    ("1012345", "1000044"),      # 總樓層
]

STATUS_MAP = {
    "未出租": "代租中",
    "自租": "代租中",
    "出租": "下架",
    "收訂中": "已收定，可帶看",
}

# 縣市：「台」→「臺」異體字
CITY_MAP = {
    "台北市": "臺北市",
    "台中市": "臺中市",
    "台南市": "臺南市",
    "新北市": "新北市",
    "桃園市": "桃園市",
    "高雄市": "高雄市",
}


def http(method, url, key, data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Basic {key}")
    if data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, data=body, timeout=30) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def fetch_xiangyu_yongce_records():
    url = f"{SRC_BASE}?api&naming=EID&limit=2000"
    _, d = http("GET", url, SRC_KEY)
    return [r for r in d.values() if (r.get("1012318") or "").strip() == "永策不動產"]


def fetch_yongce_existing_fingerprints():
    """抓永策現有記錄的指紋（地址+月租金）防重複寫入"""
    url = f"{DST_BASE}?api&naming=EID&limit=2000"
    _, d = http("GET", url, DST_KEY)
    seen = set()
    for r in d.values():
        addr = (r.get("1000011") or "").strip()
        rent = (r.get("1000030") or "").strip()
        if addr:
            seen.add((addr, rent))
    return seen


def fingerprint_payload(payload):
    return (payload.get("1000011", "").strip(), payload.get("1000030", "").strip())


def build_payload(src):
    """從享寓記錄組永策 POST payload"""
    payload = {}
    for src_fid, dst_fid in FIELD_MAP_DIRECT:
        v = src.get(src_fid)
        if v not in (None, "", []):
            payload[dst_fid] = v if isinstance(v, str) else str(v)

    # 狀態映射
    src_status = (src.get("1012259") or "").strip()
    payload["1000002"] = STATUS_MAP.get(src_status, "代租中")

    # 縣市：台→臺
    city_raw = (src.get("1012263") or "").strip()
    city = CITY_MAP.get(city_raw, city_raw)
    if city:
        payload["1000005"] = city

    # 鄉鎮市區：永策格式「{臺/新北/桃園...}|{區}」
    district = (src.get("1012264") or "").strip()
    if city and district:
        payload["1000006"] = f"{city}|{district}"

    # 物件類別：永策格式「{用途}|{類別}」
    usage = (src.get("1012271") or "").strip()
    cat = (src.get("1012273") or "").strip()
    if usage and cat:
        payload["1000037"] = f"{usage}|{cat}"

    # 進屋方式：享寓多選、永策單選且必填，全部設「聯絡(業務)」default
    payload["1000014"] = "聯絡(業務)"

    # 座標合併 lat,lng
    lat = (src.get("1012352") or "").strip()
    lng = (src.get("1012353") or "").strip()
    if lat and lng:
        payload["1000036"] = f"{lat},{lng}"

    # 案名 = 房屋簡稱 fallback
    title = (src.get("1012261") or "").strip()
    if title:
        payload["1000009"] = title

    return payload


def post_to_yongce(payload):
    url = f"{DST_BASE}?api&v=3"
    return http("POST", url, DST_KEY, data=payload)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "dryrun"
    print(f"== mode: {mode} ==")
    records = fetch_xiangyu_yongce_records()
    print(f"享寓永策物件 total: {len(records)}")

    if mode == "dryrun":
        sample = records[0]
        payload = build_payload(sample)
        print("Sample source:", sample.get("1012261"), sample.get("1012267"))
        print("Sample payload (永策格式):")
        for k, v in sorted(payload.items()):
            print(f"  {k} = {str(v)[:60]}")
        print()
        print("送一筆進永策試試...")
        status, resp = post_to_yongce(payload)
        print(f"HTTP {status}")
        print(json.dumps(resp, ensure_ascii=False, indent=2)[:2000])
        return

    if mode == "go":
        existing = fetch_yongce_existing_fingerprints()
        print(f"永策現有 {len(existing)} 筆，跳過已有 fingerprint")
        success, fail, skip = 0, 0, 0
        errors = []
        for i, r in enumerate(records):
            payload = build_payload(r)
            fp = fingerprint_payload(payload)
            if fp in existing:
                skip += 1
                print(f"[{i+1}/{len(records)}] SKIP dup {r.get('1012261')}")
                continue
            try:
                status, resp = post_to_yongce(payload)
                if resp.get("status") == "SUCCESS":
                    success += 1
                    existing.add(fp)
                    print(f"[{i+1}/{len(records)}] OK title={r.get('1012261')}")
                else:
                    fail += 1
                    msg = resp.get("msg") or resp.get("message") or str(resp)[:200]
                    errors.append((i, r.get("1012261"), msg))
                    print(f"[{i+1}/{len(records)}] FAIL {r.get('1012261')} → {msg}")
            except Exception as e:
                fail += 1
                errors.append((i, r.get("1012261"), str(e)))
                print(f"[{i+1}/{len(records)}] EXCEPTION {r.get('1012261')} → {e}")
            time.sleep(0.4)
        print(f"\n=== Done: {success} new, {skip} skipped (dup), {fail} fail ===")
        if errors:
            print("\n=== Errors (first 20) ===")
            for i, t, m in errors[:20]:
                print(f"  [{i}] {t}: {m}")


if __name__ == "__main__":
    main()
