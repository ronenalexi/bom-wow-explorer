import React, { useState, useCallback, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CentralWarehouse from './CentralWarehouse';
import LocationsManager from './LocationsManager';
import WarehouseDashboard from './WarehouseDashboard';
import TransferHistory from './TransferHistory';
import { Package, MapPin, LayoutDashboard, History, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadWarehouseJSON, importWarehouseData } from '@/lib/warehouseExport';
import { toast } from 'sonner';

export default function WarehouseModule() {
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = useCallback(() => setRefreshKey(k => k + 1), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadWarehouseJSON();
    toast.success('Warehouse data exported');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importWarehouseData(reader.result as string);
      if (result.success) {
        toast.success(`Imported: ${result.stats?.catalog} items, ${result.stats?.serials} serials, ${result.stats?.locations} locations`);
        onRefresh();
      } else {
        toast.error(result.error || 'Import failed');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="dashboard" className="flex-1 flex flex-col">
        <div className="border-b border-border px-4 flex items-center">
          <TabsList className="bg-transparent h-12 flex-1">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-primary/10">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="central" className="gap-2 data-[state=active]:bg-primary/10">
              <Package className="w-4 h-4" /> Central Warehouse
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2 data-[state=active]:bg-primary/10">
              <MapPin className="w-4 h-4" /> Locations
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary/10">
              <History className="w-4 h-4" /> History
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1.5 ml-2">
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5 h-8">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5 h-8">
              <Upload className="w-3.5 h-3.5" /> Import
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
        </div>
        <TabsContent value="dashboard" className="flex-1 mt-0">
          <WarehouseDashboard refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="central" className="flex-1 mt-0">
          <CentralWarehouse onRefresh={onRefresh} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="locations" className="flex-1 mt-0">
          <LocationsManager onRefresh={onRefresh} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="history" className="flex-1 mt-0">
          <TransferHistory refreshKey={refreshKey} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
