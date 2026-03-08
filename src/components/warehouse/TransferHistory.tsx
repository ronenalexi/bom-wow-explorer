import React, { useMemo, useState } from 'react';
import { getTransferLog, clearTransferLog } from '@/lib/warehouseHistory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props { refreshKey: number; onRefresh: () => void; }

export default function TransferHistory({ refreshKey, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);

  const log = useMemo(() => getTransferLog(), [refreshKey]);

  const filtered = useMemo(() => {
    if (!search) return log;
    const q = search.toLowerCase();
    return log.filter(e =>
      e.item_code.toLowerCase().includes(q) ||
      e.from.toLowerCase().includes(q) ||
      e.to.toLowerCase().includes(q)
    );
  }, [log, search]);

  const handleClear = () => {
    clearTransferLog();
    setClearConfirm(false);
    onRefresh();
    toast.success('Transfer history cleared');
  };

  if (log.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-8">
        <p>No transfer history yet.</p>
        <p className="text-xs">Transfers between Central Warehouse and locations will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <h2 className="font-bold text-foreground text-lg">Transfer History</h2>
        <Badge variant="secondary">{log.length} entries</Badge>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setClearConfirm(true)}>
          <Trash2 className="w-3 h-3" /> Clear
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Date</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="w-20 text-center">Qty</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="w-20">Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(entry => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono font-bold text-foreground text-sm">{entry.item_code}</TableCell>
                <TableCell className="text-center">{entry.qty}</TableCell>
                <TableCell className="text-sm">{entry.from}</TableCell>
                <TableCell className="text-sm">{entry.to}</TableCell>
                <TableCell>
                  <Badge variant={entry.type === 'serial' ? 'default' : 'secondary'} className="text-xs">
                    {entry.type}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Transfer History?</DialogTitle>
            <DialogDescription>This will permanently delete all {log.length} log entries.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClear}>Clear All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
