// Transfer history / audit trail – localStorage persistence

export interface TransferLogEntry {
  id: string;
  timestamp: string; // ISO
  item_code: string;
  qty: number;
  from: string; // 'CENTRAL' or location name
  to: string;   // 'CENTRAL' or location name
  type: 'bulk' | 'serial';
  serial_numbers?: string[];
  note?: string;
}

const KEY = 'wh_transfer_log';

function load(): TransferLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(entries: TransferLogEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function getTransferLog(): TransferLogEntry[] {
  return load().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addTransferLogEntry(entry: Omit<TransferLogEntry, 'id' | 'timestamp'>) {
  const log = load();
  log.push({ ...entry, id: crypto.randomUUID(), timestamp: new Date().toISOString() });
  save(log);
}

export function clearTransferLog() {
  localStorage.removeItem(KEY);
}
