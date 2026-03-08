import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Tag, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteCatalogItem, updateCatalogItem, isItemInLocations,
  getLocations, transferBulkToLocation, getCentralQty, type Location,
} from '@/lib/warehouse';

interface Props {
  selectedCodes: string[];
  onClear: () => void;
  onRefresh: () => void;
  categories: string[];
}

export default function BulkActionsBar({ selectedCodes, onClear, onRefresh, categories }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [transferLocationId, setTransferLocationId] = useState('');
  const [transferQty, setTransferQty] = useState(1);

  const count = selectedCodes.length;
  if (count === 0) return null;

  const locations: Location[] = getLocations();
  const someInLocations = selectedCodes.some(code => isItemInLocations(code));

  const handleBulkDelete = () => {
    selectedCodes.forEach(code => deleteCatalogItem(code));
    toast.success(`Deleted ${count} item(s)`);
    setDeleteOpen(false);
    onClear();
    onRefresh();
  };

  const handleBulkCategory = () => {
    const cat = bulkCategory.trim();
    selectedCodes.forEach(code => updateCatalogItem(code, { category: cat }));
    toast.success(`Updated category for ${count} item(s)`);
    setCategoryOpen(false);
    setBulkCategory('');
    onClear();
    onRefresh();
  };

  const handleBulkTransfer = () => {
    if (!transferLocationId) { toast.error('Select a location'); return; }
    let transferred = 0;
    selectedCodes.forEach(code => {
      const available = getCentralQty(code);
      const qty = Math.min(transferQty, available);
      if (qty > 0) {
        transferBulkToLocation(code, qty, transferLocationId);
        transferred++;
      }
    });
    toast.success(`Transferred ${transferred} item(s) to location`);
    setTransferOpen(false);
    setTransferLocationId('');
    setTransferQty(1);
    onClear();
    onRefresh();
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-primary/20">
        <Badge variant="secondary" className="font-semibold">{count} selected</Badge>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setCategoryOpen(true)}>
          <Tag className="w-3.5 h-3.5" /> Set Category
        </Button>
        {locations.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setTransferOpen(true)}>
            <Send className="w-3.5 h-3.5" /> Transfer to Location
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={onClear}>
          <X className="w-3.5 h-3.5" /> Clear
        </Button>
      </div>

      {/* Bulk Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} Items</AlertDialogTitle>
            <AlertDialogDescription>
              {someInLocations
                ? `⚠️ Some selected items are assigned to locations. Deleting will remove them from all locations. Are you sure?`
                : `Are you sure you want to delete ${count} item(s) from the catalog?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete {count} Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Category */}
      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Category for {count} Items</DialogTitle>
            <DialogDescription>Choose an existing category or type a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Type category name..."
              value={bulkCategory}
              onChange={e => setBulkCategory(e.target.value)}
            />
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <Button key={c} size="sm" variant={bulkCategory === c ? 'default' : 'outline'} className="text-xs h-7" onClick={() => setBulkCategory(c)}>
                    {c}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkCategory}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Transfer */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer {count} Items to Location</DialogTitle>
            <DialogDescription>Select a target location and quantity per item to transfer from Central.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={transferLocationId} onValueChange={setTransferLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.location_id} value={loc.location_id}>
                    {loc.name} ({loc.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Qty per item:</span>
              <Input
                type="number"
                min={1}
                className="w-24"
                value={transferQty}
                onChange={e => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <p className="text-xs text-muted-foreground">Items with insufficient central stock will transfer only what's available.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkTransfer}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
