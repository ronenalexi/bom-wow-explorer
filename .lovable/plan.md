

## Sunburst Interaction Improvements

### Changes in `src/components/bom/BomSunburst.tsx` only

#### 1. Back icon inside the center circle
- Remove the external overlay back button
- When `zoomRoot` is set, render a small `Undo2` icon inside the center circle (e.g. at y=30) as an SVG foreignObject or as a clickable SVG element
- Clicking the icon area calls `handleBackClick`; clicking the rest of the center circle calls `onSelect(effectiveRoot)` for details

#### 2. Leaf nodes become the center when clicked
- Current: clicking a leaf calls `onSelect` immediately (opens side panel)
- New: clicking any arc (leaf or not) sets `zoomRoot` to that item — the item becomes the center circle
- If it's a leaf with no children, you'll see just the center circle with no rings — that's fine
- Then clicking the center circle opens the side panel

#### 3. Center circle layout when zoomed
- Show item name + description (as now)
- Replace "לחץ לפרטים" with a clickable back icon area at the bottom of the circle
- Split center circle into two interaction zones:
  - Upper area (item text + "לחץ לפרטים") → `onSelect(effectiveRoot)`
  - Lower area (back icon) → `handleBackClick` (go up one level)

### Implementation Detail
- Remove the external `<button>` overlay for back
- In the center circle SVG area, add a small `Undo2` icon (via `<foreignObject>` or SVG path) positioned below the text, only visible when `zoomRoot !== null`
- `handleArcClick`: always `setZoomRoot(seq)` regardless of children count
- Center circle click → `onSelect(effectiveRoot)` (open side panel)
- Back icon click → navigate up, with `e.stopPropagation()` to prevent center click

