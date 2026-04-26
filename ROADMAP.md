# Existential Snake — Roadmap

## ✅ v1.0 — SHIPPED (April 25, 2026)
- Snake game with Stranger Things theme + Gen Z humor
- Soundboard (12 synthesized sounds)
- Mario coin eat sound (two variants)
- 4 ForeverBound background tracks with picker
- Dimension flipping (upside down mode)
- Mystery food with variable rewards (slot machine dopamine)
- Streak counter with near-miss at 9/10
- Persistent high score (localStorage)
- 7 unlockable skins (score milestones)
- Light/dark mode
- NFL trivia sprinkled in
- Mobile: touch/swipe + d-pad controls
- Pause (Esc/P/button)
- Share button (native share API)
- Responsive canvas
- Modular ES modules codebase
- GitHub Pages: jmg421.github.io/existential-snake

## v1.1 — Polish (next weekend)
- [ ] Fix: ensure sound persists reliably across all restarts
- [ ] Fix: light mode canvas rendering (background colors inside canvas)
- [ ] Add: screen shake toggle (some kids get motion sick)
- [ ] Add: volume slider
- [ ] Add: "new skin unlocked!" celebration when crossing thresholds
- [ ] Add: more NFL trivia (Evan's picks)
- [ ] Add: more skins (community suggestions)

## v2.0 — Levels & Progression
- [ ] Level system: 10 levels with increasing speed + obstacles
- [ ] Walls/obstacles spawn at higher levels
- [ ] Boss food every 5 levels (big reward, hard to reach)
- [ ] Star rating per level (1-3 stars based on score)
- [ ] Level select screen
- [ ] Save progress (localStorage)
- [ ] Unlockable tracks per level (earn new music)

## v3.0 — Social
- [ ] Shareable score cards (canvas screenshot → image)
- [ ] QR code on game over screen (friend scans to play)
- [ ] Leaderboard (Firebase or Supabase — free tier)
- [ ] Username system (no accounts — just pick a name)
- [ ] "Challenge a friend" link (pre-filled with your score to beat)
- [ ] Weekly challenges (new theme/constraint each week)

## v4.0 — Multiplayer
- [ ] Split screen local multiplayer (same device, WASD vs arrows)
- [ ] Real-time online multiplayer (WebSocket server needed)
- [ ] Friend system (friend codes, not accounts)
- [ ] Spectator mode
- [ ] Tournament brackets

## v5.0 — Creator Tools (vibe coding platform)
- [ ] Level editor (drag and drop walls/food/obstacles)
- [ ] Custom skin creator (pixel art editor)
- [ ] Custom soundboard (upload your own sounds)
- [ ] Share custom levels via URL
- [ ] Community level browser
- [ ] "Remix this level" button

## Infrastructure Needed Per Version
| Version | Server | Database | Auth | Cost |
|---------|--------|----------|------|------|
| v1.x | None (static) | localStorage | None | $0 |
| v2.0 | None (static) | localStorage | None | $0 |
| v3.0 | Firebase/Supabase | Firestore/Postgres | Anonymous | $0 (free tier) |
| v4.0 | WebSocket server | Redis + Postgres | Friend codes | ~$10/mo |
| v5.0 | API server | Postgres + S3 | Optional accounts | ~$25/mo |

## Distribution Strategy
1. **v1.0**: Evan shares link with friends via text/AirDrop
2. **v1.1**: Post on r/webgames, share on X
3. **v2.0**: TikTok gameplay videos (Evan records, John posts)
4. **v3.0**: Leaderboard creates competition loop — kids share to recruit competitors
5. **v4.0**: Multiplayer is the viral mechanic — every game needs 2+ players
6. **v5.0**: Creator tools = infinite content = infinite retention

## The Nodes Bio Connection
- Game teaches kids that AI can build things (vibe coding origin story)
- "Built with AI" watermark links to nodes.bio
- Parent sees kid playing → asks how it was made → discovers Jarvis
- Game is proof that Nodes Bio ships fun things, not just enterprise tools
