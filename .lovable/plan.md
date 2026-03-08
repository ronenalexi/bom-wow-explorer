

## Fix: React Flow Background Stays Dark in Light Mode

The React Flow background and controls have hardcoded dark colors in CSS that don't respond to the theme toggle.

### Changes

**`src/index.css`** — Add `.light` scoped overrides for all React Flow CSS rules:

- `.light .react-flow__background` → light background color (`hsl(210 20% 96%)`)
- `.light .react-flow__controls` → light controls background
- `.light .react-flow__controls-button` → dark fill/icons, light hover
- `.light .react-flow__minimap` → light minimap background

Also in **`src/components/bom/BomGraph.tsx`** — Update the `Background` component's `color` prop to be dynamic based on `isDark` state (dots color).

