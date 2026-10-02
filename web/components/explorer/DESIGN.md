# Explorer — CSS & design choices

Short rationale for how the redesigned explorer (`/`) is styled. The legacy
view (`/v1`) is untouched and shares none of this.

**Files**

| File | Role |
|---|---|
| `tokens.css` | Global `:root` design tokens + font import. Plain CSS, not a module (a bare `:root` rule isn't a valid CSS Module selector). Imported only by `PensumExplorer.tsx`, so it never reaches `/v1`. |
| `explorer.module.css` | Everything else, scoped per class (~1800 lines, numbered sections: shell, top bar, card, side panel, planner, tour…). |

## Principles

1. **Color means one thing.** Course *type* is the card fill. Relationship and
   progress state are drawn *around* the card (rings, dimming), never by
   recoloring it. So a card can always be read as "what is it" and "how does it
   relate" independently.
2. **Quiet by default, loud on intent.** Hover is a light touch (a ring + dashed
   preview edges). Full highlighting and map-wide dimming only happen on a real
   *selection* (a click). This was a reviewer ask (less visual noise) and it
   keeps the map readable at 60 cards.
3. **Tokens over literals.** Colors, lines and surfaces are CSS variables so a
   re-theme is a one-file change. A few state colors (green `#15803d`, amber
   edges) are still literal in the CSS/`MapCanvas.tsx` — see *Known gaps*.

## Tokens (`tokens.css`)

- **Neutrals:** `--ink` / `--ink-2` / `--muted` for text; `--line*` hairlines;
  `--surface`, `--canvas`, `--band-a/b` for the layered backgrounds
  (white panel → off-white canvas → slightly darker semester bands).
- **Accent:** a single blue (`--accent` `#1f6fc4`) with hover/tint/border/soft
  variants. It marks selection, direct prerequisites and focus.
- **Course types (`--t-*`):** one deep, saturated hue per group — Eléctrica
  teal, Ciencias básicas brown, Otras slate, Proyecto blue, Electiva magenta,
  CBU indigo, Requisito grey. All are dark enough for white text on the card.
- **Status (`--st-*`):** green = available/planned, amber = one course away /
  admin-locked, hatched grey = blocked.
- **Type:** IBM Plex Sans for UI, IBM Plex Mono for codes, credits, kickers and
  numbers — codes like `IELE 2100` align and read as identifiers, not prose.
  Uppercase + letter-spacing is reserved for tiny labels (`.lbl`, `.kicker`).

## Map layout

- **Fixed grid geometry** (constants in `MapCanvas.tsx`): 148×60 cards on a
  168 px column pitch and 70 px row pitch. Each semester is a column; the
  alternating `--band-a/b` rounded bands make columns scannable without grid
  lines.
- **Canvas** is a dotted background (`radial-gradient` on `.canvasWrap`) —
  gives a sense of pan/zoom without competing with the cards.
- **Side panel** is a fixed 400 px column on the right that can collapse;
  the map refits (`fitView`) when it opens/closes.
- Bands and headers are React Flow nodes with `pointer-events: none`, so they
  never intercept clicks meant for cards.

## Course card states

State is composed from independent classes on the same button:

| Layer | Classes | Look |
|---|---|---|
| Type | `.typeIele`, `.typeCb`, … `.slot*` | Sets `--card-color` (the fill). Placeholder/slot cards use the same solid card — only the color differs — so every node clicks and reads the same. |
| Selection relation | `.selected`, `.directPrereq`, `.chainIndirectFull`, `.unlockSole`, `.unlockAmong` | Rings via `box-shadow` (white gap + colored ring). Selected also lifts 2 px. Green ring = this is the only thing missing for a course; amber = one of several. |
| Dimming | `.dimmed`, `.unrelated` | Unrelated cards fade (opacity ≈ 0.15–0.34) while a course is selected. |
| Mi avance | `.stApproved`, `.stAvailable`, `.stPlanned`, `.stBlocked`, `.stAdmin`, `.staged` | Approved = green fill + check badge. Available/planned = green ring. Blocked = hatched grey with muted text (readable as "not yet" without hue). Admin-locked = hatched + amber ring. |

Rings use `box-shadow` instead of `border`/`outline` so they never change the
card's box size — nothing shifts or reflows when a state changes.

Edges: prerequisites are solid blue arrows; corequisites and "can be taken the
same term" (`*`) are dashed amber with no arrowhead; hover previews are dashed
light blue.

## Motion and hover

- Cards transition `opacity`, `box-shadow` and `filter` over 0.12 s — enough to
  feel responsive, short enough not to trail the cursor.
- **The hover ring is pure CSS** (`:where(.card):hover`), not React state.
  Earlier, hover committed `hoveredId`, which rebuilt every card's data and
  re-rendered all ~60 cards at the instant the ring appeared — that was the
  flicker. Now hover only drives the preview edges and tooltip (debounced
  70 ms / 250 ms) and never touches the nodes.
  `:where()` keeps specificity at `(0,1,0)` and the rule sits above the
  relation/status rules, so selection and status styles still win.
- The unlock animation (`.justUnlocked`: a pulsing green ring + a light sweep)
  repeats 3× so a newly unlocked course registers (review item F-7).
  `prefers-reduced-motion` turns it off.

## Accessibility

- Cards are real `<button>`s with an `aria-label` carrying code, name, credits
  and state — color is never the only signal for status.
- Keyboard focus: `.card:focus-visible` shows a white + accent double ring.
- `.srOnly` utility for screen-reader-only text.
- Blocked cards use pattern (hatching) plus muted text, not just color.

## Known gaps

- **Responsive:** only the chooser grid has a breakpoint (`max-width: 520px`).
  The map + 400 px panel layout is desktop-first.
- **Reduced motion** is honored for the unlock animation and one other block;
  the 0.12 s transitions and `fitView` animations are not gated.
- **Remaining literals:** `#15803d`, `#16a34a`, `#d97706` and the edge colors
  in `MapCanvas.tsx` duplicate token values — they should reference
  `--st-*` / `--accent` (edges are SVG props, so they'd need to be read from
  CSS variables at runtime).
- **Contrast** hasn't been measured; the type colors were picked dark for
  white text but not verified against WCAG.
- Fonts load from Google Fonts at runtime (`@import` in `tokens.css`); a
  self-hosted copy would remove the external dependency.
