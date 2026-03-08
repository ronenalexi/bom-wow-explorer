import React, { useState, useCallback, useMemo } from 'react';
import {
  getCatalog, updateCatalogItem, getCentralQty, setCentralQty,
  getSerialsAtLocation, addSerialUnits, isItemInLocations, deleteCatalogItem,
  addCatalogItems, getLocationInventory, getSerials, type CatalogItem,
} from '@/lib/warehouse';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Plus, Package, Hash, Trash2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

interface Props {
  onRefresh: () => void;
  refreshKey: number;
}

export default function CentralWarehouse({ onRefresh, refreshKey }: Props) {
  const [search, setSearch] = useState('');
  const [addSerialDialog, setAddSerialDialog] = useState<string | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ item_code: string; inLocations: boolean } | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({ item_code: '', item_desc: '' });

  const catalog = useMemo(() => getCatalog(), [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter(c => c.item_code.toLowerCase().includes(q) || c.item_desc.toLowerCase().includes(q));
  }, [catalog, search]);

  const handleQtyChange = useCallback((item_code: string, val: string) => {
    const qty = Math.max(0, parseInt(val) || 0);
    setCentralQty(item_code, qty);
    onRefresh();
  }, [onRefresh]);

  const toggleSerialized = useCallback((item_code: string, checked: boolean) => {
    updateCatalogItem(item_code, { is_serialized: checked });
    onRefresh();
  }, [onRefresh]);

  const handleAddSerials = useCallback(() => {
    if (!addSerialDialog || !serialInput.trim()) return;
    const numbers = serialInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (numbers.length === 0) return;
    const { added, duplicates } = addSerialUnits(addSerialDialog, numbers);
    if (added > 0) toast.success(`Added ${added} serial(s)`);
    if (duplicates.length > 0) toast.warning(`Skipped duplicates: ${duplicates.join(', ')}`);
    setAddSerialDialog(null);
    setSerialInput('');
    onRefresh();
  }, [addSerialDialog, serialInput, onRefresh]);

  const handleDeleteClick = useCallback((item_code: string) => {
    const inLocations = isItemInLocations(item_code);
    setDeleteConfirm({ item_code, inLocations });
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteConfirm) return;
    deleteCatalogItem(deleteConfirm.item_code);
    toast.success(`Item ${deleteConfirm.item_code} deleted`);
    setDeleteConfirm(null);
    onRefresh();
  }, [deleteConfirm, onRefresh]);

  const handleAddItem = useCallback(() => {
    const code = newItem.item_code.trim();
    const desc = newItem.item_desc.trim();
    if (!code) { toast.error('Item code is required'); return; }
    if (!desc) { toast.error('Description is required'); return; }
    const catalog = getCatalog();
    if (catalog.some(c => c.item_code === code)) { toast.error(`Item "${code}" already exists`); return; }
    addCatalogItems([{ item_code: code, item_desc: desc, created_from_bom: false, source_project: '' }]);
    toast.success(`Item "${code}" added`);
    setNewItem({ item_code: '', item_desc: '' });
    setAddItemOpen(false);
    onRefresh();
  }, [newItem, onRefresh]);

  if (catalog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="max-w-md w-full border border-dashed border-border rounded-2xl p-6 text-center bg-card/60">
          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Your Warehouse catalog is empty</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Start by importing items from a BOM or by creating items manually. Once items are here, you can manage
            quantities, serial numbers, and locations.
          </p>
          <div className="space-y-2">
            <Button
              size="sm"
              className="w-full justify-center gap-2"
              onClick={() => toast.info('Go to the BOM Explorer tab and use \"Select for Warehouse\" to add items.')}
            >
              Import items from BOM Explorer
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Tip: In BOM Explorer, switch to &quot;Select for Warehouse&quot; mode to choose which BOM items become
              part of this catalog.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <h2 className="font-bold text-foreground text-lg">Central Warehouse</h2>
        <Badge variant="secondary">{catalog.length} items</Badge>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAddItemOpen(true)}>
          <PlusCircle className="w-4 h-4" /> Add Item
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24 text-center">Serialized</TableHead>
              <TableHead className="w-32 text-center">Qty On Hand</TableHead>
              <TableHead className="w-24 text-center">Total</TableHead>
              <TableHead className="w-20">Source</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(item => {
              const isSer = item.is_serialized;
              const centralSerials = isSer ? getSerialsAtLocation(item.item_code, 'CENTRAL') : [];
              const centralQty = isSer ? centralSerials.length : getCentralQty(item.item_code);

              // Calculate total across all locations
              let totalQty: number;
              if (isSer) {
                totalQty = getSerials().filter(u => u.item_code === item.item_code).length;
              } else {
                const locQty = getLocationInventory()
                  .filter(e => e.item_code === item.item_code)
                  .reduce((sum, e) => sum + e.qty, 0);
                totalQty = centralQty + locQty;
              }

              // Color logic for Qty On Hand
              const qtyColor = totalQty === 0 ? 'text-foreground'
                : centralQty === 0 ? 'text-destructive'
                : centralQty < totalQty ? 'text-amber-500'
                : 'text-foreground';

              return (
                <TableRow key={item.item_code}>
                  <TableCell className="font-mono font-bold text-foreground">{item.item_code}</TableCell>
                  <TableCell className="text-muted-foreground">{item.item_desc}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={item.is_serialized}
                      onCheckedChange={(checked) => toggleSerialized(item.item_code, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {isSer ? (
                      <div className="space-y-1">
                        <Badge variant="outline" className={`text-xs ${qtyColor}`}>{centralQty} units</Badge>
                        {centralSerials.slice(0, 3).map(s => (
                          <div key={s.serial_id} className="text-xs text-muted-foreground font-mono">{s.serial_number}</div>
                        ))}
                        {centralSerials.length > 3 && <div className="text-xs text-muted-foreground">+{centralSerials.length - 3} more</div>}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          className={`w-20 text-center mx-auto ${qtyColor}`}
                          value={centralQty}
                          onChange={e => handleQtyChange(item.item_code, e.target.value)}
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-mono font-semibold text-muted-foreground">
                      {totalQty}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.created_from_bom ? (
                      <Badge variant="secondary" className="text-xs">BOM</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Manual</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isSer && (
                        <Button size="sm" variant="outline" onClick={() => setAddSerialDialog(item.item_code)} className="gap-1">
                          <Plus className="w-3 h-3" /> Add S/N
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteClick(item.item_code)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add Serial Dialog */}
      <Dialog open={!!addSerialDialog} onOpenChange={() => { setAddSerialDialog(null); setSerialInput(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-4 h-4" /> Add Serial Numbers
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Item: <span className="font-mono font-bold text-foreground">{addSerialDialog}</span></p>
          <p className="text-xs text-muted-foreground">Enter serial numbers separated by commas, semicolons, or new lines.</p>
          <textarea
            className="w-full h-32 rounded-md border border-input bg-background p-3 text-sm font-mono"
            placeholder="SN001&#10;SN002&#10;SN003"
            value={serialInput}
            onChange={e => setSerialInput(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddSerialDialog(null); setSerialInput(''); }}>Cancel</Button>
            <Button onClick={handleAddSerials}>Add Serials</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.inLocations
                ? `⚠️ Item "${deleteConfirm.item_code}" is currently assigned to one or more locations. Deleting it will remove it from all locations as well. Are you sure?`
                : `Are you sure you want to delete "${deleteConfirm?.item_code}" from the catalog?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={(open) => { setAddItemOpen(open); if (!open) setNewItem({ item_code: '', item_desc: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Add New Item
            </DialogTitle>
            <DialogDescription>Add a new item manually to the catalog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-item-code">Item Code</Label>
              <Input id="new-item-code" placeholder="e.g. CABLE-HDMI-2M" value={newItem.item_code} onChange={e => setNewItem(p => ({ ...p, item_code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-item-desc">Description</Label>
              <Input id="new-item-desc" placeholder="e.g. HDMI Cable 2 meters" value={newItem.item_desc} onChange={e => setNewItem(p => ({ ...p, item_desc: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddItemOpen(false); setNewItem({ item_code: '', item_desc: '' }); }}>Cancel</Button>
            <Button onClick={handleAddItem}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
