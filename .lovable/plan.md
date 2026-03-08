

## Sunburst View Improvements

### Changes — all in `src/components/bom/BomSunburst.tsx` only

#### 1. Zoom (mouse wheel / pinch)
Add SVG zoom+pan via `viewBox` manipulation:
- Track `scale` and `translate` state
- `onWheel` handler adjusts scale (clamped 0.5–3x)
- Optional: drag to pan (mousedown/mousemove)
- Apply transform to an inner `<g>` wrapper

#### 2. Click behavior: zoom-in first, side panel second
Current: clicking an arc both zooms in and calls `onSelect` (opens side panel).

New behavior:
- **First click** on an arc with children → `setZoomRoot(seq)` only (no `onSelect`)
- **Click on center circle** when `zoomRoot === seq` (i.e. the currently zoomed item) → call `onSelect(zoomRoot)` to open the side panel
- Leaf nodes (no children): first click opens side panel directly

#### 3. Dedicated back button icon
Replace "click center to go back" with an explicit back arrow icon:
- Add an `ArrowLeft` or `Undo2` icon (from lucide) positioned at a fixed spot (e.g. top-left corner of the SVG area, or as an HTML button overlay)
- Only visible when `zoomRoot !== null`
- Clicking it calls the existing `handleBackClick` logic
- Center circle click now only opens the side panel (per item 2)

#### 4. No changes to BomExplorer
The `onSelect` prop stays the same — the Sunburst component internally decides when to call it.

### Implementation Summary
- Modify only `BomSunburst.tsx`
- Add zoom state (`scale`, `panX`, `panY`) + wheel handler
- Change `handleArcClick`: zoom only (no onSelect) for items with children on first click
- Center circle click → `onSelect(zoomRoot)` to open side panel
- Add overlay back button with lucide icon, visible only when zoomed

