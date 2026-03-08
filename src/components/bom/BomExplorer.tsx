import React, { useState, useCallback, useMemo, useRef } from 'react';
import { parseCSV, buildTree, deriveGraph, expandPathToNode, DEMO_CSV, type TreeData, type BomRow } from '@/lib/bom';
import { addCatalogItems } from '@/lib/warehouse';
import BomGraph from './BomGraph';
import { BomSidePanel, BomChildrenBrowser, BomSearchDialog } from './BomPanels';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  const fileRef = useRef<HTMLInputElement>(null);

  // Load CSV
  const loadCSV = useCallback((text: string) => {
    try {
      const rows = parseCSV(text);
      if (rows.length === 0) { toast.error('No data found in CSV'); return; }
      const t = buildTree(rows);
      setTree(t);
      setSelectedRoot(t.roots[0]?.Seq || '');
      setExpandedNodes(new Set());
      setSelectedNode(null);
      setFocusedNode(null);
      setCheckedItems(new Set());
      toast.success(`Loaded ${rows.length} items`);
    } catch (e: any) {
      toast.error('Failed to parse CSV: ' + e.message);
    }
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadCSV(ev.target?.result as string);
    reader.readAsText(file);
  }, [loadCSV]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadCSV(ev.target?.result as string);
    reader.readAsText(file);
  }, [loadCSV]);

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
        <div className="text-center max-w-lg">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 animate-float">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">BOM WOW Explorer</h1>
          <p className="text-muted-foreground mb-8">
            Visualize your Bill of Materials as an interactive graph. Upload a CSV from Priority ERP or try the demo.
          </p>
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Drop CSV here or <span className="text-primary">click to browse</span>
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Columns: Seq, Level, Item, ItemDesc, Parent, ParentDesc, QtyPerParent, CumQty, Path, HasChildren
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <Button
              variant="outline"
              className="w-full border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => loadCSV(DEMO_CSV)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Load Demo Data (Mountain Bike BOM)
            </Button>
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
    </div>
  );
}
