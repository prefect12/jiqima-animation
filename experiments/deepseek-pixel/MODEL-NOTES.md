# Reproduction notes — BUG HUNT (pixel-game)

## What I read

I used only these supplied files:

- `prompt.txt`
- `pixel-game/STYLE.md`
- `_engine/core.js`

The original `demo.html`, `demo.mp4`, and `poster.jpg` were not present, so this is an
independent implementation from the specification, not a pixel-identical recovery of the
withheld implementation. I did not search for other copies, credentials, projects, models, or
agents, and I did not edit `core.js`.

## Deliverable

`pixel-game/demo.html` is a standalone page that loads `../_engine/core.js` and calls:

```js
Film({ DUR: 15, BPM: 128, draw(c, t) { ... }, score(S) { ... } })
```

`core.js` provides the usable `window.__film` object (`DUR`, `poster`, `ready`, `frame`, and
`audio`). All drawing is Canvas2D plus the supplied engine. No video, image sequence, or static
screenshot is embedded.

## Timeline

128 BPM gives a 0.46875 s beat and a 1.875 s bar. I treated the beat numbers in STYLE.md as
zero-indexed offsets because that puts beats 4/8/12 on the first beat of bars 2/3/4 and beat 16
exactly on the bar-5 downbeat. The same constants drive both picture and score.

| Time | Event |
| --- | --- |
| 0.000 | Title card begins; hero already running |
| 1.406 | `BUG HUNT` title fully gone (beat 3) |
| 1.425 / 3.300 / 5.175 | Jump starts, 0.45 s before the landings |
| 1.875 / 3.750 / 5.625 | Stomps land on beats 4/8/12; bug flattens, `+10XP`, coin SFX |
| 5.625 | Level-up starts; four yellow pixels orbit; LEVEL UP! flashes |
| 6.450 | HUD changes to LV 2 and the XP bar resets |
| 7.500 | Boss beat (beat 16); scrolling stops; boss panel slides in; riser starts |
| 7.500–8.650 | Boss walks in from the right |
| 9.375 / 10.3125 / 11.250 | Three boss hits on beats 20/22/24 |
| 11.250 | Third HP empty; 10-block explosion; impact SFX |
| 11.71875 | `STAGE CLEAR!` and score count-up to 1250 (beat 25) |
| 14.500–15.000 | Last 0.5 s fades to black |

## Visual implementation

- **Native resolution:** everything is drawn on a 320×180 offscreen canvas with rounded integer
  rectangles. It is blitted 4× into the engine's 1280×720 logical space with smoothing off. At
  the 1920×1080 export size that becomes the intended 6× nearest-neighbour enlargement.
- **Palette:** the four sky blues (`#8BD3FF`, `#76C4F3`, `#63B3EA`, `#52A6E3`), `#3C6E9E`
  mountains with white snow, `#34C759` grass, alternating `#9A5A32`/`#A8643A` dirt, orange hero
  `#FF8C42`, red bugs `#E0504A`, ink `#1D1D24`, and highlight yellow `#FFF27A`. A few darker and
  lighter shades were added for readable pixel shading.
- **Parallax:** clouds are sampled at 0.25× camera movement, mountains at 0.5×, ground and
  grass tufts at 1×. The camera moves at 30 px/s until the boss beat and then holds still while
  the boss enters.
- **Hero:** a 14×23 px orange robot-like runner, with two 8 fps run frames, a tucked jump frame,
  an extended-arm attack frame, a shrunken ground shadow during jumps, and a white flash during
  level-up. The 0.45 s jump is a sine arc whose landing is exactly the stomp beat; a 0.3 s
  small bounce follows.
- **Bugs:** 15×10 px red beetle-like sprites with six legs, antennae, two-frame animation, and a
  mirrored silhouette so they face left toward the hero. Stomped bugs become flat strips.
  The boss is the same helper at 4× scale with a yellow crown.
- **HUD:** semi-transparent ink panels. Left: `HERO`, level, and a 76-px XP bar. Right: `BOSS`
  and three HP segments, sliding in on the boss beat. Boss hits empty one segment each.
- **Effects:** deterministic `+10XP` float, stomp dust, boss-hit sparks, 0.15 s white boss flash
  with deterministic shake, a 10-square explosion, level-up orbit, and stage-clear sparks.
- **Scanlines:** one `rgba(0,0,0,0.08)` line every 4 px in the 1280×720 logical space.
- **Text:** Google Fonts is requested for **Press Start 2P**; the canvas font string falls back
  to `Menlo`, `Courier New`, and generic monospace if the request or font is unavailable. All
  visible strings are uppercase English as requested. Sizes are 6–16 px in native canvas pixels.

## Sound implementation

The score is synthesized entirely through the engine's `makeScore`/`I` instruments and the same
event times as the picture:

- **Main section:** square-wave `chip` melody, triangle-wave `chipTri` bass, and `drums` entering
  on bar 2 (kick, snare, eighth hats).
- **Boss section:** A-minor sixteenth-note lead, busier drums, and a `riser` on the boss beat.
- **Clear section:** the melodic material returns an octave higher, with a chip arpeggio and
  final chord.
- **SFX:** `jump` at each jump start, `coin` on each stomp, `thud + pop` on the first two boss
  hits, `impact` on the explosion/third hit, and chip arpeggios for level-up and clear.

The third boss hit is covered by the explosion `impact` rather than stacking a third
`thud + pop` on top of it; this keeps the same three-impact rhythm while avoiding a clipped
peak. Audio events are scheduled from the same `T` constants used by the renderer.

## Determinism

All visual randomness is replaced by a deterministic hash of explicit values. There is no
`Math.random`, wall clock, `Date`, or timer in the draw path. The rendered frame at a given `t`
is therefore a pure function of `t` and the code. The Web Audio noise generator still uses
random noise internally (it is noise), but its scheduling is deterministic.

## Checks performed locally

These checks were run in this working directory with the supplied engine:

- The inline script parsed successfully with Node's `vm.Script`.
- Headless Chrome loaded `pixel-game/demo.html` from `file://`; `document.readyState` was
  `complete`, and `window.__film` exposed `DUR: 15`, `poster: 10.62`, and callable
  `frame`/`audio` functions.
- Frames were rendered through `__film.frame(t, 1920, 1080)` at the title, jumps, stomps,
  level-up, boss entry, boss hits, explosion, stage clear, and fade. The returned JPEG data URLs
  decoded and were inspected as stills.
- Rendering the same `t` twice produced byte-identical data URLs.
- `__film.audio()` rendered a 15.5 s stereo 48 kHz WAV through `OfflineAudioContext`. After the
  mix adjustments, its overall peak was about 0.80 and no analysed 50 ms window exceeded 0.90;
  this replaced an earlier draft that peaked at 1.00 on the boss-hit transients.

These checks establish that the page is runnable and internally consistent. They are not a
claim of visual or audio identity with the withheld original, which I could not compare against.

## Deviations and limitations

- **No original reference:** character name (`HERO`), camera speed, world spacing, boss crown,
  projectile attack, HUD wording, and exact title layout are interpretations of the style brief.
  The original may have used a different attack, boss silhouette, or names.
- **Beat counting:** I used zero-indexed beat offsets. If the specification intended 1-indexed
  beats, the events would shift earlier by one beat. The bar-boundary behaviour strongly suggests
  the zero-indexed reading.
- **Stage-clear timing:** the brief names the stomp, boss, and hit beats but not the exact clear
  beat. I placed `STAGE CLEAR!` at beat 25 (11.71875 s), after the explosion, and kept the score
  on screen until the final fade.
- **Boss HUD visibility:** the right-hand boss panel is hidden until the boss beat rather than
  being visible from the start. This is a game-UI choice not fixed by the brief.
- **Font dependency:** Press Start 2P is loaded from Google Fonts. In the local check the font
  was available, but an offline operator will see the monospace fallback and different text
  metrics. The layout is centered, so it remains usable, but it is not the same typeface.
- **Scanline interpretation:** “every 4 px after enlargement” is applied in the engine's
  1280×720 logical space. At a 1920×1080 export that is a 1.5-device-pixel line every 6 device
  pixels, not a hard 4-device-pixel grid.
- **Boss hit sound:** the third `thud + pop` is replaced by the explosion impact to control
  clipping; the three-hit visual rhythm is unchanged.
- **Audio comparison:** the score follows the instrumentation and section instructions, but I
  could not compare the mix, melody, or timbre to the original sample. The measured peak is
  evidence against clipping, not evidence of a close match.
- **No claim of exact identity:** this is a faithful independent reconstruction from the
  available specification and engine, not a recovered copy of the withheld animation.

## Files

- `pixel-game/demo.html` — runnable reconstruction.
- `REPRODUCTION.md` — this document.

No other project files were modified.
