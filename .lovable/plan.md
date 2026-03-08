

## Color Logic for Qty On Hand Column

### Changes in `src/components/warehouse/CentralWarehouse.tsx`

#### 1. Move color coding from Total to Qty On Hand
- **Total column** (line 192-196): Remove color classes, use plain `text-muted-foreground`
- **Qty On Hand column** (lines 173-191): Add color coding based on ratio of `centralQty / totalQty`

#### 2. Color logic
- **Green/normal** (`text-foreground`): `centralQty === totalQty` — all stock is in central, fully available
- **Amber** (`text-amber-500`): `centralQty > 0 && centralQty < totalQty` — some stock distributed elsewhere
- **Red** (`text-destructive`): `centralQty === 0 && totalQty > 0` — nothing available in central, all distributed

For serialized items: apply color to the Badge. For non-serialized: wrap the Input in a colored container or add a small colored indicator next to it.

