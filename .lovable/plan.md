

## Plan: Fix Node Overlap, Persist Expanded Nodes, Add Dark/Light Toggle

### Problem 1: Nodes overlap each other
The radial layout uses a fixed radius (300px) regardless of how many children exist. With many children, nodes at 260px wide crowd into the same space.

**Fix:** Scale the radius based on `childCount * nodeWidth` to guarantee minimum spacing. Also increase the arc spread for sub-children so grandchildren don't pile up on each other.

### Problem 2: Expanding a new node collapses previously expanded nodes
Currently `deriveGraph` in focus mode only shows the focused node + its parent + its children. All other previously expanded branches disappear.

**Fix:** Change `deriveGraph` so that when `focusedNode` is set, it still walks the full tree from root following all expanded nodes (same as non-focused mode), but passes the `focusedNode` to the layout so it gets centered. The graph shows all expanded branches, not just the focused one.

### Problem 3: Add Dark/Light mode toggle
Add a toggle button inside the ReactFlow Controls area (between zoom and fit-view). Each click switches between dark and light themes.

**Implementation:** Add a light theme CSS variables block in `index.css` under `.light` class. Add a small custom button rendered alongside `<Controls>` that toggles a `dark`/`light` class on the `<html>` element.

### Files to Change

1. **`src/lib/bom.ts` → `deriveGraph`**: Remove the `focusedNode` branch that only shows focused node. Always walk from root following all expanded nodes. Pass `focusedNode` through as layout hint only.

2. **`src/components/bom/BomGraph.tsx` → `radialLayout`**: 
   - Calculate radius dynamically: `radius = Math.max(400, childCount * 150)` 
   - Increase sub-child arc spread
   - Ensure minimum angular separation between nodes

3. **`src/components/bom/BomGraph.tsx`**: Add a dark/light toggle button rendered as a custom control panel inside ReactFlow, styled to match the existing controls panel.

4. **`src/index.css`**: Add `.light` theme variables (light background, dark text, adjusted card/border colors).

