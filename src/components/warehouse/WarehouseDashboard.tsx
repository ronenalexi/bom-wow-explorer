import React, { useMemo } from 'react';
import { getCatalog, getCentralInventory, getSerials, getLocations, getLocationInventory } from '@/lib/warehouse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, MapPin, Hash } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props { refreshKey: number; }

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--accent))',
  'hsl(220, 70%, 55%)', 'hsl(150, 60%, 45%)', 'hsl(30, 80%, 55%)',
  'hsl(280, 60%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(180, 50%, 45%)',
];

export default function WarehouseDashboard({ refreshKey }: Props) {
  const stats = useMemo(() => {
    const catalog = getCatalog();
    const centralInv = getCentralInventory();
    const serials = getSerials();
    const locations = getLocations();
    const locInv = getLocationInventory();

    const totalItems = catalog.length;
    const serializedItems = catalog.filter(c => c.is_serialized).length;
    const totalSerials = serials.length;

    // Total bulk units (central + locations)
    const centralBulkQty = centralInv.reduce((s, e) => s + e.qty_on_hand, 0);
    const locBulkQty = locInv.reduce((s, e) => s + e.qty, 0);
    const totalBulkUnits = centralBulkQty + locBulkQty;

    // Items with 0 central stock but exist somewhere
    const zeroStockItems = catalog.filter(c => {
      if (c.is_serialized) {
        const centralSerials = serials.filter(s => s.item_code === c.item_code && s.current_location_id === 'CENTRAL');
        const totalSerials = serials.filter(s => s.item_code === c.item_code);
        return centralSerials.length === 0 && totalSerials.length > 0;
      } else {
        const central = centralInv.find(e => e.item_code === c.item_code)?.qty_on_hand ?? 0;
        const locQty = locInv.filter(e => e.item_code === c.item_code).reduce((s, e) => s + e.qty, 0);
        return central === 0 && locQty > 0;
      }
    });

    // Distribution by location
    const locDistribution = locations.map(loc => {
      const bulkQty = locInv.filter(e => e.location_id === loc.location_id).reduce((s, e) => s + e.qty, 0);
      const serialQty = serials.filter(s => s.current_location_id === loc.location_id).length;
      return { name: loc.name, value: bulkQty + serialQty, type: loc.type };
    }).filter(l => l.value > 0);

    // Central portion
    const centralTotal = centralBulkQty + serials.filter(s => s.current_location_id === 'CENTRAL').length;

    const pieData = [
      { name: 'Central', value: centralTotal },
      ...locDistribution,
    ].filter(d => d.value > 0);

    return {
      totalItems, serializedItems, totalSerials, totalBulkUnits,
      centralBulkQty, locBulkQty, zeroStockItems,
      locations: locations.length, pieData, locDistribution, centralTotal,
    };
  }, [refreshKey]);

  return (
    <div className="flex flex-col h-full overflow-auto p-4 gap-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Package} label="Catalog Items" value={stats.totalItems} />
        <SummaryCard icon={Hash} label="Serial Units" value={stats.totalSerials} />
        <SummaryCard icon={MapPin} label="Locations" value={stats.locations} />
        <SummaryCard
          icon={AlertTriangle}
          label="Zero Central Stock"
          value={stats.zeroStockItems.length}
          variant={stats.zeroStockItems.length > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Distribution Pie */}
        {stats.pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stock Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {stats.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {stats.pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-mono font-semibold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location Bar Chart */}
        {stats.locDistribution.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Units by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.locDistribution} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Zero Stock Alerts */}
      {stats.zeroStockItems.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-4 h-4" /> Items with No Central Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.zeroStockItems.map(item => (
                <Badge key={item.item_code} variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-500">
                  {item.item_code}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.totalItems === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No data yet. Add items to the catalog to see the dashboard.
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, variant = 'default' }: {
  icon: React.ElementType; label: string; value: number; variant?: 'default' | 'warning';
}) {
  return (
    <Card className={variant === 'warning' && value > 0 ? 'border-amber-500/30' : ''}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${variant === 'warning' && value > 0 ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
          <Icon className={`w-5 h-5 ${variant === 'warning' && value > 0 ? 'text-amber-500' : 'text-primary'}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
