// Simple IndexedDB-backed offline store for medications and pending dispenses
// Uses a single database "medtrack" with object stores: medications, pendingDispenses, pendingLots, metadata
import type { Medication, DispensingRecord, InventoryItem } from '../types/medication';

type PendingDispense = Omit<DispensingRecord, 'id' | 'notes'> & {
  id: string; // local temp id
};

type PendingLot = Omit<InventoryItem, 'id' | 'isExpired'> & {
  id: string; // local temp id
};

const DB_NAME = 'medtrack';
const DB_VERSION = 1;
const STORES = {
  medications: 'medications',
  pendingDispenses: 'pendingDispenses',
  pendingLots: 'pendingLots',
  metadata: 'metadata',
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.medications)) {
        db.createObjectStore(STORES.medications, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.pendingDispenses)) {
        db.createObjectStore(STORES.pendingDispenses, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.pendingLots)) {
        db.createObjectStore(STORES.pendingLots, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.metadata)) {
        db.createObjectStore(STORES.metadata);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T = void>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const db = await openDB();
        const transaction = db.transaction(store, mode);
        const objectStore = transaction.objectStore(store);
        transaction.oncomplete = () => resolve(undefined as unknown as T);
        transaction.onerror = () => reject(transaction.error);
        run(objectStore);
      } catch (e) {
        reject(e);
      }
    })();
  });
}

async function getAllFromStore<T>(store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const db = await openDB();
        const transaction = db.transaction(store, 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    })();
  });
}

async function getFromStore<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const db = await openDB();
        const transaction = db.transaction(store, 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    })();
  });
}

async function putInStore<T>(store: string, value: T): Promise<void> {
  return tx(store, 'readwrite', (s) => {
    s.put(value as unknown as IDBValidKey);
  });
}

async function putManyInStore<T>(store: string, values: T[]): Promise<void> {
  return tx(store, 'readwrite', (s) => {
    for (const v of values) s.put(v as unknown as IDBValidKey);
  });
}

async function deleteFromStore(store: string, key: IDBValidKey): Promise<void> {
  return tx(store, 'readwrite', (s) => {
    s.delete(key);
  });
}

async function clearStore(store: string): Promise<void> {
  return tx(store, 'readwrite', (s) => {
    s.clear();
  });
}

export const OfflineStore = {
  // Medications cache
  async setMedications(meds: Medication[]): Promise<void> {
    await clearStore(STORES.medications);
    await putManyInStore(STORES.medications, meds);
  },
  async getAllMedications(): Promise<Medication[]> {
    return getAllFromStore<Medication>(STORES.medications);
  },
  async updateMedicationStock(medicationId: string, newStock: number): Promise<void> {
    const med = await getFromStore<Medication>(STORES.medications, medicationId);
    if (med) {
      const updated: Medication = {
        ...med,
        currentStock: newStock,
        isAvailable: newStock > 0,
        lastUpdated: new Date(),
      };
      await putInStore(STORES.medications, updated);
    }
  },
  async incrementMedicationStock(medicationId: string, quantity: number): Promise<void> {
    if (quantity === 0) return;
    const med = await getFromStore<Medication>(STORES.medications, medicationId);
    if (!med) {
      console.warn('Offline cache missing medication for stock increment', medicationId);
      return;
    }
    const updatedStock = Math.max(0, (med.currentStock || 0) + quantity);
    const updated: Medication = {
      ...med,
      currentStock: updatedStock,
      isAvailable: updatedStock > 0,
      lastUpdated: new Date(),
    };
    await putInStore(STORES.medications, updated);
  },
  async decrementMedicationStock(medicationId: string, quantity: number): Promise<void> {
    const med = await getFromStore<Medication>(STORES.medications, medicationId);
    if (med) {
      const newStock = Math.max(0, (med.currentStock || 0) - quantity);
      await OfflineStore.updateMedicationStock(medicationId, newStock);
    }
  },

  // Pending dispenses queue
  async enqueueDispense(rec: Omit<PendingDispense, 'id'>): Promise<PendingDispense> {
    const id = `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const value: PendingDispense = { ...rec, id };
    await putInStore(STORES.pendingDispenses, value);
    return value;
  },
  async getPendingDispenses(): Promise<PendingDispense[]> {
    return getAllFromStore<PendingDispense>(STORES.pendingDispenses);
  },
  async removePendingDispense(id: string): Promise<void> {
    await deleteFromStore(STORES.pendingDispenses, id);
  },
  async clearPendingDispenses(): Promise<void> {
    await clearStore(STORES.pendingDispenses);
  },
  async getPendingCount(): Promise<number> {
    const dispenses = await OfflineStore.getPendingDispenses();
    const lots = await OfflineStore.getPendingLots();
    return dispenses.length + lots.length;
  },

  // Pending lots queue
  async enqueueLot(lot: Omit<PendingLot, 'id'>): Promise<PendingLot> {
    const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const value: PendingLot = { ...lot, id };
    await putInStore(STORES.pendingLots, value);
    return value;
  },
  async getPendingLots(): Promise<PendingLot[]> {
    return getAllFromStore<PendingLot>(STORES.pendingLots);
  },
  async removePendingLot(id: string): Promise<void> {
    await deleteFromStore(STORES.pendingLots, id);
  },
  async clearPendingLots(): Promise<void> {
    await clearStore(STORES.pendingLots);
  },

  // Metadata
  async setLastSync(date: Date): Promise<void> {
    return tx(STORES.metadata, 'readwrite', (s) => {
      s.put(date.toISOString(), 'lastSync');
    });
  },
  async getLastSync(): Promise<Date | null> {
    const iso = await getFromStore<string>(STORES.metadata, 'lastSync');
    return iso ? new Date(iso) : null;
  },
};

export type { PendingDispense, PendingLot };
