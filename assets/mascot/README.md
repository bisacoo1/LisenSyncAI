# Lilo — LisenSync AI TTS Mascot

**Character:** Lilo, the pharmacist owl who reads your lessons aloud.
**Feature:** the text-to-speech (read-aloud) control in Practice Mode.
**Style:** soft-3D claymorphic render, matte clay material, no outlines.

---

## 1. The idea

Lilo is an owl — the animal we already associate with study, night-before recall, and wisdom — wearing the two
things that define LisenSync AI at a glance:

| Element | Why it's there |
| --- | --- |
| **White pharmacist lab coat + stethoscope + name badge** | Instantly reads "pharmacy" and "professional", matching the PhLE review identity |
| **Navy over-ear headphones with cyan mic boom** | Reads "audio / listening", i.e. the text-to-speech feature |
| **Capsule held like a microphone** | Half white / half navy pill = pharmacy, held as a mic = speaking |
| **Cyan sound-wave arcs** | Universal "audio is playing" cue; also the accent colour of the TTS UI |
| **Warm amber eyes and beak** | The only warm colour on the mascot — makes it friendly instead of clinical |

The silhouette test: a round body, big head, headphone bar across the top, mic boom on the right. It should be
identifiable at 28 px without any of the coat detail surviving.

## 2. Personality

Warm, encouraging, slightly nerdy. The owl that sits next to you at 11 p.m. and says *"okay, one more module."*
Never sarcastic, never a lecturer. It **reads to you**; it doesn't grade you.
Voice-tone for any copy written in Lilo's voice: short sentences, second person, calm, zero exclamation marks.

## 3. Naming

**Lilo** is the recommended name — short, easy to say, and phonetically hides "Lisen". Alternatives if you want
to keep it more literal: *Syn*, *Ollie*, *Rex* (after Rx), *Hoot*.

## 4. Palette

| Role | Hex | Use |
| --- | --- | --- |
| Navy (primary body) | `#1D56A8` | Mascot body, primary buttons — matches `--primary` |
| Deep navy | `#164385` | Headphone shadows, gradient end — matches `--primary-2` |
| On-air cyan | `#38D6FF` | Sound waves, glow, pulse ring, playing-state accents |
| Cream | `#F7F1E3` | Face disks, chest feathers |
| Beak amber | `#F08A24` | Beak and feet only — keep it rare |
| Mist | `#EEF4FB` | Flat background behind the art |

Cyan is the **only** colour that should signal "audio is active". Don't reuse it for success/positive states.

## 5. Asset inventory

```
assets/mascot/
├─ pharmacy-tts-mascot-owl.png      master art, hero pose (2688×1536)
├─ pharmacy-tts-mascot-speaking.png master art, speaking pose
├─ pharmacy-tts-mascot-avatar.png   master art, portrait crop
├─ app/                             derived, web-ready
│   ├─ mascot-speaking-1200.png     hero / empty state, transparent-friendly light bg
│   ├─ mascot-avatar-512.png        square portrait
│   ├─ mascot-avatar-256.png        square portrait, smaller
│   ├─ mascot-avatar-128.png        list / compact rows
│   ├─ mascot-avatar-round-256.png  circular avatar with alpha
│   ├─ favicon-mascot-256.png       rounded-square app icon
│   └─ favicon-mascot-64.png        favicon size
└─ preview/index.html               visual reference sheet (all states in context)

src/assets/mascot/                  the copies the React app imports
```

## 6. Do / Don't

**Do**
- Use the round avatar at any size ≤ 160 px; use the full-body `speaking` art at ≥ 160 px.
- Keep the mist background or drop the art on light panels. It is drawn for light backgrounds.
- Keep clear space around the character equal to roughly one headphone-cup width.
- Use it to *narrate* things — "I'll read this rationale to you."

**Don't**
- Recolour the coat, headphones, or eyes.
- Add props (flasks, books, graduation caps) without redrawing the whole character in the same style.
- Stretch, rotate, or add drop shadows that fight the render's own lighting.
- Put it on dark navy panels without a light chip behind it.
- Let it speak in first person about *results* ("you failed"). Lilo reads; LisenSync assesses.

## 7. States

| State | Art | Trigger |
| --- | --- | --- |
| **Idle** | round avatar, no ring | TTS not playing |
| **Speaking** | round avatar + cyan pulse ring, or the full-body speaking art | audio is playing |
| **Loading** | round avatar + `Skeleton` shimmer | voice/audio is being prepared |
| **Error** | round avatar + muted copy, no ring | TTS failed / unsupported |

## 8. Usage in code

```tsx
import { TtsMascot, TtsMascotCard, TtsListenButtonContent } from '@/components/ui'

// 1. "Read aloud" button content
<Button onClick={play}>
  <TtsListenButtonContent playing={isPlaying} />
</Button>

// 2. Companion callout in Practice Mode
<TtsMascotCard text="Tap the speaker and I'll walk you through this rationale." size={72} />

// 3. Hero / empty state
<TtsMascot size={320} variant="speaking" label="Lilo reading a rationale aloud" />

// 4. Speaking indicator next to a passage
<TtsMascot size={40} variant="round" speaking={isPlaying} />
```

`TtsMascot` handles the size→variant switch, lazy loading, and the `prefers-reduced-motion` case for the
pulse ring. The matching styles live at the end of `src/index.css` under `/* === TTS Mascot === */`.

## 9. Reproducing new poses

When prompting for additional poses, always pass the master art as a reference and reuse this anchor paragraph:

> Keep the exact same character design, colors and soft 3D claymorphic render style as the reference image.
> Friendly pharmacist owl mascot: navy rounded feather body, cream face disks, big amber eyes, small orange
> beak, chunky navy over-ear headphones with a thin cyan microphone boom, crisp white pharmacist lab coat with
> stethoscope and small name badge, soft clay material, rounded volumes, no outlines, flat pale blue-white
> background, no text.

---

## 10. Logo mark (Lilo in the mortar)

`assets/logo/` holds the app mark: Lilo sitting over the mortar-and-pestle, surrounded by the three core
pharmacy symbols.

**Construction**, on a navy `#10233E` rounded-square tile (22% corner radius):

| Zone | Element | Purpose |
| --- | --- | --- |
| Center | Lilo bust — amber head, cream heart-shaped face disks, amber eyes, navy headphones | The mascot; the hero shape |
| Below | White mortar-and-pestle, pestle emerging from the bowl and leaning left | The pharmacy symbol, and a pedestal for Lilo |
| Upper-left | White **Rx** symbol | Prescription / dispensing |
| Upper-right | White **pharmacy cross** | Healthcare / clinical |
| Lower-right | Amber-and-white **capsule** | Dosage forms / Pharmaceutics |

**Note on the sound waves:** earlier drafts used cyan TTS sound arcs. They were removed on request — the mark is
now purely pharmacy-focused. The TTS identity still lives in the mascot art (`pharmacy-tts-mascot-speaking.png`)
and in the cyan "on-air" pulse in the Practice Mode UI, so nothing is lost functionally.

**Read order at small sizes:** mortar (solid white mass) → owl face (cream) → corner icons. The corner symbols are
deliberately smaller than the owl so 32px stays clean; below 24px use the mark without the corner icons.

| File | Use |
| --- | --- |
| `assets/logo/emblem-lilo-pharmacy.png` | master emblem on flat navy (source of truth) |
| `assets/logo/lisensync-logo-lilo.png` | earlier full-tile draft (kept for reference) |
| `assets/logo/app/logo-mark-{512,256,192,128,64,32}.png` | tile sizes, corners baked in |
| `assets/logo/app/favicon.ico` | 16/32/48/64 multi-size favicon |
| `assets/logo/app/lisensync-logo-lockup.png` | horizontal lockup, dark text — decks, docs, email |
| `assets/logo/app/lisensync-logo-lockup-inverse.png` | white text on transparency — dark surfaces |
| `assets/logo/preview/index.html` | visual reference sheet, all sizes in context |

**In the app:** `src/assets/logo-mark.png` (512) is what `Brand.tsx` renders; `public/favicon.ico` and
`public/logo-mark-192.png` serve the tab icon and apple-touch-icon. The in-app wordmark stays live text so it
remains crisp and accessible — the PNG lockups are for external/print use only.

**Clear space:** a quarter of the tile width on every side. **Minimum size:** 24 px (tile), 32 px (favicon).
**Don't:** recolour the tile, remove the mortar (it is what makes the mark read as pharmacy), or place the mark on
a mid-tone blue background — it needs near-white or very dark navy behind it.
