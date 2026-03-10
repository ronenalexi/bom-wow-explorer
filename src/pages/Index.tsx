import React, { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import BomExplorer from '@/components/bom/BomExplorer';
import WarehouseModule from '@/components/warehouse/WarehouseModule';
import UserMenu from '@/components/UserMenu';
import { Zap, Package } from 'lucide-react';

const Index = () => {
  const [warehouseRefreshKey, setWarehouseRefreshKey] = useState(0);
  const onWarehouseRefresh = useCallback(() => setWarehouseRefreshKey(k => k + 1), []);

  return (
    <div className="h-screen flex flex-col">
      <Tabs defaultValue="bom" className="flex-1 flex flex-col">
        <div className="border-b border-border bg-card/50 px-4 flex items-center">
          <TabsList className="bg-transparent h-12 flex-1">
            <TabsTrigger value="bom" className="gap-2 data-[state=active]:bg-primary/10">
              <Zap className="w-4 h-4" /> BOM Explorer
            </TabsTrigger>
            <TabsTrigger value="warehouse" className="gap-2 data-[state=active]:bg-primary/10">
              <Package className="w-4 h-4" /> Warehouse
            </TabsTrigger>
          </TabsList>
          <UserMenu />
        </div>
        <TabsContent value="bom" className="flex-1 mt-0">
          <BomExplorer onWarehouseRefresh={onWarehouseRefresh} />
        </TabsContent>
        <TabsContent value="warehouse" className="flex-1 mt-0" forceMount>
          <WarehouseModule key={warehouseRefreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
