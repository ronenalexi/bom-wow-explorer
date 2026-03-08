

## Problem Analysis

The CSV upload fails because `parseCSV` expects **exact column names** (`Item`, `Level`, `Parent`, `Path`, `ItemDesc`, etc.). If the user's CSV has different headers (e.g., Hebrew headers, different naming conventions, or ERP-specific names), all fields parse as empty. The preview dialog then shows "Missing data for: Item, Level, Parent..." and **disables the "Use this file" button** (line 515: `disabled={previewIssues.length > 0}`).

## Solution: Column Mapping Step

Add a **column mapping UI** in the preview dialog that lets users map their CSV headers to the required BOM fields.

### Flow

1. User uploads CSV → `Papa.parse` reads raw headers
2. Preview dialog shows the raw headers and lets user map each one to a BOM field (or skip)
3. Auto-match: attempt fuzzy matching (case-insensitive, common aliases like "Part Number" → Item, "Description" → ItemDesc)
4. User confirms mapping → rows are transformed → tree is built

### Files to Change

**`src/lib/bom.ts`**
- Add `parseCSVRaw(csvText)` → returns `{ headers: string[], rawRows: Record<string,string>[] }`
- Add `mapRows(rawRows, mapping)` → transforms raw rows into `BomRow[]` using user-defined column mapping
- Add `autoMatchHeaders(headers)` → returns best-guess mapping `Record<BomField, string | null>`

**`src/components/bom/BomExplorer.tsx`**
- Replace `openPreview` flow:
  1. Parse raw CSV (headers + data)
  2. Run `autoMatchHeaders` to pre-fill mapping
  3. Show mapping UI in preview dialog
  4. User adjusts mapping if needed
  5. On confirm → `mapRows` → `buildFromRows`
- Update preview dialog to show:
  - Dropdown per required field (Seq, Level, Item, ItemDesc, Parent, ParentDesc, QtyPerParent, CumQty, Path, HasChildren)
  - Each dropdown lists the CSV's actual column headers
  - Auto-matched fields pre-selected
  - Live preview table updates based on current mapping
  - "Use this file" enabled when at minimum `Item` and `Level` are mapped (Parent/Path optional but recommended)

### Auto-Match Logic (fuzzy aliases)

```text
Item        ← "item", "part", "part number", "item_code", "item code", "component"
ItemDesc    ← "description", "item desc", "item_desc", "desc", "name"  
Level       ← "level", "bom level", "lvl"
Parent      ← "parent", "parent item", "parent_item"
ParentDesc  ← "parent desc", "parent_desc", "parent description"
QtyPerParent← "qty", "quantity", "qty per parent", "qty_per_parent"
CumQty      ← "cum qty", "cumulative qty", "cum_qty", "extended qty"
Path        ← "path", "bom path", "hierarchy"
HasChildren ← "has children", "has_children", "expandable"
Seq         ← "seq", "sequence", "row", "#", "line"
```

### Validation Change

Instead of blocking on missing columns, show warnings but allow proceeding as long as `Item` is mapped. `Level` can default to 0, `Parent` can be inferred from indentation/order if missing.

