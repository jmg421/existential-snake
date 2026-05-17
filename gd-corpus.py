#!/usr/bin/env python3
"""
Download and analyze popular Geometry Dash levels.
Extracts structural patterns to inform QPU-based level generation.

Uses the GD server API (boomlings.com) to fetch level strings,
decodes them, and extracts statistics on object placement, density,
section structure, speed changes, mode switches, etc.
"""

import base64
import zlib
import json
import time
import requests
from collections import Counter, defaultdict
from pathlib import Path

GD_API = "http://www.boomlings.com/database"
SAVE_DIR = Path("corpus")
SAVE_DIR.mkdir(exist_ok=True)

# Famous levels to analyze (level IDs)
FAMOUS_LEVELS = {
    # Official levels
    "Stereo Madness": 1,
    "Back On Track": 2,
    "Polargeist": 3,
    "Dry Out": 4,
    "Base After Base": 5,
    "Cant Let Go": 6,
    "Jumper": 7,
    "Time Machine": 8,
    "Cycles": 9,
    "xStep": 10,
    "Clutterfunk": 11,
    "Theory of Everything": 12,
    "Electroman Adventures": 13,
    "Clubstep": 14,
    "Electrodynamix": 15,
    "Hexagon Force": 16,
    "Blast Processing": 17,
    "Theory of Everything 2": 18,
    "Geometrical Dominator": 19,
    "Deadlocked": 20,
    "Fingerdash": 21,
    # Popular user levels (by ID)
    "Bloodbath": 10565740,
    "Cataclysm": 12170790,
    "Sonic Wave": 20663297,
    "Nine Circles": 4284013,
    "The Nightmare": 13519,
    "The Lightning Road": 44622,
    "Clubstep v2": 6508283,
    "Supersonic": 23298409,
    "Windy Landscape": 23298017,
    "Future Funk": 21761999,
}

# Key object IDs
OBJECT_CLASSES = {
    "spike": {8, 39, 103, 392},
    "block": set(range(1, 8)),
    "portal_ship": {12},
    "portal_cube": {13},
    "portal_ball": {47},
    "portal_ufo": {111},
    "portal_wave": {660},
    "portal_robot": {745},
    "portal_spider": {1331},
    "portal_swing": {1933},
    "gravity_flip": {10},
    "gravity_normal": {11},
    "speed_05x": {200},
    "speed_1x": {201},
    "speed_2x": {202},
    "speed_3x": {203},
    "speed_4x": {1334},
    "yellow_pad": {35},
    "yellow_orb": {36},
    "blue_pad": {67},
    "blue_orb": {84},
    "pink_pad": {140},
    "pink_orb": {141},
    "red_pad": {1332},
    "red_orb": {1333},
}

# Reverse lookup
OBJ_ID_TO_CLASS = {}
for cls, ids in OBJECT_CLASSES.items():
    for oid in ids:
        OBJ_ID_TO_CLASS[oid] = cls


def download_level(level_id):
    """Download a level string from GD servers."""
    data = {
        "gameVersion": "22",
        "binaryVersion": "42",
        "gdw": "0",
        "levelID": str(level_id),
        "secret": "Wmfd2893gb7",
    }
    try:
        resp = requests.post(f"{GD_API}/downloadGJLevel22.php", data=data, timeout=10)
        if resp.status_code == 200 and resp.text != "-1":
            return resp.text
    except Exception as e:
        print(f"    Error: {e}")
    return None


def decode_level_string(raw_response):
    """Extract and decode the level string from server response."""
    # Response is key:value pairs separated by colons
    parts = raw_response.split("#")[0]  # Remove hash/extra data
    fields = parts.split(":")
    
    level_string = None
    for i in range(0, len(fields) - 1, 2):
        if fields[i] == "4":
            level_string = fields[i + 1]
            break

    if not level_string:
        return None

    try:
        decoded = base64.urlsafe_b64decode(level_string.encode())
        decompressed = zlib.decompress(decoded, 15 | 32).decode()
        return decompressed
    except Exception:
        return None


def parse_objects(level_data):
    """Parse level string into object list."""
    parts = level_data.split(";")
    if len(parts) < 2:
        return [], {}

    # First part is level header
    header_raw = parts[0]
    header = {}
    header_fields = header_raw.split(",")
    for i in range(0, len(header_fields) - 1, 2):
        header[header_fields[i]] = header_fields[i + 1]

    # Rest are objects
    objects = []
    for obj_str in parts[1:]:
        if not obj_str.strip():
            continue
        fields = obj_str.split(",")
        obj = {}
        for i in range(0, len(fields) - 1, 2):
            try:
                obj[int(fields[i])] = fields[i + 1]
            except (ValueError, IndexError):
                continue
        if 1 in obj and 2 in obj and 3 in obj:
            objects.append(obj)

    return objects, header


def analyze_level(name, objects, header):
    """Extract structural statistics from a parsed level."""
    if not objects:
        return None

    stats = {
        "name": name,
        "total_objects": len(objects),
        "object_classes": Counter(),
        "x_positions": [],
        "mode_changes": [],
        "speed_changes": [],
        "density_by_section": [],
    }

    # Classify objects
    for obj in objects:
        obj_id = int(obj.get(1, 0))
        x = float(obj.get(2, 0))
        cls = OBJ_ID_TO_CLASS.get(obj_id, "decoration")
        stats["object_classes"][cls] += 1
        stats["x_positions"].append(x)

        if cls.startswith("portal_"):
            stats["mode_changes"].append({"x": x, "mode": cls})
        elif cls.startswith("speed_"):
            stats["speed_changes"].append({"x": x, "speed": cls})

    # Density analysis (divide level into 10 sections)
    if stats["x_positions"]:
        max_x = max(stats["x_positions"])
        section_size = max_x / 10
        for s in range(10):
            start = s * section_size
            end = (s + 1) * section_size
            count = sum(1 for x in stats["x_positions"] if start <= x < end)
            stats["density_by_section"].append(count)

    # Gameplay object spacing (non-decoration)
    gameplay_x = sorted(
        float(obj.get(2, 0)) for obj in objects
        if OBJ_ID_TO_CLASS.get(int(obj.get(1, 0)), "decoration") != "decoration"
    )
    if len(gameplay_x) > 1:
        gaps = [gameplay_x[i+1] - gameplay_x[i] for i in range(len(gameplay_x)-1)]
        stats["avg_gap"] = sum(gaps) / len(gaps)
        stats["min_gap"] = min(gaps)
        stats["max_gap"] = max(gaps)
        stats["gameplay_objects"] = len(gameplay_x)

    # Remove raw positions (too large to store)
    del stats["x_positions"]

    return stats


def main():
    print("=" * 60)
    print("  GD LEVEL CORPUS DOWNLOADER & ANALYZER")
    print("=" * 60)
    print(f"  Downloading {len(FAMOUS_LEVELS)} levels...")
    print()

    all_stats = []

    for name, level_id in FAMOUS_LEVELS.items():
        print(f"  [{level_id:>10}] {name}...", end=" ", flush=True)

        # Check cache
        cache_file = SAVE_DIR / f"{level_id}.json"
        if cache_file.exists():
            stats = json.loads(cache_file.read_text())
            all_stats.append(stats)
            print(f"(cached) {stats.get('total_objects', '?')} objects")
            continue

        raw = download_level(level_id)
        if not raw:
            print("FAILED")
            time.sleep(0.5)
            continue

        level_data = decode_level_string(raw)
        if not level_data:
            print("DECODE FAILED")
            time.sleep(0.5)
            continue

        objects, header = parse_objects(level_data)
        stats = analyze_level(name, objects, header)

        if stats:
            # Save raw level data too
            (SAVE_DIR / f"{level_id}.lvl").write_text(level_data)
            cache_file.write_text(json.dumps(stats, indent=2, default=str))
            all_stats.append(stats)
            print(f"{stats['total_objects']} objects, "
                  f"{stats.get('gameplay_objects', '?')} gameplay")
        else:
            print("NO OBJECTS")

        time.sleep(0.3)  # Rate limit

    # Aggregate analysis
    print(f"\n{'='*60}")
    print(f"  CORPUS ANALYSIS ({len(all_stats)} levels)")
    print(f"{'='*60}")

    if not all_stats:
        print("  No levels downloaded successfully.")
        return

    # Object counts
    total_objs = sum(s['total_objects'] for s in all_stats)
    gameplay_objs = sum(s.get('gameplay_objects', 0) for s in all_stats)
    print(f"\n  Total objects across corpus: {total_objs:,}")
    print(f"  Gameplay objects: {gameplay_objs:,}")
    print(f"  Decoration ratio: {(total_objs - gameplay_objs) / total_objs:.0%}")

    # Class distribution
    combined_classes = Counter()
    for s in all_stats:
        combined_classes.update(s['object_classes'])
    print(f"\n  Object class distribution:")
    for cls, count in combined_classes.most_common(15):
        pct = count / total_objs * 100
        bar = '█' * int(pct)
        print(f"    {cls:<20} {count:>8,} ({pct:>4.1f}%) {bar}")

    # Density curves
    print(f"\n  Average density curve (10 sections):")
    avg_density = [0] * 10
    n = len([s for s in all_stats if s.get('density_by_section')])
    for s in all_stats:
        if s.get('density_by_section'):
            for i, d in enumerate(s['density_by_section']):
                avg_density[i] += d
    if n:
        avg_density = [d / n for d in avg_density]
        max_d = max(avg_density) if avg_density else 1
        for i, d in enumerate(avg_density):
            bar = '█' * int(d / max_d * 30)
            print(f"    Section {i+1:>2}: {d:>6.0f} objects  {bar}")

    # Spacing stats
    gaps = [s['avg_gap'] for s in all_stats if 'avg_gap' in s]
    if gaps:
        print(f"\n  Gameplay object spacing:")
        print(f"    Average gap: {sum(gaps)/len(gaps):.1f} units")
        print(f"    Min avg gap: {min(gaps):.1f} units (densest level)")
        print(f"    Max avg gap: {max(gaps):.1f} units (sparsest level)")

    # Mode changes
    mode_counts = Counter()
    for s in all_stats:
        for mc in s.get('mode_changes', []):
            mode_counts[mc['mode']] += 1
    if mode_counts:
        print(f"\n  Mode portal usage:")
        for mode, count in mode_counts.most_common():
            print(f"    {mode:<20} {count:>4} times")

    # Speed changes
    speed_counts = Counter()
    for s in all_stats:
        for sc in s.get('speed_changes', []):
            speed_counts[sc['speed']] += 1
    if speed_counts:
        print(f"\n  Speed portal usage:")
        for speed, count in speed_counts.most_common():
            print(f"    {speed:<20} {count:>4} times")

    # Save aggregate
    summary = {
        "levels_analyzed": len(all_stats),
        "total_objects": total_objs,
        "gameplay_objects": gameplay_objs,
        "decoration_ratio": (total_objs - gameplay_objs) / total_objs,
        "class_distribution": dict(combined_classes.most_common()),
        "avg_density_curve": avg_density,
        "avg_gap": sum(gaps) / len(gaps) if gaps else 0,
        "mode_portals": dict(mode_counts),
        "speed_portals": dict(speed_counts),
        "per_level": [{k: v for k, v in s.items() if k != 'x_positions'}
                      for s in all_stats],
    }
    (SAVE_DIR / "analysis.json").write_text(json.dumps(summary, indent=2, default=str))
    print(f"\n  📁 Analysis saved to corpus/analysis.json")
    print(f"  📁 Raw level data in corpus/*.lvl")


if __name__ == "__main__":
    main()
