// Warehouse data export/import utilities

import { getCatalog, saveCatalog, getCentralInventory, saveCentralInventory, getSerials, saveSerials, getLocations, saveLocations, getLocationInventory, saveLocationInventory } from './warehouse';
import { getTransferLog } from './warehouseHistory';

interface WarehouseSnapshot {
  version: 1;
  exportedAt: string;
  catalog: ReturnType<typeof getCatalog>;
  centralInventory: ReturnType<typeof getCentralInventory>;
  serials: ReturnType<typeof getSerials>;
  locations: ReturnType<typeof getLocations>;
  locationInventory: ReturnType<typeof getLocationInventory>;
  transferLog: ReturnType<typeof getTransferLog>;
}

export function exportWarehouseData(): string {
  const snapshot: WarehouseSnapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    catalog: getCatalog(),
    centralInventory: getCentralInventory(),
    serials: getSerials(),
    locations: getLocations(),
    locationInventory: getLocationInventory(),
    transferLog: getTransferLog(),
  };
  return JSON.stringify(snapshot, null, 2);
}

export function downloadWarehouseJSON() {
  const data = exportWarehouseData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importWarehouseData(json: string): { success: boolean; error?: string; stats?: Record<string, number> } {
  try {
    const data = JSON.parse(json) as WarehouseSnapshot;
    if (!data.version || !data.catalog) {
      return { success: false, error: 'Invalid backup file format' };
    }
    saveCatalog(data.catalog);
    saveCentralInventory(data.centralInventory || []);
    saveSerials(data.serials || []);
    saveLocations(data.locations || []);
    saveLocationInventory(data.locationInventory || []);
    // Transfer log
    if (data.transferLog?.length) {
      localStorage.setItem('wh_transfer_log', JSON.stringify(data.transferLog));
    }
    return {
      success: true,
      stats: {
        catalog: data.catalog.length,
        serials: (data.serials || []).length,
        locations: (data.locations || []).length,
      },
    };
  } catch {
    return { success: false, error: 'Failed to parse backup file' };
  }
}
