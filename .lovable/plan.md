

## Radial/Centered Layout for BOM Graph

### What Changes

Instead of the current top-down Dagre tree layout, the graph will use a **radial layout** where:

1. **Initial state**: Root node centered on screen, its direct children arranged in a circle around it
2. **On click/expand**: The clicked node becomes the new center, its children fan out around it in a circle, and all other visible nodes reposition smoothly
3. **Edges** connect from center outward using straight or bezier lines

### Technical Approach

**Replace `layoutNodes` in `BomGraph.tsx`** with a custom radial layout algorithm:

```text
         child3
        /
child2 — [PARENT] — child4
        \
         child1         child5
```

- The **focused/expanded node** is placed at center (0,0)
- Its **children** are positioned in a circle around it at a configurable radius (~350px)
- Its **parent** (if visible) is positioned above it
- Any **grandchildren** of expanded children are positioned in a smaller arc around their parent
- Angles are evenly distributed: `angle = (2π / childCount) * index`

**Key changes:**

1. **`src/lib/bom.ts` → `deriveGraph`**: No changes needed — it already produces the right nodes/edges based on expanded state

2. **`src/components/bom/BomGraph.tsx` → `layoutNodes`**: Replace Dagre with custom radial positioning:
   - Find the "center node" (the most recently expanded/focused node, or root)
   - Position its children in a circle
   - Recursively position grandchildren in arcs
   - Remove Handle top/bottom fixed positions — use dynamic handle positions or switch to floating edges

3. **Handle positions**: Change from fixed Top/Bottom to using `Position.Left/Right/Top/Bottom` dynamically based on angle, or use `type: 'default'` edges with `sourcePosition`/`targetPosition` computed per-node

4. **`BomExplorer.tsx` interaction**: Modify `onToggle` so that expanding a node also sets it as the "center" node (similar to current `focusedNode` but integrated into the layout)

5. **Smooth transitions**: ReactFlow supports animated node position changes when node IDs stay the same — positions will animate automatically

### Files to Modify

- **`src/components/bom/BomGraph.tsx`** — Replace `layoutNodes` with radial algorithm, update Handle positions to be dynamic, pass center node info
- **`src/components/bom/BomExplorer.tsx`** — Merge expand + center behavior so clicking expand auto-centers that node
- **`src/lib/bom.ts`** — Minor: pass center node context to `deriveGraph` if needed

