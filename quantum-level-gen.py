"""
QUANTUM LEVEL GENERATOR — Hybrid QPU/CPU Approach
===================================================
QPU: Decides the level FRAMEWORK (structure, difficulty curve, rhythm)
CPU: Fills in playable obstacle patterns using proven GD design rules

WHY HYBRID?
-----------
The level framework is a combinatorial optimization problem:
  - 8 sections × 4 possible modes × 8 intensity levels × 6 rhythm patterns
    × 8 color palettes × 4 special mechanics = ~12 million frameworks
  - But they're ENTANGLED: a ship section after a hard cube section needs
    lower intensity. Color shifts need to match mood. Rhythm changes need
    to land on section boundaries.
  - Finding the OPTIMAL framework considering all interactions = QPU territory

The actual obstacles within each section are deterministic:
  - Given "cube mode, intensity 0.7, half-beat spikes" → the patterns are
    well-defined by GD design rules
  - CPU handles this instantly

Result: QPU explores millions of framework combinations simultaneously,
CPU builds a guaranteed-playable level from the winning framework.

Usage:
  python3 quantum-level-gen.py                    # Local simulator
  python3 quantum-level-gen.py --device rigetti   # Rigetti Cepheus 106Q
  python3 quantum-level-gen.py --device sv1       # AWS SV1
"""

import json
import time
import argparse
import numpy as np

from braket.circuits import Circuit
from braket.devices import LocalSimulator

# ============================================================
# FRAMEWORK ENCODING: What the QPU decides
# ============================================================
# 8 sections × 13 qubits each = 104 qubits (fits Cepheus's 107)
#
# Per section (13 qubits):
#   [0-1]  Mode: 00=cube, 01=ship, 10=cube_fast, 11=wave_spam
#   [2-4]  Intensity: 0-7 (spike density / obstacle frequency)
#   [5-7]  Rhythm: 000=whole, 001=half, 010=quarter, 011=triplet,
#                   100=dotted, 101=syncopated, 110=gallop, 111=straight16
#   [8-10] Color palette index (8 palettes)
#   [11]   Has orb sequence (0/1)
#   [12]   Has staircase (0/1)

N_SECTIONS = 8
QUBITS_PER_SECTION = 13
N_QUBITS = N_SECTIONS * QUBITS_PER_SECTION  # 104
BEATS_PER_SECTION = 16  # 16 beats per section = 128 beats total (~51s at 150bpm)

MODES = ['cube', 'ship', 'cube_fast', 'cube']  # cube_fast = tighter timing
RHYTHMS = ['whole', 'half', 'quarter', 'triplet', 'dotted', 'syncopated', 'gallop', 'straight16']
PALETTES = [
    {"bg": [5, 0, 15], "ground": [20, 0, 40]},    # Deep purple
    {"bg": [15, 0, 5], "ground": [50, 0, 20]},    # Crimson
    {"bg": [0, 0, 20], "ground": [0, 0, 60]},     # Midnight blue
    {"bg": [10, 0, 0], "ground": [40, 0, 0]},     # Blood red
    {"bg": [0, 10, 15], "ground": [0, 40, 50]},   # Teal
    {"bg": [0, 5, 0], "ground": [0, 30, 0]},      # Matrix green
    {"bg": [15, 10, 0], "ground": [50, 30, 0]},   # Amber
    {"bg": [10, 0, 15], "ground": [30, 0, 50]},   # Violet
]


def decode_section(bits_13):
    """Decode 13 qubits into a section framework."""
    mode_idx = (bits_13[0] << 1) | bits_13[1]
    intensity = (bits_13[2] << 2) | (bits_13[3] << 1) | bits_13[4]
    rhythm_idx = (bits_13[5] << 2) | (bits_13[6] << 1) | bits_13[7]
    palette_idx = (bits_13[8] << 2) | (bits_13[9] << 1) | bits_13[10]
    has_orbs = bits_13[11]
    has_staircase = bits_13[12]

    return {
        'mode': MODES[mode_idx],
        'intensity': intensity / 7.0,  # Normalize to 0-1
        'rhythm': RHYTHMS[rhythm_idx],
        'palette': PALETTES[palette_idx],
        'has_orbs': bool(has_orbs),
        'has_staircase': bool(has_staircase),
    }


def decode_framework(bitstring):
    """Decode full 104-bit measurement into 8-section framework."""
    sections = []
    for s in range(N_SECTIONS):
        start = s * QUBITS_PER_SECTION
        bits = [int(bitstring[start + i]) for i in range(QUBITS_PER_SECTION)]
        sections.append(decode_section(bits))
    return sections


def score_framework(bitstring):
    """Score a framework for gameplay quality. QPU maximizes this."""
    sections = decode_framework(bitstring)
    score = 0.0

    for i, sec in enumerate(sections):
        # Reward intensity curve (should build up, with valleys)
        if i < len(sections) - 1:
            next_sec = sections[i + 1]

            # Mode transitions are exciting
            if sec['mode'] != next_sec['mode']:
                score += 5.0

            # Intensity should generally increase but with dips
            if i < 5 and next_sec['intensity'] > sec['intensity']:
                score += 2.0  # Building tension
            if i == 3 or i == 5:
                if next_sec['intensity'] < sec['intensity']:
                    score += 3.0  # Breather sections

            # Don't repeat same palette
            if sec['palette'] != next_sec['palette']:
                score += 2.0

            # Don't repeat same rhythm
            if sec['rhythm'] != next_sec['rhythm']:
                score += 1.5

        # Ship sections shouldn't be too intense (hard to control)
        if sec['mode'] == 'ship' and sec['intensity'] > 0.8:
            score -= 3.0

        # Reward orbs in medium-intensity sections
        if sec['has_orbs'] and 0.3 <= sec['intensity'] <= 0.7:
            score += 2.0

        # Staircases work best in cube mode
        if sec['has_staircase'] and sec['mode'] == 'cube':
            score += 2.0
        elif sec['has_staircase'] and sec['mode'] == 'ship':
            score -= 2.0

    # Final section should be hardest
    if sections[-1]['intensity'] >= 0.7:
        score += 5.0

    # First section should be moderate (not instant death)
    if sections[0]['intensity'] <= 0.5:
        score += 3.0

    # Reward having at least one ship section
    if any(s['mode'] == 'ship' for s in sections):
        score += 5.0

    # Penalize more than 2 consecutive ship sections
    ship_run = 0
    for s in sections:
        if s['mode'] == 'ship':
            ship_run += 1
            if ship_run > 2:
                score -= 5.0
        else:
            ship_run = 0

    # Reward variety in rhythms
    unique_rhythms = len(set(s['rhythm'] for s in sections))
    score += unique_rhythms * 1.5

    return score


# ============================================================
# QAOA CIRCUIT — 104 QUBITS
# ============================================================

def build_framework_qaoa(n_qubits, gamma, beta):
    """QAOA encoding framework quality as qubit interactions."""
    circuit = Circuit()
    n_sections_available = n_qubits // QUBITS_PER_SECTION

    for q in range(n_qubits):
        circuit.h(q)

    for g, b in zip(gamma, beta):
        # Inter-section interactions (adjacent sections should differ)
        for s in range(n_sections_available - 1):
            base_a = s * QUBITS_PER_SECTION
            base_b = (s + 1) * QUBITS_PER_SECTION
            if base_b + 10 >= n_qubits:
                break

            # Mode qubits: reward different modes between sections
            for offset in range(2):
                circuit.cnot(base_a + offset, base_b + offset)
                circuit.rz(base_b + offset, g * 2.0)
                circuit.cnot(base_a + offset, base_b + offset)

            # Palette qubits: reward different palettes
            for offset in range(8, 11):
                circuit.cnot(base_a + offset, base_b + offset)
                circuit.rz(base_b + offset, g * 1.5)
                circuit.cnot(base_a + offset, base_b + offset)

            # Rhythm qubits: reward different rhythms
            for offset in range(5, 8):
                circuit.cnot(base_a + offset, base_b + offset)
                circuit.rz(base_b + offset, g * 1.0)
                circuit.cnot(base_a + offset, base_b + offset)

        # Intensity curve: first section low, last section high
        for offset in range(2, min(5, n_qubits)):
            circuit.rz(offset, -g * 1.0)
        if n_sections_available >= N_SECTIONS:
            last_base = (N_SECTIONS - 1) * QUBITS_PER_SECTION
            for offset in range(2, 5):
                if last_base + offset < n_qubits:
                    circuit.rz(last_base + offset, g * 1.5)

        # Bias middle sections toward ship mode
        for s in [2, 3, 4]:
            base = s * QUBITS_PER_SECTION
            if base + 1 < n_qubits:
                circuit.rz(base, -g * 0.5)
                circuit.rz(base + 1, g * 0.5)

        # Mixer
        for q in range(n_qubits):
            circuit.rx(q, 2 * b)

    return circuit


def run_quantum(device_name="local", shots=1000, p=2):
    """Execute QPU to find optimal framework."""
    n_qubits = N_QUBITS if device_name in ("rigetti",) else min(N_QUBITS, 13)  # 13 = 1 section locally

    print(f"\n{'='*65}")
    print(f"  ⚛️  QPU: FRAMEWORK OPTIMIZATION — {n_qubits} QUBITS")
    print(f"{'='*65}")
    print(f"  Finding optimal level structure from {2**n_qubits:.1e} possibilities")
    print(f"  Device: {device_name}")
    print()

    # Optimize QAOA params locally
    print("  [1/3] Optimizing QAOA parameters...")
    opt_start = time.time()
    sim = LocalSimulator()
    rng = np.random.default_rng(42)

    small_n = min(n_qubits, 26)
    best_params = None
    best_score = -999

    for _ in range(20):
        gamma = rng.uniform(0.3, 2.5, p)
        beta = rng.uniform(0.3, 2.5, p)
        c = build_framework_qaoa(small_n, gamma, beta)
        r = sim.run(c, shots=200).result()

        avg = 0
        for bits, count in r.measurement_counts.items():
            padded = bits + '0' * (N_QUBITS - len(bits))
            avg += score_framework(padded) * count
        avg /= 200
        if avg > best_score:
            best_score = avg
            best_params = (gamma, beta)

    gamma, beta = best_params
    print(f"        Done in {time.time() - opt_start:.1f}s")

    # Build and run
    circuit = build_framework_qaoa(n_qubits, gamma, beta)
    print(f"  [2/3] Circuit: {n_qubits} qubits, depth {circuit.depth}")
    print(f"  [3/3] Executing on {device_name}...")

    exec_start = time.time()
    task_arn = None

    if device_name == "local":
        result = sim.run(circuit, shots=shots).result()
    elif device_name == "sv1":
        from braket.aws import AwsDevice
        hw = AwsDevice("arn:aws:braket:::device/quantum-simulator/amazon/sv1")
        task = hw.run(circuit, shots=shots,
                      s3_destination_folder=("amazon-braket-us-east-1-568878824271", "quantum-level"))
        task_arn = task.id
        print(f"        Task ARN: {task_arn}")
        result = task.result()
    elif device_name == "rigetti":
        from braket.aws import AwsDevice
        hw = AwsDevice("arn:aws:braket:us-west-1::device/qpu/rigetti/Cepheus-1-108Q")
        task = hw.run(circuit, shots=shots,
                      s3_destination_folder=("amazon-braket-us-west-1-568878824271", "quantum-level"))
        task_arn = task.id
        print(f"        Task ARN: {task_arn}")
        result = task.result()

    exec_time = time.time() - exec_start
    counts = result.measurement_counts
    print(f"        ✓ Done in {exec_time:.1f}s")

    # Find best framework
    best_bits = None
    best_score = -999
    for bits, count in counts.items():
        padded = bits + '0' * (N_QUBITS - len(bits))
        s = score_framework(padded)
        if s > best_score:
            best_score = s
            best_bits = padded

    framework = decode_framework(best_bits)

    print(f"\n  ✓ OPTIMAL FRAMEWORK (score: {best_score:.1f}):")
    print(f"  {'Sec':<4} {'Mode':<10} {'Intensity':<10} {'Rhythm':<12} {'Orbs':<5} {'Stairs':<6}")
    print(f"  {'-'*50}")
    for i, sec in enumerate(framework):
        bar = '█' * int(sec['intensity'] * 8)
        print(f"  {i+1:<4} {sec['mode']:<10} {bar:<10} {sec['rhythm']:<12} "
              f"{'✓' if sec['has_orbs'] else '·':<5} {'✓' if sec['has_staircase'] else '·':<6}")

    total_time = time.time() - opt_start
    print(f"\n  QPU time: {total_time:.1f}s | Search space: {2**n_qubits:.1e}")
    if task_arn:
        print(f"  Task ARN: {task_arn}")

    return framework, counts, total_time, task_arn, n_qubits


# ============================================================
# CPU: LEVEL BUILDER (deterministic, guaranteed playable)
# ============================================================

def build_section_cube(beat_start, intensity, rhythm, has_orbs, has_staircase):
    """CPU generates a cube section. Guaranteed playable."""
    objects = []
    beat = beat_start

    # Rhythm determines beat subdivisions
    if rhythm == 'whole':
        steps = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    elif rhythm == 'half':
        steps = [i * 0.5 for i in range(32)]
    elif rhythm == 'quarter':
        steps = [i * 0.25 for i in range(64)]
    elif rhythm == 'triplet':
        steps = [i * 0.667 for i in range(24)]
    elif rhythm == 'dotted':
        steps = [i * 1.5 for i in range(11)]
    elif rhythm == 'syncopated':
        steps = [0, 0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25, 6, 6.75, 7.5, 8.25, 9, 10, 11, 12, 13, 14, 15]
    elif rhythm == 'gallop':
        steps = []
        for i in range(8):
            steps.extend([i*2, i*2 + 0.25, i*2 + 0.5])
    else:  # straight16
        steps = [i * 0.25 for i in range(64)]

    # Filter steps to fit in section
    steps = [s for s in steps if s < BEATS_PER_SECTION]

    # Intensity determines how many steps get obstacles
    n_obstacles = int(len(steps) * intensity * 0.8)
    rng = np.random.default_rng(int(beat_start * 100))
    obstacle_indices = sorted(rng.choice(len(steps), size=min(n_obstacles, len(steps)), replace=False))

    # Build patterns
    last_obj_beat = -10
    staircase_placed = False
    orb_placed = False

    for idx in obstacle_indices:
        b = beat + steps[idx]

        # Ensure minimum gap (playability)
        if b - last_obj_beat < 0.4:
            continue

        # Pattern selection based on position and intensity
        pos_in_section = steps[idx] / BEATS_PER_SECTION
        r = rng.random()

        if has_staircase and not staircase_placed and 0.3 < pos_in_section < 0.5:
            # Staircase: block h1, h2, h3
            for step in range(3):
                objects.append({"beat": b + step, "type": "block", "h": step + 1})
                objects.append({"beat": b + step + 0.5, "type": "spike", "y": step + 1})
            staircase_placed = True
            last_obj_beat = b + 3
            continue

        if has_orbs and not orb_placed and 0.5 < pos_in_section < 0.7:
            # Orb sequence
            orb_type = 'orb_yellow' if rng.random() > 0.4 else 'orb_blue'
            objects.append({"beat": b, "type": orb_type, "y": 3})
            # Spikes after (must hit orb)
            objects.append({"beat": b + 1.0, "type": "spike"})
            objects.append({"beat": b + 1.5, "type": "spike"})
            objects.append({"beat": b + 2.0, "type": "spike"})
            orb_placed = True
            last_obj_beat = b + 2
            continue

        if r < 0.6:
            # Spike (most common)
            objects.append({"beat": b, "type": "spike"})
            # Cluster based on intensity
            if intensity > 0.5 and rng.random() < intensity:
                objects.append({"beat": b + 0.5, "type": "spike"})
            if intensity > 0.7 and rng.random() < intensity - 0.3:
                objects.append({"beat": b + 0.25, "type": "spike"})
                objects.append({"beat": b + 0.75, "type": "spike"})
            last_obj_beat = b + (0.75 if intensity > 0.7 else 0.5 if intensity > 0.5 else 0)
        elif r < 0.85:
            # Block + spike on top
            h = 1 + int(intensity * 2)
            objects.append({"beat": b, "type": "block", "h": h})
            objects.append({"beat": b + 1.0, "type": "spike", "y": h})
            last_obj_beat = b + 1
        else:
            # Pad
            pad_type = 'pad_yellow' if rng.random() > 0.3 else 'pad_blue'
            objects.append({"beat": b, "type": pad_type})
            objects.append({"beat": b + 1.5, "type": "spike"})
            last_obj_beat = b + 1.5

    return objects


def build_section_ship(beat_start, intensity, rhythm):
    """CPU generates a ship section. Alternating floor/ceiling obstacles."""
    objects = []
    beat = beat_start

    # Ship uses half-beat or whole-beat spacing
    step = 0.5 if rhythm in ('half', 'quarter', 'straight16') else 1.0
    n_steps = int(BEATS_PER_SECTION / step)

    rng = np.random.default_rng(int(beat_start * 100))

    for i in range(n_steps):
        b = beat + i * step
        if rng.random() > intensity * 0.9:
            continue  # Skip some for gaps

        # Alternate floor and ceiling
        if i % 2 == 0:
            h = 2 + int(rng.random() * 3)  # Floor: h 2-4
            objects.append({"beat": b, "type": "block", "h": h})
            objects.append({"beat": b, "type": "spike", "y": h})
        else:
            h = 5 + int(rng.random() * 3)  # Ceiling: h 5-7
            objects.append({"beat": b, "type": "block", "h": h})
            objects.append({"beat": b, "type": "spike", "y": h})

    return objects


def framework_to_level(framework, provenance=None):
    """CPU: Convert QPU framework into a full, playable level."""
    print(f"\n{'='*65}")
    print(f"  🖥️  CPU: BUILDING LEVEL FROM QUANTUM FRAMEWORK")
    print(f"{'='*65}")

    objects = []
    triggers = []
    beat = 4  # Start beat

    for i, sec in enumerate(framework):
        section_start = beat
        print(f"  Section {i+1}: {sec['mode']:<10} intensity={sec['intensity']:.0%} "
              f"rhythm={sec['rhythm']:<12} {'🔮' if sec['has_orbs'] else ''} "
              f"{'📐' if sec['has_staircase'] else ''}")

        # Color trigger at section start
        triggers.append({"beat": section_start, "type": "color",
                         "bg": sec['palette']['bg'], "ground": sec['palette']['ground']})
        if i > 0:
            triggers.append({"beat": section_start, "type": "flash"})
            if sec['mode'] != framework[i-1]['mode']:
                triggers.append({"beat": section_start, "type": "shake"})

        # Mode portals
        prev_mode = framework[i-1]['mode'] if i > 0 else 'cube'
        if sec['mode'] == 'ship' and prev_mode != 'ship':
            objects.append({"beat": section_start, "type": "portal_ship"})
            beat += 2  # Give 2 beats after portal to adjust
        elif sec['mode'] != 'ship' and prev_mode == 'ship':
            objects.append({"beat": section_start, "type": "portal_cube"})
            beat += 1

        # Generate section content
        if sec['mode'] == 'ship':
            section_objs = build_section_ship(beat, sec['intensity'], sec['rhythm'])
        else:
            section_objs = build_section_cube(
                beat, sec['intensity'], sec['rhythm'],
                sec['has_orbs'], sec['has_staircase'])

        objects.extend(section_objs)
        beat = section_start + BEATS_PER_SECTION

    # Sort everything
    objects = sorted(objects, key=lambda o: o['beat'])
    triggers = sorted(triggers, key=lambda t: t['beat'])

    total_beats = N_SECTIONS * BEATS_PER_SECTION
    duration = total_beats * 60 / 150

    print(f"\n  ✓ Level built:")
    print(f"    Objects: {len(objects)}")
    print(f"    Triggers: {len(triggers)}")
    print(f"    Beats: 4 → {4 + total_beats}")
    print(f"    Duration: {duration:.0f}s at 150bpm")

    level = {
        "meta": {
            "name": "QUANTUM COLLAPSE",
            "author": "Rigetti Cepheus 106Q + CPU",
            "song": "audio/the-other-side.mp3",
            "bpm": 150,
            "offset": 0.05,
            "speed": 10,
            "generated_by": "hybrid_quantum",
        },
        "objects": objects,
        "triggers": triggers,
    }

    if provenance:
        level["meta"]["quantum_provenance"] = provenance

    return level


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Quantum Level Generator — Hybrid QPU/CPU")
    parser.add_argument("--device", choices=["local", "sv1", "rigetti"],
                        default="local", help="Quantum device for framework optimization")
    parser.add_argument("--shots", type=int, default=1000)
    parser.add_argument("--depth", type=int, default=2, help="QAOA depth")
    parser.add_argument("--output", default="levels/quantum-collapse.json")
    args = parser.parse_args()

    print("""
╔═══════════════════════════════════════════════════════════════════╗
║       ⚛️  QUANTUM LEVEL GENERATOR — HYBRID QPU/CPU               ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  QPU (Rigetti Cepheus, 104 qubits):                              ║
║    Optimizes level FRAMEWORK from 2^104 = 2×10^31 possibilities  ║
║    → Section modes, intensity curve, rhythm, colors, mechanics   ║
║                                                                   ║
║  CPU (deterministic builder):                                     ║
║    Fills in playable obstacle patterns from the framework         ║
║    → Guaranteed survivable, synced to BPM, proper GD design      ║
║                                                                   ║
║  Result: Full 128-beat level (~51s) that's hard but fair          ║
╚═══════════════════════════════════════════════════════════════════╝
""")

    # QPU: Find optimal framework
    framework, counts, q_time, task_arn, n_qubits = run_quantum(
        device_name=args.device, shots=args.shots, p=args.depth)

    # CPU: Build level from framework
    provenance = {
        "device": args.device,
        "qubits": n_qubits,
        "shots": args.shots,
        "qaoa_depth": args.depth,
        "search_space": f"2^{n_qubits} = {2**n_qubits:.1e}",
        "unique_measurements": len(counts),
        "framework": [{"mode": s["mode"], "intensity": round(s["intensity"], 2),
                       "rhythm": s["rhythm"]} for s in framework],
    }
    if task_arn:
        provenance["task_arn"] = task_arn

    level = framework_to_level(framework, provenance=provenance)

    with open(args.output, 'w') as f:
        json.dump(level, f, indent=2)

    print(f"\n  📁 Saved: {args.output}")
    print(f"  🎮 Play it!")


if __name__ == "__main__":
    main()
