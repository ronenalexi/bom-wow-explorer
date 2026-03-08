

## Add Sunburst + Tree Table Views with Toggle

Add two new visualization modes alongside the existing radial graph, with a 3-way toggle in the top bar.

### View Modes
1. **Radial Graph** (existing) — current `BomGraph` component
2. **Sunburst** — concentric rings, click to zoom, qty-proportional arcs
3. **Tree Table** — indented collapsible table, ERP-style

### Files to Create

**`src/components/bom/BomSunburst.tsx`**
- Custom SVG sunburst chart built with polar coordinate math (no extra deps)
- Root at center, children as arcs in concentric rings
- Arc width proportional to `QtyPerParent` (or equal share)
- Click arc → zoom in (that item becomes center, animated)
- Hover → tooltip with item details
- Color gradient by level depth
- Props: `tree: TreeData`, `rootSeq: string`, `onSelect: (seq) => void`

**`src/components/bom/BomTreeTable.tsx`**
- Indented collapsible table using existing `Table` UI components
- Columns: expand toggle, Item, Description, Qty, CumQty, Level
- Indent by `Level` with visual connector lines
- Click row → select (opens side panel)
- Expand/collapse toggles
- Virtualized rendering for large BOMs (show first N + "load more")
- Props: `tree: TreeData`, `rootSeq: string`, `onSelect: (seq) => void`, `selectedNode: string | null`

### Files to Modify

**`src/components/bom/BomExplorer.tsx`**
- Add state: `viewMode: 'graph' | 'sunburst' | 'table'` (default `'graph'`)
- Add 3-button toggle group in top bar (using existing `ToggleGroup` component) with icons:
  - Graph → `Share2` or current `Zap` icon
  - Sunburst → `Sun` icon  
  - Table → `List` or `TableProperties` icon
- In the main content area, conditionally render `BomGraph`, `BomSunburst`, or `BomTreeTable` based on `viewMode`
- Pass shared callbacks (`onSelect`, `onToggle`) to all three views

### Interaction Consistency
All three views share the same side panel, search dialog, and warehouse selection flow. Switching views preserves `selectedNode`, `expandedNodes`, and `focusedNode` state.

