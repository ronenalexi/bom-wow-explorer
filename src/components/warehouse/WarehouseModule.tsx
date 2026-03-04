import React, { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CentralWarehouse from './CentralWarehouse';
import LocationsManager from './LocationsManager';
import { Package, MapPin } from 'lucide-react';

export default function WarehouseModule() {
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="central" className="flex-1 flex flex-col">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent h-12">
            <TabsTrigger value="central" className="gap-2 data-[state=active]:bg-primary/10">
              <Package className="w-4 h-4" /> Central Warehouse
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2 data-[state=active]:bg-primary/10">
              <MapPin className="w-4 h-4" /> Locations
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="central" className="flex-1 mt-0">
          <CentralWarehouse onRefresh={onRefresh} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="locations" className="flex-1 mt-0">
          <LocationsManager onRefresh={onRefresh} refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
