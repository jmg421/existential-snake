#!/usr/bin/env python3
"""Download a corpus of Geometry Dash levels from the GD servers."""

import requests
import base64
import zlib
import json
import os
import time

GD_API = "https://www.boomlings.com/database/"
HEADERS = {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": ""}
CORPUS_DIR = "corpus"

def gd_post(endpoint, params):
    params["secret"] = "Wmfd2893gb7"
    params["gameVersion"] = "22"
    params["binaryVersion"] = "42"
    resp = requests.post(GD_API + endpoint, data=params, headers=HEADERS)
    return resp.text

def search_levels(query="", type_=0, page=0):
    """Search for levels. type: 0=search, 1=most downloaded, 2=most liked, 3=trending, 6=featured"""
    text = gd_post("getGJLevels21.php", {"str": query, "type": str(type_), "page": str(page)})
    if text == "-1":
        return []
    parts = text.split("#")
    if not parts[0]:
        return []
    levels = []
    for lstr in parts[0].split("|"):
        m = {}
        kv = lstr.split(":")
        for i in range(0, len(kv) - 1, 2):
            m[kv[i]] = kv[i + 1]
        levels.append({
            "id": m.get("1"),
            "name": m.get("2"),
            "downloads": int(m.get("10", 0)),
            "likes": int(m.get("14", 0)),
            "stars": m.get("18", "0"),
            "length": ["Tiny", "Short", "Medium", "Long", "XL"][min(int(m.get("15", 0)), 4)] if m.get("15", "0").isdigit() else "?",
            "difficulty": m.get("9", "0"),
        })
    return levels

def download_level(level_id):
    """Download a level's data by ID."""
    text = gd_post("downloadGJLevel22.php", {"levelID": str(level_id)})
    if text == "-1":
        return None
    kv = text.split(":")
    m = {}
    for i in range(0, len(kv) - 1, 2):
        m[kv[i]] = kv[i + 1]
    return m.get("4")  # level string

def decode_level_string(data):
    """Decode a GD level string (base64 + zlib)."""
    data = data.strip()
    try:
        b = base64.urlsafe_b64decode(data + "==")
        return zlib.decompress(b, 15 + 32).decode("utf-8", errors="replace")
    except:
        try:
            b = base64.b64decode(data.replace("-", "+").replace("_", "/") + "==")
            return zlib.decompress(b, 15 + 32).decode("utf-8", errors="replace")
        except:
            if ";" in data and "," in data:
                return data
            return None

def parse_objects(raw):
    """Parse raw level string into header + list of objects."""
    sections = raw.split(";")
    header = sections[0]
    objects = []
    for s in sections[1:]:
        if not s.strip():
            continue
        parts = s.split(",")
        obj = {}
        for i in range(0, len(parts) - 1, 2):
            obj[parts[i]] = parts[i + 1]
        if obj:
            objects.append(obj)
    return header, objects

def main():
    os.makedirs(CORPUS_DIR, exist_ok=True)

    # Download featured levels, most liked, and some popular searches
    queries = [
        ("featured", 6, 0),
        ("featured", 6, 1),
        ("most_liked", 2, 0),
        ("most_liked", 2, 1),
        ("trending", 3, 0),
    ]

    all_levels = []
    seen_ids = set()

    for label, type_, page in queries:
        print(f"Searching: {label} (page {page})...")
        levels = search_levels("", type_, page)
        for lv in levels:
            if lv["id"] not in seen_ids:
                seen_ids.add(lv["id"])
                all_levels.append(lv)
        time.sleep(0.5)

    print(f"\nFound {len(all_levels)} unique levels. Downloading...")

    downloaded = 0
    for lv in all_levels:
        level_id = lv["id"]
        name = (lv["name"] or f"level_{level_id}").replace("/", "-").replace("\\", "-")[:50]
        filepath = os.path.join(CORPUS_DIR, f"{level_id}_{name}.json")

        if os.path.exists(filepath):
            print(f"  Skip {name} (already have)")
            downloaded += 1
            continue

        print(f"  Downloading: {name} (ID: {level_id})...")
        raw_data = download_level(level_id)
        if not raw_data:
            print(f"    FAILED")
            continue

        decoded = decode_level_string(raw_data)
        if not decoded:
            print(f"    Could not decode")
            continue

        header, objects = parse_objects(decoded)

        level_info = {
            "id": level_id,
            "name": lv["name"],
            "downloads": lv["downloads"],
            "likes": lv["likes"],
            "stars": lv["stars"],
            "length": lv["length"],
            "object_count": len(objects),
            "header": header,
            "objects": objects[:5000],  # cap to avoid huge files
        }

        with open(filepath, "w") as f:
            json.dump(level_info, f)

        downloaded += 1
        print(f"    OK ({len(objects)} objects)")
        time.sleep(0.3)

    print(f"\nDone! Downloaded {downloaded} levels to {CORPUS_DIR}/")

if __name__ == "__main__":
    main()
