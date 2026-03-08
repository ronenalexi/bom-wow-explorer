// Warehouse data layer – localStorage persistence

export interface CatalogItem {
  item_code: string;
  item_desc: string;
  is_serialized: boolean;
  category: string;
  created_from_bom: boolean;
  source_project: string;
}

export interface CentralInventoryEntry {
  item_code: string;
  qty_on_hand: number;
}

export interface SerialUnit {
  serial_id: string;
  item_code: string;
  serial_number: string;
  current_location_id: string; // 'CENTRAL' or a location_id
  status: string;
  notes: string;
}

export type LocationType = 'Person' | 'Department' | 'Shipment' | 'Overseas' | 'Flight Case' | 'Other';

export interface Location {
  location_id: string;
  name: string;
  type: LocationType;
  notes: string;
}

export interface LocationInventoryEntry {
  location_id: string;
  item_code: string;
  qty: number;
}

// ── Keys ──
const KEYS = {
  catalog: 'wh_catalog',
  centralInv: 'wh_central_inv',
  serials: 'wh_serials',
  locations: 'wh_locations',
  locationInv: 'wh_location_inv',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Catalog ──
export function getCatalog(): CatalogItem[] { return load(KEYS.catalog, []); }
export function saveCatalog(items: CatalogItem[]) { save(KEYS.catalog, items); }

export function addCatalogItems(items: Omit<CatalogItem, 'is_serialized' | 'category'>[]): number {
  const catalog = getCatalog();
  const existing = new Set(catalog.map(c => c.item_code));
  let added = 0;
  for (const item of items) {
    if (!existing.has(item.item_code)) {
      catalog.push({ ...item, is_serialized: false, category: '' });
      existing.add(item.item_code);
      added++;
    }
  }
  saveCatalog(catalog);
  return added;
}

export function updateCatalogItem(item_code: string, updates: Partial<CatalogItem>) {
  const catalog = getCatalog();
  const idx = catalog.findIndex(c => c.item_code === item_code);
  if (idx >= 0) { catalog[idx] = { ...catalog[idx], ...updates }; saveCatalog(catalog); }
}

export function isItemInLocations(item_code: string): boolean {
  const locInv = getLocationInventory();
  if (locInv.some(e => e.item_code === item_code && e.qty > 0)) return true;
  const serials = getSerials();
  return serials.some(u => u.item_code === item_code && u.current_location_id !== 'CENTRAL');
}

export function deleteCatalogItem(item_code: string) {
  saveCatalog(getCatalog().filter(c => c.item_code !== item_code));
  saveCentralInventory(getCentralInventory().filter(e => e.item_code !== item_code));
  saveSerials(getSerials().filter(u => u.item_code !== item_code));
  saveLocationInventory(getLocationInventory().filter(e => e.item_code !== item_code));
}

// ── Central Inventory (bulk) ──
export function getCentralInventory(): CentralInventoryEntry[] { return load(KEYS.centralInv, []); }
export function saveCentralInventory(inv: CentralInventoryEntry[]) { save(KEYS.centralInv, inv); }

export function getCentralQty(item_code: string): number {
  const inv = getCentralInventory();
  return inv.find(e => e.item_code === item_code)?.qty_on_hand ?? 0;
}
export function setCentralQty(item_code: string, qty: number) {
  const inv = getCentralInventory();
  const idx = inv.findIndex(e => e.item_code === item_code);
  if (idx >= 0) inv[idx].qty_on_hand = qty;
  else inv.push({ item_code, qty_on_hand: qty });
  saveCentralInventory(inv);
}

// ── Serial Units ──
export function getSerials(): SerialUnit[] { return load(KEYS.serials, []); }
export function saveSerials(units: SerialUnit[]) { save(KEYS.serials, units); }

export function addSerialUnits(item_code: string, serialNumbers: string[]): { added: number; duplicates: string[] } {
  const units = getSerials();
  const existingSet = new Set(units.map(u => `${u.item_code}::${u.serial_number}`));
  const duplicates: string[] = [];
  let added = 0;
  for (const sn of serialNumbers) {
    const key = `${item_code}::${sn}`;
    if (existingSet.has(key)) { duplicates.push(sn); continue; }
    units.push({
      serial_id: crypto.randomUUID(),
      item_code,
      serial_number: sn,
      current_location_id: 'CENTRAL',
      status: 'Active',
      notes: '',
    });
    existingSet.add(key);
    added++;
  }
  saveSerials(units);
  return { added, duplicates };
}

export function getSerialsAtLocation(item_code: string, location_id: string): SerialUnit[] {
  return getSerials().filter(u => u.item_code === item_code && u.current_location_id === location_id);
}

export function moveSerials(serialIds: string[], toLocationId: string) {
  const units = getSerials();
  for (const u of units) {
    if (serialIds.includes(u.serial_id)) u.current_location_id = toLocationId;
  }
  saveSerials(units);
}

// ── Locations ──
export function getLocations(): Location[] { return load(KEYS.locations, []); }
export function saveLocations(locs: Location[]) { save(KEYS.locations, locs); }

export function addLocation(loc: Omit<Location, 'location_id'>): Location {
  const locs = getLocations();
  const newLoc: Location = { ...loc, location_id: crypto.randomUUID() };
  locs.push(newLoc);
  saveLocations(locs);
  return newLoc;
}

export function deleteLocation(location_id: string) {
  const locs = getLocations().filter(l => l.location_id !== location_id);
  saveLocations(locs);
  // Clean up location inventory
  const inv = getLocationInventory().filter(e => e.location_id !== location_id);
  saveLocationInventory(inv);
}

// ── Location Inventory (bulk) ──
export function getLocationInventory(): LocationInventoryEntry[] { return load(KEYS.locationInv, []); }
export function saveLocationInventory(inv: LocationInventoryEntry[]) { save(KEYS.locationInv, inv); }

export function getLocationQty(location_id: string, item_code: string): number {
  return getLocationInventory().find(e => e.location_id === location_id && e.item_code === item_code)?.qty ?? 0;
}

// ── Transfers ──
export function transferBulkToLocation(item_code: string, qty: number, location_id: string, locationName?: string): boolean {
  const centralQty = getCentralQty(item_code);
  if (qty > centralQty) return false;
  setCentralQty(item_code, centralQty - qty);
  const inv = getLocationInventory();
  const idx = inv.findIndex(e => e.location_id === location_id && e.item_code === item_code);
  if (idx >= 0) inv[idx].qty += qty;
  else inv.push({ location_id, item_code, qty });
  saveLocationInventory(inv);
  // Log transfer
  import('./warehouseHistory').then(({ addTransferLogEntry }) => {
    addTransferLogEntry({ item_code, qty, from: 'Central', to: locationName || location_id, type: 'bulk' });
  });
  return true;
}

export function returnBulkFromLocation(item_code: string, qty: number, location_id: string) {
  const inv = getLocationInventory();
  const idx = inv.findIndex(e => e.location_id === location_id && e.item_code === item_code);
  if (idx < 0) return;
  const actual = Math.min(qty, inv[idx].qty);
  inv[idx].qty -= actual;
  if (inv[idx].qty <= 0) inv.splice(idx, 1);
  saveLocationInventory(inv);
  setCentralQty(item_code, getCentralQty(item_code) + actual);
}

export function returnAllFromLocation(location_id: string): { bulkItems: number; bulkQty: number; serialCount: number } {
  // Bulk
  const inv = getLocationInventory();
  const locItems = inv.filter(e => e.location_id === location_id);
  let bulkItems = 0, bulkQty = 0;
  for (const entry of locItems) {
    setCentralQty(entry.item_code, getCentralQty(entry.item_code) + entry.qty);
    bulkQty += entry.qty;
    bulkItems++;
  }
  saveLocationInventory(inv.filter(e => e.location_id !== location_id));

  // Serials
  const units = getSerials();
  let serialCount = 0;
  for (const u of units) {
    if (u.current_location_id === location_id) {
      u.current_location_id = 'CENTRAL';
      serialCount++;
    }
  }
  saveSerials(units);
  return { bulkItems, bulkQty, serialCount };
}

export function getLocationItems(location_id: string): { item_code: string; item_desc: string; is_serialized: boolean; qty: number; serials: SerialUnit[] }[] {
  const catalog = getCatalog();
  const result: { item_code: string; item_desc: string; is_serialized: boolean; qty: number; serials: SerialUnit[] }[] = [];

  for (const cat of catalog) {
    if (cat.is_serialized) {
      const serials = getSerialsAtLocation(cat.item_code, location_id);
      if (serials.length > 0) result.push({ item_code: cat.item_code, item_desc: cat.item_desc, is_serialized: true, qty: serials.length, serials });
    } else {
      const qty = getLocationQty(location_id, cat.item_code);
      if (qty > 0) result.push({ item_code: cat.item_code, item_desc: cat.item_desc, is_serialized: false, qty, serials: [] });
    }
  }
  return result;
}
