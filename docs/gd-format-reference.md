# Geometry Dash Level Format Reference
Source: https://github.com/Wyliemaster/gddocs

## Level String Encoding/Decoding

Levels are stored as compressed binary: Base64 encoding over ZLIB/gzip compression.

**Decoding steps:**
1. Base64 URL-safe decode the string
2. Decompress with zlib (window_bits = 15 | 32 to autodetect gzip)
3. Result is a plaintext level string

For official levels stored in `LevelData.plist`, prepend `H4sIAAAAAAAAA` before decoding.

```python
import base64, zlib
def decode_level(level_data, is_official=False):
    if is_official:
        level_data = 'H4sIAAAAAAAAA' + level_data
    decoded = base64.urlsafe_b64decode(level_data.encode())
    return zlib.decompress(decoded, 15 | 32).decode()
```

---

## Level Start String

The decoded level string format: `{level_start};{object};{object};...`

The first entry before the first `;` is the level start object. Format: `key,value,key,value,...`

### Level Start Object Keys

| Key | Name | Type | Description |
|:-----|:-----------------------|:------|:-------|
| kA1 | AudioTrack | int | Official song ID |
| kA2 | Gamemode | int | Starting gamemode (see enums) |
| kA3 | Mini Mode | bool | Start as mini |
| kA4 | Speed | int | Starting speed (see enums) |
| kA6 | Background Texture ID | int | BG texture index |
| kA7 | Ground Texture ID | int | Ground texture index |
| kA8 | Dual Mode | bool | Start in dual mode |
| kA9 | Level/Start Pos | bool | true = Start Pos object, false = Level Start |
| kA11 | Flip Gravity | bool | Start with flipped gravity |
| kA13 | Song Offset | float | Song offset in seconds |
| kA14 | Guidelines | string | Editor guidelines (see guideline string) |
| kA15 | Fade In | bool | Song fade in |
| kA16 | Fade Out | bool | Song fade out |
| kA17 | Ground Line | int | Ground line texture ID |
| kA18 | Font | int | Font ID |
| kA20 | Reverse Gameplay | bool | Start reversed |
| kA22 | Platformer Mode | bool | 0=Classic, 1=Platformer |
| kA25 | Middleground Texture ID | int | MG texture index |
| kA28 | Mirror Mode | bool | Start mirrored |
| kA29 | Rotate Gameplay | bool | Start rotated |
| kS38 | Colors | string | Color string (see color format below) |

---

## Object String Format

Objects are separated by `;`. Each object: `key,value,key,value,...`

Every object has at minimum keys 1 (ID), 2 (X), 3 (Y).

Example: `1,1,2,15,3,15,21,3,24,7` = Block ID 1 at (15,15), main color channel 3, Z layer 7.

### Object Property Keys

| Key | Name | Type | Description |
|:----|:-----|:-----|:------------|
| 1 | Object ID | int | The object type ID |
| 2 | X Position | float | X position |
| 3 | Y Position | float | Y position |
| 4 | Flipped Horizontally | bool | |
| 5 | Flipped Vertically | bool | |
| 6 | Rotation | float | Degrees, CW positive, top=0 |
| 7 | Red | int | Red in color trigger |
| 8 | Green | int | Green in color trigger |
| 9 | Blue | int | Blue in color trigger |
| 10 | Duration | float | Trigger effect duration |
| 11 | Touch Triggered | bool | |
| 13 | Special Object Checked | bool | Checked property for portals etc |
| 17 | Blending | bool | Color trigger blending |
| 20 | Editor Layer 1 | int | |
| 21 | Main Color Channel ID | int | |
| 22 | Secondary Color Channel ID | int | |
| 23 | Target Color ID | int | Interactive object target |
| 24 | Z Layer | int | |
| 25 | Z Order | int | |
| 28 | Offset X | int | Move trigger |
| 29 | Offset Y | int | Move trigger |
| 30 | Easing | int | Easing type (see enums) |
| 31 | Text | string | Base64-encoded text |
| 32 | Scaling | float | Object scale |
| 33 | Single Group ID | int | |
| 34 | Group Parent | bool | |
| 35 | Opacity | float | Trigger opacity |
| 41 | Main Color HSV Enabled | bool | |
| 43 | Main Color HSV | HSV | `h a s a v a s_checked a v_checked` |
| 44 | Secondary Color HSV | HSV | |
| 45 | Fade In | float | Pulse trigger |
| 46 | Hold | float | Pulse trigger |
| 47 | Fade Out | float | Pulse trigger |
| 48 | Pulse Mode | int | 0=Color, 1=HSV |
| 50 | Copied Color ID | int | |
| 51 | Target Group ID | int | |
| 52 | Pulse Target Type | int | 0=Channel, 1=Group |
| 56 | Activate Group | bool | |
| 57 | Group IDs | int array | Separated by `.` |
| 58 | Lock To Player X | bool | Move trigger |
| 59 | Lock To Player Y | bool | Move trigger |
| 62 | Spawn Triggered | bool | |
| 63 | Spawn Delay | float | |
| 64 | Don't Fade | bool | |
| 67 | Don't Enter | bool | |
| 68 | Degrees | int | Rotate trigger |
| 75 | Strength | float | Shake trigger |
| 84 | Interval | float | Shake trigger |
| 85 | Easing Rate | float | |
| 87 | Multi-Trigger | bool | |
| 96 | Disable Glow | bool | |
| 97 | Custom Rotation Speed | float | Degrees/sec |
| 103 | High Detail | bool | LDM flag |
| 108 | Linked Group ID | int | |
| 128 | Scale X | float | |
| 129 | Scale Y | float | |

---

## Color System

### Color Classes

1. **BaseColor**: Static RGB + opacity + blending
2. **PlayerColor**: References player icon color + opacity + blending
3. **CopyColor**: Copies another color channel dynamically + HSV adjust + opacity + blending

Determination logic:
```javascript
if (copy_channel_id != 0) return COPY_COLOR;
if (player_color != NONE) return PLAYER_COLOR;
return BASE_COLOR;
```

### Color Channel IDs

| ID | Name | Description |
|:---|:-----|:------------|
| 1-999 | Custom | Creator-defined colors |
| 1000 | BG | Background color |
| 1001 | G1 | Primary ground color |
| 1002 | Line | Ground line color |
| 1003 | 3DL | 3D line objects color |
| 1004 | Obj | Default object color |
| 1005 | P1 | Player primary color |
| 1006 | P2 | Player secondary color |
| 1007 | LBG | Lighter version of BG |
| 1009 | G2 | Secondary ground color |
| 1010 | Black | Always (0,0,0) |
| 1011 | White | Always (255,255,255) |
| 1012 | Lighter | Lighter primary object color |
| 1013 | MG | Middleground primary |
| 1014 | MG2 | Middleground secondary |

### LBG Calculation
```javascript
function lightBG(bg, p1) {
    let hsv = RGBtoHSV(bg);
    hsv.s -= 20;
    return blendColor(p1, HSVtoRGB(hsv), hsv.v / 100);
}
```

### Color String Format (kS38)

Colors separated by `|`. Each color: `key_value_key_value_...` (underscore-separated).

| Key | Name | Type |
|:----|:-----|:-----|
| 1 | Red | int |
| 2 | Green | int |
| 3 | Blue | int |
| 4 | Player Color | int |
| 5 | Blending | bool |
| 6 | Color Channel ID | int |
| 7 | Opacity | float |
| 8 | Toggle Opacity | bool |
| 9 | Copied Color Channel ID | int |
| 10 | HSV | HSV string |
| 11 | To Red | int |
| 12 | To Green | int |
| 13 | To Blue | int |
| 15 | To Opacity | float |
| 16 | Duration | float |
| 17 | Copy Opacity | bool |

---

## Enumerations

### Gamemode
| Key | Name |
|:----|:-----|
| 0 | Cube |
| 1 | Ship |
| 2 | Ball |
| 3 | UFO |
| 4 | Wave |
| 5 | Robot |
| 6 | Spider |
| 7 | Swing |

### Speed
| Key | Name | Units/s |
|:----|:-----|:--------|
| 0 | 1x | 251.16 |
| 1 | 0.5x | 311.58 |
| 2 | 2x | 387.42 |
| 3 | 3x | 468.00 |
| 4 | 4x | 576.00 |

**Note:** Speed key 0 (labeled "1x") is actually the slowest. Key 1 ("0.5x") is faster. This is a known quirk.

### Easing Types
| Key | Name |
|:----|:-----|
| 0 | None |
| 1 | Ease In Out |
| 2 | Ease In |
| 3 | Ease Out |
| 4 | Elastic In Out |
| 5 | Elastic In |
| 6 | Elastic Out |
| 7 | Bounce In Out |
| 8 | Bounce In |
| 9 | Bounce Out |
| 10 | Exponential In Out |
| 11 | Exponential In |
| 12 | Exponential Out |
| 13 | Sine In Out |
| 14 | Sine In |
| 15 | Sine Out |
| 16 | Back In Out |
| 17 | Back In |
| 18 | Back Out |

### Pulse Mode
| 0 | Color |
| 1 | HSV |

### Pulse Target Type
| 0 | Channel |
| 1 | Group |

### Touch Toggle Mode
| 0 | None |
| 1 | Toggle On |
| 2 | Toggle Off |

### Instant Count Comparison
| 0 | Equals |
| 1 | Larger |
| 2 | Smaller |

---

## Guideline String Format

Contained in kA14. Format: `timestamp~color_value~timestamp~color_value~...`

Timestamps in seconds (float). Color values:
| Value | Color |
|:------|:------|
| 0 | Orange |
| 0.9 | Yellow |
| 1.0 | Green |

---

## Server Level Response Format

Key:value pairs separated by colons. Example:
`1:6508283:2:ReTraY:3:VGhhbmtz...:4:{levelString}:5:3:6:4993756:8:10:...`

### Server Level Keys

| Key | Name | Type |
|:----|:-----|:-----|
| 1 | levelID | int |
| 2 | levelName | string |
| 3 | description | base64 string |
| 4 | levelString | encoded level data |
| 5 | version | int |
| 6 | playerID | int |
| 8 | difficultyDenominator | int |
| 9 | difficultyNumerator | int |
| 10 | downloads | int |
| 12 | officialSong | int |
| 13 | gameVersion | int |
| 14 | likes | int |
| 15 | length | int (0=Tiny, 1=Short, 2=Medium, 3=Long, 4=XL) |
| 17 | demon | bool |
| 18 | stars | int |
| 19 | featureScore | int |
| 25 | auto | bool |
| 27 | password | XOR encrypted (key 26364) |
| 28 | uploadDate | string |
| 29 | updateDate | string |
| 30 | copiedID | int |
| 35 | customSongID | int |
| 37 | coins | int |
| 38 | verifiedCoins | bool |
| 42 | epic | int (0=none, 1=epic, 2=legendary, 3=mythic) |
| 43 | demonDifficulty | int (3=easy, 4=medium, 0=hard, 5=insane, 6=extreme) |
| 45 | objects | int (caps at 65535) |

---

## Client Level Keys (Save File)

| Key | Name | Type |
|:----|:-----|:-----|
| k1 | Level ID | int |
| k2 | Level Name | string |
| k3 | Description | base64 string |
| k4 | Inner Level String | level start + objects |
| k5 | Creator Name | string |
| k7 | Difficulty | int |
| k8 | Official Song ID | int |
| k13 | isEditable | bool |
| k18 | Attempts | int |
| k21 | levelType | int (1=Official, 2=Local, 3=Saved, 4=Online) |
| k23 | Length | int |
| k25 | isDemon | bool |
| k26 | Stars | int |
| k45 | Custom Song ID | int |
| k48 | Object Count | int |
| k67 | Capacity String | string |
| k80 | Seconds Editing | int |
| k94 | Platformer | bool |
| k95 | Verification Time | int (240 steps/sec) |

---

## Key Object IDs (Common)

These are the most commonly encountered object IDs in GD levels:

### Blocks & Decoration
- 1: Default block
- 2-7: Various basic blocks
- 8-12: Slope blocks

### Hazards
- 8, 39, 103, 392: Spikes (various sizes/orientations)
- 9, 61, 243: Saw blades

### Portals
- 10: Gravity portal (flip)
- 11: Gravity portal (normal)
- 12: Ship portal
- 13: Cube portal
- 45: Mirror portal (left)
- 46: Mirror portal (right)
- 47: Mini portal
- 48: Normal size portal
- 99: Dual portal
- 101: Single portal
- 200: Speed portal 0.5x
- 201: Speed portal 1x
- 202: Speed portal 2x
- 203: Speed portal 3x
- 1334: Speed portal 4x

### Pads & Orbs
- 35: Yellow jump pad
- 36: Yellow jump orb
- 67: Blue jump pad
- 84: Blue jump orb
- 140: Pink jump pad
- 141: Pink jump orb
- 1332: Red jump pad
- 1333: Red jump orb

### Triggers
- 29: Color trigger
- 30: BG color trigger (channel 1000)
- 104: Move trigger
- 105: Pulse trigger
- 749: Rotate trigger
- 901: Spawn trigger
- 1006: Stop trigger
- 1007: Alpha trigger
- 1049: Toggle trigger
- 1268: Shake trigger
- 1346: Follow trigger
- 1347: Follow Player Y trigger

### Game Mode Portals
- 12: Ship
- 13: Cube
- 47: Ball (mini portal, but also used contextually)
- 111: UFO portal
- 660: Wave portal
- 745: Robot portal
- 1331: Spider portal
- 1933: Swing portal
