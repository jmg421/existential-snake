#!/usr/bin/env python3
"""Generate a well-decorated, fun Easy Demon .gmd level for Geometry Dash."""

from gmdkit import Level, Object
from gmdkit.mappings import obj_prop
import os, shutil, random

GRID = 30
GROUND_Y = 15

# Gameplay objects
SPIKE = 8
BLOCK = 1
SHIP_PORTAL = 13
CUBE_PORTAL = 12
YELLOW_PAD = 35
YELLOW_ORB = 36
SPEED_2X = 201
SPEED_3X = 202

# Decoration objects
GLOW_HALF = 504        # half glow slab
GLOW_SQUARE = 502      # glow square
GLOW_SLOPE = 506       # glow slope
DECO_CIRCLE_SM = 725   # small glow circle
DECO_CIRCLE_LG = 726   # large glow circle
OUTLINE_BLOCK = 80     # outline block (transparent)
DECO_LINE_H = 579      # horizontal line
DECO_LINE_V = 580      # vertical line
DECO_DOT = 1888        # small dot
GROUND_SPIKE_SM = 39   # small ground spike (deco)
PILLAR_THIN = 194      # thin pillar
CHAIN = 584            # chain
BG_SQUARE = 467        # background square
LIGHT_PILLAR = 503     # light pillar
PULSE_RING = 1764      # pulse ring
STAR_DECO = 1329       # star decoration
ARROW_DECO = 1711      # arrow deco
CLOUD = 257            # cloud/smoke

def obj(obj_id, x, y, scale=1.0, rotation=0, z_order=0, flip_x=False, flip_y=False):
    o = Object.default(obj_id)
    o[obj_prop.X] = int(x * GRID + 15)
    o[obj_prop.Y] = int((y - 1) * GRID + GROUND_Y)
    if scale != 1.0:
        o[obj_prop.SCALE_X] = scale
        o[obj_prop.SCALE_Y] = scale
    if rotation:
        o[obj_prop.ROTATION] = rotation
    if z_order:
        o[obj_prop.Z_ORDER] = z_order
    if flip_x:
        o[obj_prop.FLIP_X] = True
    if flip_y:
        o[obj_prop.FLIP_Y] = True
    return o

def generate_level():
    objects = []
    x = 0

    def spike(xp, yp=1):
        objects.append(obj(SPIKE, xp, yp))

    def block(xp, yp=1):
        objects.append(obj(BLOCK, xp, yp))

    def portal(pid, xp):
        objects.append(obj(pid, xp, 1))

    def pad(xp):
        objects.append(obj(YELLOW_PAD, xp, 1))

    def orb(xp, yp=5):
        objects.append(obj(YELLOW_ORB, xp, yp))

    # === DECORATIONS ===
    def add_decorations(level_length):
        """Add layered decorations across the whole level."""
        # Background glow pillars (far back)
        for dx in range(0, level_length, 12):
            objects.append(obj(LIGHT_PILLAR, dx, 5, scale=2.0, z_order=-5))
            objects.append(obj(LIGHT_PILLAR, dx+6, 3, scale=1.5, z_order=-5, flip_x=True))

        # Mid-layer floating squares
        for dx in range(5, level_length, 18):
            objects.append(obj(BG_SQUARE, dx, 8, scale=0.8, rotation=45, z_order=-4))
            objects.append(obj(BG_SQUARE, dx+9, 6, scale=0.6, rotation=30, z_order=-4))

        # Glow circles (atmosphere)
        for dx in range(3, level_length, 10):
            objects.append(obj(DECO_CIRCLE_LG, dx, 7, scale=1.8, z_order=-3))
            objects.append(obj(DECO_CIRCLE_SM, dx+5, 9, scale=1.2, z_order=-3))

        # Ground detail - small spikes and lines
        for dx in range(0, level_length, 6):
            objects.append(obj(GROUND_SPIKE_SM, dx, 0, scale=0.5, z_order=-1))
            objects.append(obj(DECO_LINE_H, dx+3, 0, scale=0.8, z_order=-1))

        # Chains hanging from top
        for dx in range(8, level_length, 22):
            objects.append(obj(CHAIN, dx, 11, z_order=-2))
            objects.append(obj(CHAIN, dx+11, 12, scale=0.8, z_order=-2))

        # Pulse rings near gameplay objects
        for dx in range(15, level_length, 25):
            objects.append(obj(PULSE_RING, dx, 4, scale=1.5, z_order=-2))

        # Stars scattered
        for dx in range(7, level_length, 16):
            objects.append(obj(STAR_DECO, dx, 10, scale=0.6, z_order=-4))
            objects.append(obj(STAR_DECO, dx+8, 11, scale=0.4, z_order=-4))

        # Outline blocks as ground platforms (visual only, behind gameplay)
        for dx in range(0, level_length, 4):
            objects.append(obj(OUTLINE_BLOCK, dx, 0, z_order=-1))

    # === GAMEPLAY ===
    # 2x speed
    objects.append(obj(SPEED_2X, 3, 7))

    # --- Section 1: Cube intro ---
    x = 10
    spike(x); x += 6
    spike(x); x += 6
    spike(x); spike(x+1); x += 7

    block(x); block(x+1); x += 4
    spike(x); x += 5
    block(x); block(x, 2); x += 4
    spike(x); spike(x+1); x += 7

    # Staircase
    block(x); x += 2
    block(x); block(x, 2); x += 2
    block(x); block(x, 2); block(x, 3); x += 3
    spike(x); x += 6

    # Triple spike!
    spike(x); spike(x+1); spike(x+2); x += 8

    # Pad launch
    pad(x); spike(x+4); spike(x+5); x += 8
    spike(x); spike(x+1); x += 7
    spike(x); spike(x+1); spike(x+2); x += 8

    # Orb
    spike(x); orb(x+2, 5); spike(x+5); x += 8
    spike(x); spike(x+1); x += 8

    # --- Section 2: Ship ---
    portal(SHIP_PORTAL, x); x += 7
    block(x, 1); block(x, 2); x += 9
    block(x, 8); block(x, 9); x += 9
    block(x, 1); block(x, 2); spike(x, 3); x += 7
    block(x, 8); block(x, 9); spike(x, 7); x += 7
    block(x, 2); block(x, 3); x += 7
    block(x, 7); block(x, 8); x += 7
    block(x, 1); block(x, 2); block(x, 3); x += 7
    block(x, 7); block(x, 8); block(x, 9); x += 8

    # --- Section 3: Cube with pads ---
    portal(CUBE_PORTAL, x); x += 7
    pad(x); spike(x+4); x += 7
    spike(x); spike(x+1); x += 6
    pad(x); spike(x+4); spike(x+5); x += 8

    # Platforms
    block(x); block(x+1); spike(x+2, 2); x += 6
    block(x); block(x, 2); block(x+1, 2); spike(x+2, 3); x += 6
    spike(x); spike(x+1); x += 7

    # Orb chain
    spike(x); orb(x+2, 4); spike(x+4); orb(x+6, 5); spike(x+8); x += 11

    # Triples
    spike(x); spike(x+1); spike(x+2); x += 7
    block(x); block(x, 2); spike(x+1, 3); x += 6
    spike(x); spike(x+1); spike(x+2); x += 8

    # Speed burst
    objects.append(obj(SPEED_3X, x, 7)); x += 3
    spike(x); x += 5
    spike(x); spike(x+1); x += 6
    spike(x); spike(x+1); spike(x+2); x += 7
    objects.append(obj(SPEED_2X, x, 7)); x += 5

    # --- Section 4: Ship finale ---
    portal(SHIP_PORTAL, x); x += 7
    block(x, 1); block(x, 2); block(x, 3); x += 6
    block(x, 7); block(x, 8); block(x, 9); x += 6
    block(x, 2); block(x, 3); block(x, 4); x += 6
    block(x, 6); block(x, 7); block(x, 8); x += 6
    block(x, 1); block(x, 2); block(x, 3); block(x, 7); block(x, 8); block(x, 9); x += 7
    block(x, 1); block(x, 2); x += 7
    block(x, 8); block(x, 9); x += 8

    # --- Section 5: Final cube ---
    portal(CUBE_PORTAL, x); x += 7
    spike(x); spike(x+1); x += 6
    block(x); spike(x+1, 2); x += 5
    spike(x); spike(x+1); spike(x+2); x += 7
    pad(x); spike(x+4); spike(x+5); x += 8
    spike(x); spike(x+1); spike(x+2); x += 7
    spike(x); spike(x+1); spike(x+2); x += 9

    # End wall
    for h in range(1, 8):
        block(x, h)

    level_length = x + 5

    # Add all decorations
    add_decorations(level_length)

    return objects

def main():
    print("Generating VOID REAPER (Decorated Easy Demon)...")
    objects = generate_level()
    print(f"  {len(objects)} objects")

    level = Level.default('VOID REAPER')
    level['k3'] = 'Easy demon by skibidi-things. GL and HF!'
    level['k8'] = 8  # Cycles

    for o in objects:
        level.objects.append(o)

    out_path = "VOID_REAPER.gmd"
    level.to_file(out_path)
    shutil.copy(out_path, os.path.expanduser("~/Desktop/VOID_REAPER.gmd"))
    print("  Saved to Desktop!")

if __name__ == '__main__':
    main()
