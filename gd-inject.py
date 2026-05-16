#!/usr/bin/env python3
"""Generate an Easy Demon .gmd level file for Geometry Dash."""

from gmdkit import Level, Object
from gmdkit.mappings import obj_prop
import os, shutil

SPIKE = 8
BLOCK = 1
SHIP_PORTAL = 13
CUBE_PORTAL = 12
YELLOW_PAD = 35
YELLOW_ORB = 36
SPEED_2X = 201
SPEED_3X = 202

GRID = 30
GROUND_Y = 15  # GD ground level (center of first block row)

def obj(obj_id, x, y):
    o = Object.default(obj_id)
    o[obj_prop.X] = x * GRID + 15
    o[obj_prop.Y] = (y - 1) * GRID + GROUND_Y  # y=1 means on ground
    return o

def generate_level():
    objects = []
    x = 0

    def spike(xp, yp=1):
        objects.append(obj(SPIKE, xp, yp))

    def block(xp, yp=1):
        objects.append(obj(BLOCK, xp, yp))

    def portal(pid, xp):
        objects.append(obj(pid, xp, 7))

    def pad(xp):
        objects.append(obj(YELLOW_PAD, xp, 1))

    def orb(xp, yp=5):
        objects.append(obj(YELLOW_ORB, xp, yp))

    # 2x speed (not too fast)
    objects.append(obj(SPEED_2X, 3, 7))

    # === SECTION 1: Cube - easy intro ===
    x = 10

    # Single spikes, generous spacing
    spike(x); x += 6
    spike(x); x += 6
    spike(x); x += 6

    # Double spikes
    spike(x); spike(x+1); x += 7
    spike(x); spike(x+1); x += 7

    # Block + spike on top
    block(x); block(x, 2); spike(x+1, 3); x += 7
    spike(x); spike(x+1); x += 7

    # Triple spike (the demon moment)
    spike(x); spike(x+1); spike(x+2); x += 8

    # More blocks and spikes
    block(x); spike(x+1, 2); x += 6
    spike(x); spike(x+1); x += 7
    block(x); block(x, 2); spike(x+1, 3); x += 7
    spike(x); spike(x+1); spike(x+2); x += 8

    # Pad section
    pad(x); spike(x+3); spike(x+4); x += 8
    spike(x); spike(x+1); x += 7
    pad(x); spike(x+3); spike(x+4); spike(x+5); x += 9

    # === SECTION 2: Ship - wide corridors ===
    portal(SHIP_PORTAL, x); x += 7

    # Very open to start
    block(x, 1); block(x, 2); x += 9
    block(x, 8); block(x, 9); x += 9

    # Slightly tighter
    block(x, 1); block(x, 2); spike(x, 3); x += 7
    block(x, 8); block(x, 9); spike(x, 7); x += 7
    block(x, 1); block(x, 2); x += 7
    block(x, 7); block(x, 8); block(x, 9); x += 7

    # Zigzag (still wide gaps)
    block(x, 1); block(x, 2); block(x, 3); x += 7
    block(x, 7); block(x, 8); block(x, 9); x += 7
    block(x, 1); block(x, 2); block(x, 3); x += 7
    block(x, 7); block(x, 8); block(x, 9); x += 8

    # === SECTION 3: Cube - medium difficulty ===
    portal(CUBE_PORTAL, x); x += 7

    # Orb timing (forgiving)
    spike(x); spike(x+1); orb(x+3, 5); spike(x+5); spike(x+6); x += 10
    spike(x); spike(x+1); x += 7

    # Triple spikes with breathing room
    spike(x); spike(x+1); spike(x+2); x += 8
    block(x); block(x, 2); spike(x+1, 3); x += 7
    spike(x); spike(x+1); spike(x+2); x += 8

    # Staircase
    block(x); x += 2
    block(x); block(x, 2); x += 2
    block(x); block(x, 2); block(x, 3); spike(x+1, 4); x += 7
    spike(x); spike(x+1); x += 7

    # Pad combo
    pad(x); spike(x+3); spike(x+4); x += 8
    pad(x); spike(x+3); spike(x+4); spike(x+5); x += 9
    spike(x); spike(x+1); spike(x+2); x += 8

    # === SECTION 4: Ship - slightly harder ===
    portal(SHIP_PORTAL, x); x += 7

    # Alternating walls
    block(x, 1); block(x, 2); block(x, 3); x += 6
    block(x, 7); block(x, 8); block(x, 9); x += 6
    block(x, 1); block(x, 2); block(x, 3); spike(x, 4); x += 6
    block(x, 7); block(x, 8); block(x, 9); spike(x, 6); x += 6
    block(x, 1); block(x, 2); block(x, 3); x += 6
    block(x, 7); block(x, 8); block(x, 9); x += 6

    # One tight gap
    block(x, 1); block(x, 2); block(x, 3); block(x, 7); block(x, 8); block(x, 9); x += 8

    # === SECTION 5: Final cube ===
    portal(CUBE_PORTAL, x)
    objects.append(obj(SPEED_3X, x, 7))  # speed up a bit
    x += 7

    # Triple spikes
    spike(x); spike(x+1); spike(x+2); x += 7
    spike(x); spike(x+1); x += 6
    block(x); block(x, 2); spike(x+1, 3); x += 7
    spike(x); spike(x+1); spike(x+2); x += 7

    # Orb + spikes
    spike(x); orb(x+2, 5); spike(x+4); spike(x+5); x += 9

    # Ending - triple spikes with good spacing
    spike(x); spike(x+1); spike(x+2); x += 7
    spike(x); spike(x+1); spike(x+2); x += 7
    spike(x); spike(x+1); spike(x+2); x += 9

    # End wall
    for h in range(1, 8):
        block(x, h)

    return objects

def main():
    print("Generating VOID REAPER (Easy Demon)...")
    objects = generate_level()
    print(f"  {len(objects)} objects")

    level = Level.default('VOID REAPER')
    level['k3'] = 'Easy demon by skibidi-things. Cube-ship-cube-ship-cube.'

    for o in objects:
        level.objects.append(o)

    out_path = "VOID_REAPER.gmd"
    level.to_file(out_path)
    shutil.copy(out_path, os.path.expanduser("~/Desktop/VOID_REAPER.gmd"))
    print(f"  Saved to Desktop!")

if __name__ == '__main__':
    main()
