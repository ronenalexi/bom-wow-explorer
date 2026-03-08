import React, { useState, useCallback, useMemo, useRef } from 'react';
import { parseCSV, parseCSVRaw, autoMatchHeaders, mapRows, buildTree, deriveGraph, expandPathToNode, DEMO_CSV, BOM_FIELDS, type TreeData, type BomRow, type BomField, type ColumnMapping } from '@/lib/bom';
import { addCatalogItems } from '@/lib/warehouse';
import BomGraph from './BomGraph';
import { BomSidePanel, BomChildrenBrowser, BomSearchDialog } from './BomPanels';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Search, ArrowLeft, Zap, FileSpreadsheet, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onWarehouseRefresh?: () => void;
}

export default function BomExplorer({ onWarehouseRefresh }: Props) {
  const [tree, setTree] = useState<TreeData | null>(null);
  const [selectedRoot, setSelectedRoot] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [browserParent, setBrowserParent] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [previewRaw, setPreviewRaw] = useState<{ headers: string[]; rawRows: Record<string, string>[]; filename?: string } | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Build tree from parsed rows
  const buildFromRows = useCallback((rows: BomRow[], meta?: { filename?: string }) => {
    if (rows.length === 0) {
      toast.error('No data found in CSV');
      return;
    }
    const t = buildTree(rows);
    setTree(t);
    setSelectedRoot(t.roots[0]?.Seq || '');
    setExpandedNodes(new Set());
    setSelectedNode(null);
    setFocusedNode(null);
    setCheckedItems(new Set());
    setBrowserParent(null);
    setSearchOpen(false);
    setFileInfo({
      name: meta?.filename || 'BOM CSV',
      rowCount: rows.length,
      loadedAt: new Date().toISOString(),
    });
    toast.success(`Loaded ${rows.length} items`);
  }, []);

  // Load CSV directly (used for demo button)
  const loadCSV = useCallback((text: string, meta?: { filename?: string }) => {
    try {
      const rows = parseCSV(text);
      buildFromRows(rows, meta);
    } catch (e: any) {
      toast.error('Failed to parse CSV: ' + e.message);
    }
  }, [buildFromRows]);

  // Parse and open preview dialog (used for user-uploaded files)
  const openPreview = useCallback((text: string, filename?: string) => {
    try {
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error('No data found in CSV');
        return;
      }

      const issues: string[] = [];
      const hasItem = rows.some(r => r.Item);
      const hasItemDesc = rows.some(r => r.ItemDesc);
      const hasLevel = rows.some(r => typeof r.Level === 'number' && !Number.isNaN(r.Level));
      const hasParent = rows.some(r => r.Parent);
      const hasPath = rows.some(r => r.Path);

      if (!hasItem) issues.push('Item');
      if (!hasItemDesc) issues.push('ItemDesc');
      if (!hasLevel) issues.push('Level');
      if (!hasParent) issues.push('Parent');
      if (!hasPath) issues.push('Path');

      setPreviewIssues(issues);
      setPreviewData({ rows, filename });
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error('Failed to parse CSV: ' + e.message);
    }
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => openPreview(ev.target?.result as string, file.name);
    reader.readAsText(file);
  }, [openPreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => openPreview(ev.target?.result as string, file.name);
    reader.readAsText(file);
  }, [openPreview]);

  // Graph actions
  const onToggle = useCallback((seq: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(seq)) {
        next.delete(seq);
        if (tree) {
          const removeDesc = (s: string) => {
            const children = tree.childrenMap.get(s) || [];
            for (const c of children) { next.delete(c.Seq); removeDesc(c.Seq); }
          };
          removeDesc(seq);
        }
      } else {
        if (tree) {
          const visited = new Set<string>();
          let current: string | undefined = seq;
          let hasCycle = false;
          while (current) {
            if (visited.has(current)) { hasCycle = true; break; }
            visited.add(current);
            current = tree.parentMap.get(current);
          }
          if (hasCycle) { toast.error('Loop detected! Cannot expand this node.'); return prev; }
        }
        next.add(seq);
      }
      return next;
    });
    // Auto-center on the toggled node
    setFocusedNode(seq);
  }, [tree]);

  const onSelect = useCallback((seq: string) => { setSelectedNode(seq); }, []);
  const onDoubleClick = useCallback((seq: string) => {
    setFocusedNode(seq);
    setExpandedNodes(prev => new Set(prev).add(seq));
  }, []);
  const onUnfocus = useCallback(() => { setFocusedNode(null); }, []);
  const onOpenBrowser = useCallback((seq: string) => { setBrowserParent(seq); }, []);

  const onSearchSelect = useCallback((seq: string) => {
    if (!tree) return;
    const pathSeqs = expandPathToNode(tree, seq);
    setExpandedNodes(prev => {
      const next = new Set(prev);
      for (const s of pathSeqs) next.add(s);
      next.add(seq);
      return next;
    });
    setFocusedNode(seq);
    setSelectedNode(seq);
  }, [tree]);

  const onBrowserChildSelect = useCallback((seq: string) => {
    if (!tree) return;
    const pathSeqs = expandPathToNode(tree, seq);
    setExpandedNodes(prev => {
      const next = new Set(prev);
      for (const s of pathSeqs) next.add(s);
      next.add(seq);
      return next;
    });
    setFocusedNode(seq);
    setSelectedNode(seq);
  }, [tree]);

  const onBreadcrumbNavigate = useCallback((seq: string) => {
    setFocusedNode(seq);
    setExpandedNodes(prev => new Set(prev).add(seq));
    setSelectedNode(seq);
  }, []);

  // Add to warehouse
  const handleAddToWarehouse = useCallback(() => {
    if (!tree || checkedItems.size === 0) return;
    const items = Array.from(checkedItems).map(seq => {
      const row = tree.rowBySeq.get(seq);
      return row ? {
        item_code: row.Item,
        item_desc: row.ItemDesc,
        created_from_bom: true,
        source_project: tree.roots[0]?.Item || '',
      } : null;
    }).filter(Boolean) as { item_code: string; item_desc: string; created_from_bom: boolean; source_project: string }[];

    const added = addCatalogItems(items);
    toast.success(`Added ${added} items to Warehouse catalog. ${items.length - added > 0 ? `${items.length - added} already existed.` : ''} Quantities are managed in the Warehouse.`);
    setCheckedItems(new Set());
    setSelectMode(false);
    onWarehouseRefresh?.();
  }, [tree, checkedItems, onWarehouseRefresh]);

  const toggleCheck = useCallback((seq: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq); else next.add(seq);
      return next;
    });
  }, []);

  // Derive graph
  const { graphNodes, graphEdges } = useMemo(() => {
    if (!tree || !selectedRoot) return { graphNodes: [], graphEdges: [] };
    const { nodes, edges } = deriveGraph(tree, selectedRoot, expandedNodes, focusedNode);
    return { graphNodes: nodes, graphEdges: edges };
  }, [tree, selectedRoot, expandedNodes, focusedNode]);

  const selectedRow = tree && selectedNode ? tree.rowBySeq.get(selectedNode) || null : null;
  const browserParentRow = tree && browserParent ? tree.rowBySeq.get(browserParent) || null : null;
  const browserChildren = tree && browserParent ? tree.childrenMap.get(browserParent) || [] : [];

  // Upload screen
  if (!tree) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-8"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="text-center max-w-xl space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 animate-float">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">BOM WOW Explorer</h1>
            <p className="text-muted-foreground">
              Visualize your Bill of Materials as an interactive graph and connect it to your Warehouse.
            </p>
          </div>

          <div className="bg-muted/40 border border-border rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              What can you do here?
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Upload a BOM CSV exported from your ERP.</li>
              <li>Explore the structure as an interactive graph or table.</li>
              <li>Select items and send them to the Warehouse catalog.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Drop CSV here or <span className="text-primary">click to browse</span>
              </p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                Expected columns (case-insensitive): Seq, Level, Item, ItemDesc, Parent, ParentDesc, QtyPerParent, CumQty, Path, HasChildren
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <Button
              variant="outline"
              className="w-full border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => loadCSV(DEMO_CSV, { filename: 'Demo: Mountain Bike BOM' })}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Load Demo Data (Mountain Bike BOM)
            </Button>
          </div>

          <div className="bg-card/60 border border-dashed border-primary/30 rounded-lg p-3 text-left text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Demo tips</p>
            <p>
              The demo BOM is a complete Mountain Bike assembly. Use it to try the graph, focus mode, search
              and the &quot;Select for Warehouse&quot; flow before connecting your own data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card/50 shrink-0">
        <Zap className="w-5 h-5 text-primary" />
        <span className="font-bold text-sm text-foreground">BOM WOW</span>
        <div className="w-px h-6 bg-border" />

        {tree.roots.length > 1 && (
          <select
            value={selectedRoot}
            onChange={e => { setSelectedRoot(e.target.value); setExpandedNodes(new Set()); setFocusedNode(null); }}
            className="bg-secondary text-foreground text-sm rounded-md px-2 py-1 border border-border"
          >
            {tree.roots.map(r => (
              <option key={r.Seq} value={r.Seq}>{r.Item} – {r.ItemDesc}</option>
            ))}
          </select>
        )}

        <Badge variant="secondary" className="text-xs">{tree.rows.length} items</Badge>

        {fileInfo && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground ml-2">
            <span className="max-w-[160px] truncate" title={fileInfo.name}>{fileInfo.name}</span>
            <span>• {fileInfo.rowCount} rows</span>
            <span>• loaded {new Date(fileInfo.loadedAt).toLocaleTimeString()}</span>
          </div>
        )}

        {focusedNode && (
          <>
            <div className="w-px h-6 bg-border" />
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Focus Mode</Badge>
            <Button size="sm" variant="ghost" onClick={onUnfocus} className="text-xs text-muted-foreground">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back to tree
            </Button>
          </>
        )}

        <div className="flex-1" />

        {/* Select mode for warehouse */}
        <Button
          size="sm"
          variant={selectMode ? 'default' : 'outline'}
          onClick={() => { setSelectMode(!selectMode); if (selectMode) setCheckedItems(new Set()); }}
          className="gap-1"
        >
          <PackagePlus className="w-4 h-4" />
          {selectMode ? `Selected (${checkedItems.size})` : 'Select for Warehouse'}
        </Button>

        {selectMode && checkedItems.size > 0 && (
          <Button size="sm" onClick={handleAddToWarehouse} className="gap-1">
            <PackagePlus className="w-4 h-4" /> Add to Warehouse
          </Button>
        )}

        <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)} className="gap-2">
          <Search className="w-4 h-4" /> Search
          <kbd className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">⌘K</kbd>
        </Button>

        <Button size="sm" variant="ghost" onClick={() => { setTree(null); }} className="text-muted-foreground">
          New File
        </Button>
      </div>

      {/* Select mode: item list with checkboxes */}
      {selectMode && (
        <div className="border-b border-border bg-card/30 px-4 py-2 flex items-center gap-4 overflow-x-auto">
          <span className="text-xs text-muted-foreground shrink-0">Check items to add to Warehouse catalog:</span>
          <div className="flex flex-wrap gap-2">
            {tree.rows.slice(0, 200).map(row => (
              <label
                key={row.Seq}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border hover:bg-accent cursor-pointer text-xs"
              >
                <Checkbox
                  checked={checkedItems.has(row.Seq)}
                  onCheckedChange={() => toggleCheck(row.Seq)}
                />
                <span className="font-mono text-foreground">{row.Item}</span>
              </label>
            ))}
            {tree.rows.length > 200 && <span className="text-xs text-muted-foreground">+{tree.rows.length - 200} more (use search)</span>}
          </div>
        </div>
      )}

      {/* Graph */}
      <div className="flex-1">
        <BomGraph
          graphNodes={graphNodes}
          graphEdges={graphEdges}
          centerNodeId={focusedNode || selectedRoot}
          onToggle={onToggle}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          onOpenBrowser={onOpenBrowser}
        />
      </div>

      {/* Panels */}
      <BomSidePanel
        open={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        row={selectedRow}
        tree={tree}
        selectedSeq={selectedNode}
        onNavigate={onBreadcrumbNavigate}
      />

      <BomChildrenBrowser
        open={!!browserParent}
        onClose={() => setBrowserParent(null)}
        parentRow={browserParentRow}
        children={browserChildren}
        onSelectChild={onBrowserChildSelect}
      />

      <BomSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        rows={tree.rows}
        onSelect={onSearchSelect}
      />

      {/* CSV preview dialog */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewData(null);
            setPreviewIssues([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review CSV before import</DialogTitle>
            <DialogDescription>
              Check that the columns look correct before building the BOM graph.
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {previewData.filename && (
                  <span className="max-w-[220px] truncate" title={previewData.filename}>
                    File: <span className="font-mono text-foreground">{previewData.filename}</span>
                  </span>
                )}
                <span>{previewData.rows.length} data rows</span>
              </div>

              {previewIssues.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
                  <p className="font-medium">Some required BOM fields look empty.</p>
                  <p>
                    Missing data for: {previewIssues.join(', ')}. Please check that your CSV includes these columns
                    (case-insensitive) before continuing.
                  </p>
                </div>
              )}

              <div className="border rounded-md max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Seq</TableHead>
                      <TableHead className="w-16">Level</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Parent Desc</TableHead>
                      <TableHead className="w-24">Qty/Parent</TableHead>
                      <TableHead className="w-24">Cum Qty</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead className="w-20">HasChildren</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.slice(0, 8).map(row => (
                      <TableRow key={row.Seq}>
                        <TableCell className="font-mono text-xs">{row.Seq}</TableCell>
                        <TableCell className="text-xs">{row.Level}</TableCell>
                        <TableCell className="font-mono text-xs">{row.Item}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.ItemDesc}</TableCell>
                        <TableCell className="font-mono text-xs">{row.Parent}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.ParentDesc}</TableCell>
                        <TableCell className="text-xs">{row.QtyPerParent}</TableCell>
                        <TableCell className="text-xs">{row.CumQty}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{row.Path}</TableCell>
                        <TableCell className="text-xs">{row.HasChildren ? 'true' : 'false'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Showing up to 8 example rows. If everything looks good, continue to build the interactive BOM graph.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setPreviewOpen(false);
                setPreviewData(null);
                setPreviewIssues([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!previewData || previewIssues.length > 0}
              onClick={() => {
                if (!previewData) return;
                buildFromRows(previewData.rows, { filename: previewData.filename });
                setPreviewOpen(false);
                setPreviewData(null);
                setPreviewIssues([]);
              }}
            >
              Use this file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
