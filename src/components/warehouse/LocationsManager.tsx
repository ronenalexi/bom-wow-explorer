import React, { useState, useMemo, useCallback } from 'react';
import {
  getLocations, addLocation, deleteLocation, returnAllFromLocation,
  getLocationItems, transferBulkToLocation, getCatalog, getCentralQty,
  getSerialsAtLocation, moveSerials, type Location, type LocationType,
} from '@/lib/warehouse';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, RotateCcw, MapPin, ArrowLeft, Package, Send, Search } from 'lucide-react';
import { toast } from 'sonner';

const LOCATION_TYPES: LocationType[] = ['Person', 'Department', 'Shipment', 'Overseas', 'Flight Case', 'Other'];

interface Props {
  onRefresh: () => void;
  refreshKey: number;
}

export default function LocationsManager({ onRefresh, refreshKey }: Props) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<LocationType>('Person');
  const [newNotes, setNewNotes] = useState('');
  const [confirmReturnId, setConfirmReturnId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [transferDialogLocId, setTransferDialogLocId] = useState<string | null>(null);
  const [locSearch, setLocSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const locations = useMemo(() => getLocations(), [refreshKey]);
  const filteredLocations = useMemo(() => {
    return locations
      .filter(l => typeFilter === 'all' || l.type === typeFilter)
      .filter(l => !locSearch || l.name.toLowerCase().includes(locSearch.toLowerCase()) || l.notes.toLowerCase().includes(locSearch.toLowerCase()));
  }, [locations, locSearch, typeFilter]);
  const selectedLocation = locations.find(l => l.location_id === selectedLocationId);

  const handleAddLocation = useCallback(() => {
    if (!newName.trim()) { toast.error('Name is required'); return; }
    const loc = addLocation({ name: newName.trim(), type: newType, notes: newNotes.trim() });
    setAddDialogOpen(false);
    setNewName(''); setNewNotes('');
    setSelectedLocationId(loc.location_id);
    onRefresh();
    toast.success(`Location "${loc.name}" created`);
  }, [newName, newType, newNotes, onRefresh]);

  const handleReturnAll = useCallback((locId: string) => {
    const loc = locations.find(l => l.location_id === locId);
    const result = returnAllFromLocation(locId);
    setConfirmReturnId(null);
    onRefresh();
    toast.success(`Returned ${result.bulkItems} bulk items (${result.bulkQty} units) and ${result.serialCount} serials to Central from "${loc?.name}"`);
  }, [locations, onRefresh]);

  const handleDelete = useCallback((locId: string) => {
    const loc = locations.find(l => l.location_id === locId);
    returnAllFromLocation(locId);
    deleteLocation(locId);
    setConfirmDeleteId(null);
    if (selectedLocationId === locId) setSelectedLocationId(null);
    onRefresh();
    toast.success(`"${loc?.name}" deleted. All items returned to Central.`);
  }, [locations, selectedLocationId, onRefresh]);

  // Location details view
  if (selectedLocation) {
    return (
      <LocationDetails
        location={selectedLocation}
        refreshKey={refreshKey}
        onBack={() => setSelectedLocationId(null)}
        onReturnAll={() => setConfirmReturnId(selectedLocation.location_id)}
        onDelete={() => setConfirmDeleteId(selectedLocation.location_id)}
        onTransfer={() => setTransferDialogLocId(selectedLocation.location_id)}
        onRefresh={onRefresh}
        confirmReturnId={confirmReturnId}
        setConfirmReturnId={setConfirmReturnId}
        confirmDeleteId={confirmDeleteId}
        setConfirmDeleteId={setConfirmDeleteId}
        handleReturnAll={handleReturnAll}
        handleDelete={handleDelete}
        transferDialogLocId={transferDialogLocId}
        setTransferDialogLocId={setTransferDialogLocId}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <h2 className="font-bold text-foreground text-lg">Locations</h2>
        <Badge variant="secondary">{locations.length}</Badge>
        <div className="flex-1" />
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Location
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="max-w-md w-full border border-dashed border-border rounded-2xl p-6 text-center bg-card/60 text-muted-foreground space-y-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-base font-medium text-foreground">No locations yet</p>
                <p className="text-sm mt-1">
                  Create locations to track where your equipment and parts are: people, departments, flight cases,
                  shipments and more.
                </p>
              </div>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2 justify-center w-full">
                <Plus className="w-4 h-4" /> Create first location
              </Button>
              <p className="text-[11px]">
                Tip: After you have a location, open it and use &quot;Add Items from Central&quot; to move inventory
                from the Central Warehouse.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map(loc => {
              const items = getLocationItems(loc.location_id);
              const totalQty = items.reduce((s, i) => s + i.qty, 0);
              return (
                <Card
                  key={loc.location_id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedLocationId(loc.location_id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{loc.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">{loc.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{items.length} item types</span>
                      <span>{totalQty} total units</span>
                    </div>
                    {loc.notes && <p className="text-xs text-muted-foreground mt-2 truncate">{loc.notes}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Location Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Location name" value={newName} onChange={e => setNewName(e.target.value)} />
            <Select value={newType} onValueChange={v => setNewType(v as LocationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLocation}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Location Details ──
function LocationDetails({
  location, refreshKey, onBack, onReturnAll, onDelete, onTransfer, onRefresh,
  confirmReturnId, setConfirmReturnId, confirmDeleteId, setConfirmDeleteId,
  handleReturnAll, handleDelete, transferDialogLocId, setTransferDialogLocId,
}: {
  location: Location; refreshKey: number;
  onBack: () => void; onReturnAll: () => void; onDelete: () => void; onTransfer: () => void;
  onRefresh: () => void;
  confirmReturnId: string | null; setConfirmReturnId: (v: string | null) => void;
  confirmDeleteId: string | null; setConfirmDeleteId: (v: string | null) => void;
  handleReturnAll: (id: string) => void; handleDelete: (id: string) => void;
  transferDialogLocId: string | null; setTransferDialogLocId: (v: string | null) => void;
}) {
  const items = useMemo(() => getLocationItems(location.location_id), [location.location_id, refreshKey]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <h2 className="font-bold text-foreground text-lg">{location.name}</h2>
        <Badge variant="outline">{location.type}</Badge>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={onTransfer} className="gap-1">
          <Send className="w-3 h-3" /> Add Items from Central
        </Button>
        <Button size="sm" variant="outline" onClick={onReturnAll} className="gap-1 text-amber-500 border-amber-500/30 hover:bg-amber-500/10">
          <RotateCcw className="w-3 h-3" /> Return All
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
            <Package className="w-12 h-12 opacity-30" />
            <p>No items at this location.</p>
            <Button variant="outline" onClick={onTransfer} className="gap-1 mt-2">
              <Send className="w-3 h-3" /> Add Items from Central Warehouse
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.item_code}>
                  <TableCell className="font-mono font-bold text-foreground">{item.item_code}</TableCell>
                  <TableCell className="text-muted-foreground">{item.item_desc}</TableCell>
                  <TableCell><Badge variant={item.is_serialized ? 'default' : 'secondary'} className="text-xs">{item.is_serialized ? 'Serial' : 'Bulk'}</Badge></TableCell>
                  <TableCell className="text-center">{item.qty}</TableCell>
                  <TableCell>
                    {item.is_serialized && item.serials.map(s => (
                      <div key={s.serial_id} className="text-xs font-mono text-muted-foreground">{s.serial_number}</div>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Confirm Return All */}
      <Dialog open={confirmReturnId === location.location_id} onOpenChange={() => setConfirmReturnId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return All to Central Warehouse?</DialogTitle>
            <DialogDescription>All items from "{location.name}" will be returned to Central Warehouse.</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{items.filter(i => !i.is_serialized).length} bulk item types</p>
            <p>{items.filter(i => !i.is_serialized).reduce((s, i) => s + i.qty, 0)} total bulk units</p>
            <p>{items.filter(i => i.is_serialized).reduce((s, i) => s + i.serials.length, 0)} serial units</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReturnId(null)}>Cancel</Button>
            <Button onClick={() => handleReturnAll(location.location_id)}>Return All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={confirmDeleteId === location.location_id} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location?</DialogTitle>
            <DialogDescription>Deleting "{location.name}" will return all items to Central Warehouse and then delete the location.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(location.location_id)}>Delete & Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <TransferDialog
        open={transferDialogLocId === location.location_id}
        onClose={() => setTransferDialogLocId(null)}
        locationId={location.location_id}
        onRefresh={onRefresh}
      />
    </div>
  );
}

// ── Transfer Dialog ──
function TransferDialog({ open, onClose, locationId, onRefresh }: { open: boolean; onClose: () => void; locationId: string; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());

  const catalog = useMemo(() => getCatalog(), [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catalog.filter(c => c.item_code.toLowerCase().includes(q) || c.item_desc.toLowerCase().includes(q));
  }, [catalog, search]);

  const selectedCat = catalog.find(c => c.item_code === selectedItem);
  const centralSerials = selectedCat?.is_serialized ? getSerialsAtLocation(selectedItem!, 'CENTRAL') : [];
  const centralQty = selectedCat ? (selectedCat.is_serialized ? centralSerials.length : getCentralQty(selectedItem!)) : 0;

  const handleTransfer = useCallback(() => {
    if (!selectedItem || !selectedCat) return;
    if (selectedCat.is_serialized) {
      if (selectedSerials.size === 0) { toast.error('Select at least one serial'); return; }
      moveSerials(Array.from(selectedSerials), locationId);
      toast.success(`Transferred ${selectedSerials.size} serial unit(s)`);
    } else {
      if (transferQty <= 0) { toast.error('Quantity must be > 0'); return; }
      if (!transferBulkToLocation(selectedItem, transferQty, locationId)) {
        toast.error('Not enough quantity in Central Warehouse');
        return;
      }
      toast.success(`Transferred ${transferQty}x ${selectedItem}`);
    }
    setSelectedItem(null);
    setSelectedSerials(new Set());
    setTransferQty(1);
    onRefresh();
    onClose();
  }, [selectedItem, selectedCat, selectedSerials, transferQty, locationId, onRefresh, onClose]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Add Items from Central Warehouse</DialogTitle>
        </DialogHeader>

        {!selectedItem ? (
          <div className="space-y-3">
            <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-64 overflow-auto space-y-1">
              {filtered.map(item => {
                const qty = item.is_serialized ? getSerialsAtLocation(item.item_code, 'CENTRAL').length : getCentralQty(item.item_code);
                return (
                  <div
                    key={item.item_code}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => { setSelectedItem(item.item_code); setTransferQty(1); setSelectedSerials(new Set()); }}
                  >
                    <div>
                      <span className="font-mono font-bold text-sm text-foreground">{item.item_code}</span>
                      <span className="text-sm text-muted-foreground ml-2">{item.item_desc}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{qty} avail</Badge>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items found</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)} className="gap-1">
              <ArrowLeft className="w-3 h-3" /> Back
            </Button>
            <div className="text-sm">
              <span className="font-mono font-bold text-foreground">{selectedItem}</span>
              <span className="text-muted-foreground ml-2">{selectedCat?.item_desc}</span>
            </div>
            <p className="text-sm text-muted-foreground">Available in Central: {centralQty}</p>

            {selectedCat?.is_serialized ? (
              <div className="space-y-1 max-h-48 overflow-auto">
                {centralSerials.map(s => (
                  <label key={s.serial_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={selectedSerials.has(s.serial_id)}
                      onCheckedChange={(checked) => {
                        setSelectedSerials(prev => {
                          const next = new Set(prev);
                          if (checked) next.add(s.serial_id); else next.delete(s.serial_id);
                          return next;
                        });
                      }}
                    />
                    <span className="font-mono text-sm">{s.serial_number}</span>
                  </label>
                ))}
                {centralSerials.length === 0 && <p className="text-sm text-muted-foreground">No serials in Central</p>}
              </div>
            ) : (
              <Input
                type="number"
                min={1}
                max={centralQty}
                value={transferQty}
                onChange={e => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Quantity"
              />
            )}
          </div>
        )}

        {selectedItem && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleTransfer}>Transfer</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
