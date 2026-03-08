import React, { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChevronRight, Search, ArrowUpDown, Leaf, FolderTree, X, PackagePlus } from 'lucide-react';
import type { BomRow, TreeData } from '@/lib/bom';
import { getAncestors } from '@/lib/bom';
import { addCatalogItems, getCatalog } from '@/lib/warehouse';
import { toast } from 'sonner';

// --- Side Panel ---
interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  row: BomRow | null;
  tree: TreeData;
  selectedSeq: string | null;
  onNavigate: (seq: string) => void;
  onWarehouseRefresh?: () => void;
}

export function BomSidePanel({ open, onClose, row, tree, selectedSeq, onNavigate, onWarehouseRefresh }: SidePanelProps) {
  const ancestors = useMemo(() => {
    if (!selectedSeq || !tree) return [];
    return getAncestors(tree, selectedSeq);
  }, [selectedSeq, tree]);

  if (!row) return null;

  const fields = [
    { label: 'Item', value: row.Item },
    { label: 'Description', value: row.ItemDesc },
    { label: 'Parent', value: row.Parent },
    { label: 'Parent Desc', value: row.ParentDesc },
    { label: 'Level', value: String(row.Level) },
    { label: 'Qty/Parent', value: String(row.QtyPerParent) },
    { label: 'Cum Qty', value: String(row.CumQty) },
    { label: 'Path', value: row.Path },
    { label: 'Has Children', value: row.HasChildren ? 'Yes' : 'No' },
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[380px] bg-card border-border flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="text-primary font-mono">{row.Item}</SheetTitle>
        </SheetHeader>

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 mt-4 mb-4">
          {ancestors.map((a, i) => (
            <React.Fragment key={a.Seq}>
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <button
                onClick={() => onNavigate(a.Seq)}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  a.Seq === selectedSeq
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {a.Item}
              </button>
            </React.Fragment>
          ))}
        </div>

        <Separator className="bg-border" />

        <ScrollArea className="flex-1 mt-4 overflow-hidden">
          <div className="space-y-3">
            {fields.map(f => (
              <div key={f.label}>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{f.label}</div>
                <div className="text-sm text-foreground mt-0.5 font-mono">{f.value || '—'}</div>
              </div>
            ))}
          </div>

          {/* Add to Warehouse */}
          {row && (() => {
            const alreadyInCatalog = getCatalog().some(c => c.item_code === row.Item);
            return (
              <div className="mt-5">
                <Separator className="bg-border mb-4" />
                <Button
                  size="sm"
                  variant={alreadyInCatalog ? 'outline' : 'default'}
                  disabled={alreadyInCatalog}
                  className="w-full gap-2"
                  onClick={() => {
                    const added = addCatalogItems([{
                      item_code: row.Item,
                      item_desc: row.ItemDesc,
                      created_from_bom: true,
                      source_project: tree?.roots[0]?.Item || '',
                    }]);
                    if (added > 0) {
                      toast.success(`"${row.Item}" added to Central Warehouse`);
                      onWarehouseRefresh?.();
                    } else {
                      toast.info(`"${row.Item}" already exists in catalog`);
                    }
                  }}
                >
                  <PackagePlus className="w-4 h-4" />
                  {alreadyInCatalog ? 'Already in Warehouse' : 'Add to Central Warehouse'}
                </Button>
              </div>
            );
          })()}
          {row.HasChildren && selectedSeq && tree && (() => {
            const directChildren = tree.childrenMap.get(selectedSeq) || [];
            return directChildren.length > 0 ? (
              <div className="mt-6">
                <Separator className="bg-border mb-4" />
                <div className="flex items-center gap-2 mb-3">
                  <FolderTree className="w-4 h-4 text-primary" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Direct Children
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{directChildren.length}</Badge>
                </div>
                <div className="space-y-1">
                  {directChildren.map(c => (
                    <button
                      key={c.Seq}
                      onClick={() => onNavigate(c.Seq)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-secondary/60 transition-colors text-left group"
                    >
                      {c.HasChildren ? (
                        <FolderTree className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      ) : (
                        <Leaf className="w-3.5 h-3.5 text-node-leaf/70 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono text-foreground truncate group-hover:text-primary transition-colors">{c.Item}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{c.ItemDesc}</div>
                      </div>
                      {c.QtyPerParent > 0 && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 bg-accent/15 text-accent border-accent/20">
                          x{c.QtyPerParent}
                        </Badge>
                      )}
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// --- Children Browser ---
type SortKey = 'Item' | 'QtyPerParent' | 'CumQty';
type SortDir = 'asc' | 'desc';

interface ChildrenBrowserProps {
  open: boolean;
  onClose: () => void;
  parentRow: BomRow | null;
  children: BomRow[];
  onSelectChild: (seq: string) => void;
}

export function BomChildrenBrowser({ open, onClose, parentRow, children, onSelectChild }: ChildrenBrowserProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('Item');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let items = children.filter(c =>
      c.Item.toLowerCase().includes(q) || c.ItemDesc.toLowerCase().includes(q)
    );
    items.sort((a, b) => {
      const av = sortKey === 'Item' ? a[sortKey] : Number(a[sortKey]);
      const bv = sortKey === 'Item' ? b[sortKey] : Number(b[sortKey]);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [children, search, sortKey, sortDir]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-card border-border flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-primary">
            Children of <span className="font-mono">{parentRow?.Item}</span>
            <Badge variant="secondary" className="ml-2">{children.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search Item / Description..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 bg-secondary/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>Sort:</span>
          {(['Item', 'QtyPerParent', 'CumQty'] as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => toggleSort(k)}
              className={`px-2 py-1 rounded transition-colors ${sortKey === k ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}
            >
              {k} {sortKey === k && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 mt-3">
          <div className="space-y-1">
            {paged.map(c => (
              <button
                key={c.Seq}
                onClick={() => { onSelectChild(c.Seq); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 transition-colors text-left"
              >
                {c.HasChildren ? (
                  <FolderTree className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <Leaf className="w-4 h-4 text-node-leaf shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono text-foreground truncate">{c.Item}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.ItemDesc}</div>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  x{c.QtyPerParent}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {filtered.length} items · Page {page + 1}/{totalPages}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Global Search ---
interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  rows: BomRow[];
  onSelect: (seq: string) => void;
}

export function BomSearchDialog({ open, onClose, rows, onSelect }: SearchDialogProps) {
  return (
    <CommandDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CommandInput placeholder="Search Item or Description..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Items">
          {rows.slice(0, 100).map(r => (
            <CommandItem
              key={r.Seq}
              value={`${r.Item} ${r.ItemDesc}`}
              onSelect={() => { onSelect(r.Seq); onClose(); }}
              className="flex items-center gap-3"
            >
              {r.HasChildren ? (
                <FolderTree className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <Leaf className="w-4 h-4 text-node-leaf shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm">{r.Item}</span>
                <span className="text-xs text-muted-foreground ml-2">{r.ItemDesc}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">L{r.Level}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
