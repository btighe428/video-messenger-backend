# Studio Fabric.js Redesign

**Date:** 2025-12-10
**Status:** Approved
**Scope:** Full replacement of studio.js with fabric.js-powered Instagram Stories-style creator

---

## Executive Summary

Replace the existing custom canvas implementation (~1000 lines) with fabric.js, transforming the studio from a Miro-style whiteboard into a fun, expressive Instagram Stories-style creator. Features include neon/marker drawing brushes, emoji stickers, Giphy integration, animated multiplayer cursors with emoji reactions, and Yahoo Oasis design system compliance.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Migration approach | Full replacement (fabric.js from scratch) |
| Toolbar behavior | Slide-out secondary panel (200px, 200ms ease-out) |
| Drawing tools | Instagram-style (Pen, Marker, Neon, Eraser) |
| Stickers | Emoji picker + Static clipart |
| GIFs | Giphy API + Local curated packs (hybrid) |
| Text | 5 font styles + background options (no animations) |
| Cursors | Animated with avatar labels + emoji reactions |
| Canvas controls | Zoom only (simple) |
| Design system | Yahoo Oasis tokens |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Studio View                          │
├──────┬─────────────────────────────────────────┬────────────┤
│      │                                         │            │
│  L   │                                         │  Secondary │
│  E   │         fabric.js Canvas               │   Panel    │
│  F   │     (infinite, zoomable)               │  (slides   │
│  T   │                                         │   out)     │
│      │     + Multiplayer cursors overlay       │            │
│  T   │     + Emoji reaction bursts             │            │
│  O   │                                         │            │
│  O   │                                         │            │
│  L   │                                         │            │
│  B   ├─────────────────────────────────────────┤            │
│  A   │                      [Create ✨]        │            │
│  R   │                      [-] 100% [+]       │            │
└──────┴─────────────────────────────────────────┴────────────┘
```

---

## Yahoo Oasis Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--palette-background-brand` | `#7d2eff` | Primary action (purple) |
| `--palette-background-primary` | `#ffffff` | Background |
| `--palette-foreground-primary` | `#141414` | Primary text |
| `--palette-foreground-tertiary` | `#5b636a` | Secondary text/icons |
| `--palette-line-accent` | `#cdcdcd` | Borders |
| `--spectrum-carbon-3` | `#e3e3e3` | Selected/hover state |
| `--spacing-1` | `4px` | Tight |
| `--spacing-2` | `8px` | Small |
| `--spacing-4` | `16px` | Medium |
| `--spacing-6` | `24px` | Large |
| `--borderradius-sm` | `4px` | Small elements |
| `--borderradius-md` | `8px` | Buttons |
| `--borderradius-lg` | `16px` | Cards/toasts |
| `--borderradius-full` | `9999px` | Circular/pills |
| `--font-family` | `Yahoo Product Sans VF` | Primary typeface |
| `--shadow-drop-2xl` | `0px 6px 12px -3px rgba(31,31,31,0.25)` | Elevated elements |

---

## Left Toolbar Structure

**Dimensions:** 120px width (matches existing Left nav pattern)
**Button size:** 56px × 48px
**Border radius:** 8px
**Gap:** 16px

| Icon | Tool | Has Secondary Panel |
|------|------|---------------------|
| ✏️ (purple circle) | Create | Quick actions menu |
| ▶ | Select | No |
| 🖌 | Draw | Yes - brushes, size, colors |
| T | Text | Yes - fonts, backgrounds |
| 😀 | Stickers | Yes - emoji picker |
| 🎬 | GIFs | Yes - Giphy search + local |
| 🖼 | Images | No - opens file picker |
| 🎨 | Clipart | Yes - 22 SVG assets |
| ─── | Divider | |
| ↩ | Undo | No |
| ↪ | Redo | No |

---

## Secondary Panels

### Draw Panel
- **Brush types:** Pen, Marker, Neon, Eraser (4 toggle buttons)
- **Size slider:** 2px → 20px
- **Color palette:** 16 presets + custom picker

### Text Panel
- **Font styles:** Classic (Sans), Handwritten, Bold Display, Typewriter, Neon Glow
- **Background:** None, Solid, Pill
- **Color palette:** Same as Draw

### Stickers Panel
- **Search input:** Filter emoji
- **Recent row:** Last 8 used
- **Category grid:** Scrollable, grouped by Unicode category

### GIFs Panel
- **Search input:** Giphy API query
- **Trending section:** Auto-populated
- **Quick Reactions:** Local curated packs (instant load)
- **Attribution:** "Powered by GIPHY" badge (required)

### Clipart Panel
- **Grid:** 22 existing SVG assets
- **Preview on hover**

---

## Drawing Brushes

| Brush | Implementation |
|-------|----------------|
| **Pen** | Solid stroke, configurable width/color |
| **Marker** | 50% opacity, wider stroke, flat lineCap |
| **Neon** | Shadow blur 15px (glow), same color at 60% opacity |
| **Eraser** | `globalCompositeOperation: 'destination-out'` |

---

## Multiplayer Cursors

### Cursor Structure
- Triangular pointer (rotates with movement direction)
- Pill badge below: colored circle + username
- Color assigned by user index (0-7)

### Cursor Color Palette
| Index | Color | Hex |
|-------|-------|-----|
| 0 | Purple | `#7d2eff` |
| 1 | Blue | `#0066ff` |
| 2 | Green | `#00b341` |
| 3 | Orange | `#ff6b00` |
| 4 | Pink | `#ff2d8a` |
| 5 | Teal | `#00b3b3` |
| 6 | Red | `#e62e2e` |
| 7 | Yellow | `#e6b800` |

### Emoji Reactions
| Key | Emoji |
|-----|-------|
| 1 | ❤️ |
| 2 | 👍 |
| 3 | 😂 |
| 4 | 🔥 |
| 5 | 👏 |
| 6 | 🎉 |

**Animation:** Burst from cursor, float 80px upward over 1.5s, scale 1→1.4→1, fade out last 500ms

---

## Floating Create Button

- **Position:** `bottom: 80px`, `right: 24px`
- **Style:** Purple pill (`#7d2eff`), white text, sparkle icon
- **Hover:** Scale 1.05, `#8f4aff`
- **Click:** Opens quick actions menu (Draw, Text, Sticker, GIF, Image)

---

## Zoom Controls

- **Position:** `bottom: 24px`, `right: 24px`
- **Structure:** `[-] 100% [+]` horizontal group
- **Range:** 25% → 300%
- **Scroll wheel:** Zoom at cursor position

---

## File Structure

### New Files
```
public/js/
├── studio-fabric.js      (~400 lines) Canvas init, zoom/pan, undo/redo
├── studio-tools.js       (~350 lines) Tool state, switching, create menu
├── studio-panels.js      (~300 lines) Panel slide animation, content
├── studio-brushes.js     (~200 lines) Pen, Marker, Neon, Eraser classes
├── studio-multiplayer.js (~350 lines) Cursors, reactions, object sync
├── giphy-client.js       (~150 lines) API calls, search, caching
├── emoji-picker.js       (~250 lines) Grid, categories, search, recent

public/gifs/
├── reactions/            (50-100 curated GIFs)
└── manifest.json         (metadata)
```

### Modified Files
```
public/css/studio.css     [REWRITE] Yahoo Oasis tokens
public/index.html         [MODIFY]  Add fabric.js CDN, restructure studio
server.js                 [MODIFY]  Add new Socket.IO events
```

### Deleted Files
```
public/js/studio.js       [DELETE]  Replaced by fabric.js implementation
```

---

## Socket.IO Events

### New Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `cursor:move` | Client → Server → Broadcast | `{ x, y, userId }` |
| `cursor:reaction` | Client → Server → Broadcast | `{ emoji, userId }` |
| `object:added` | Client → Server → Broadcast | `{ id, type, fabricJSON }` |
| `object:modified` | Client → Server → Broadcast | `{ id, fabricJSON }` |
| `object:removed` | Client → Server → Broadcast | `{ id }` |
| `canvas:clear` | Client → Server → Broadcast | `{}` |

---

## External Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"></script>
```

No other new dependencies. Giphy API via fetch. Emoji data embedded.

---

## Implementation Order

1. **Phase 1: Core Canvas**
   - fabric.js setup
   - Zoom/pan controls
   - Basic object management

2. **Phase 2: Toolbar & Panels**
   - Left toolbar HTML/CSS
   - Panel slide animation
   - Tool state machine

3. **Phase 3: Drawing Tools**
   - Custom brush classes
   - Color picker
   - Size slider

4. **Phase 4: Content Tools**
   - Text with fonts/backgrounds
   - Emoji picker
   - Clipart grid

5. **Phase 5: GIF Integration**
   - Giphy API client
   - Local GIF packs
   - Search/trending UI

6. **Phase 6: Multiplayer**
   - Cursor rendering
   - Emoji reactions
   - Object sync

7. **Phase 7: Polish**
   - Floating create button
   - Undo/redo
   - Keyboard shortcuts
   - Mobile responsiveness
