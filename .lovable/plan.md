

## Bug: CSV Preview Dialog Not Rendering on Upload

### Root Cause

In `BomExplorer.tsx`, the component has two return paths:

1. **Lines 223-285**: When `tree` is `null` (initial upload screen) — returns the upload UI
2. **Lines 288-555**: When `tree` exists — returns the graph + all dialogs

The CSV column mapping Dialog (lines 415-553) is **only in the second return block**. So when a user uploads a file for the first time (no tree yet), `openPreview` sets `previewOpen = true`, but the Dialog component isn't in the DOM — nothing happens.

### Fix

Move the CSV preview Dialog **outside** the conditional return, so it renders regardless of whether `tree` exists. Specifically:

**`src/components/bom/BomExplorer.tsx`**:
- Extract the Dialog (lines 415-553) from the second return block
- In the first return (upload screen, lines 223-285), wrap the existing content and append the Dialog after it
- Simplest approach: wrap both return paths in a fragment and always render the Dialog at the end

The fix is a small structural change — move the Dialog to render in both code paths.

