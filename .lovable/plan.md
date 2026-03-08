

## Fix: Minimap Stays Dark in Light Mode

The minimap's `maskColor` prop in `BomGraph.tsx` is hardcoded to a dark value. It needs to switch dynamically based on the theme.

### Change

**`src/components/bom/BomGraph.tsx`** — Update the `MiniMap` component's `maskColor` prop to be dynamic:

```
maskColor={isDark ? "hsl(222 25% 6% / 0.8)" : "hsl(210 20% 96% / 0.8)"}
```

Also update `nodeColor` to provide better contrast in light mode:
```
nodeColor={(n) => {
  if (n.type === 'more') return 'hsl(38 95% 55%)';
  if (n.type === 'children-group') return 'hsl(185 100% 48%)';
  return isDark ? 'hsl(222 20% 25%)' : 'hsl(210 15% 70%)';
}}
```

Single file change, two props.

