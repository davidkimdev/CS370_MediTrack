import { useCallback, useEffect, useMemo, useState } from 'react';

export interface FieldHistoryEntry {
  value: string;
  lastUsed: number;
}

interface FieldHistoryOptions {
  maxEntries?: number;
  ttlMs?: number;
  minLength?: number;
}

interface FieldHistoryStore {
  [key: string]: FieldHistoryEntry[];
}

const STORAGE_KEY = 'meditrack_field_history_v1';
const DEFAULT_MAX_ENTRIES = 20;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const isBrowser = typeof window !== 'undefined';

function readStorage(): FieldHistoryStore {
  if (!isBrowser) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as FieldHistoryStore;
    }
  } catch (error) {
    console.warn('[useFieldHistory] Failed to read storage', error);
  }

  return {};
}

function writeStorage(data: FieldHistoryStore): void {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[useFieldHistory] Failed to write storage', error);
  }
}

function normalizeEntries(entries: FieldHistoryEntry[], ttlMs: number): FieldHistoryEntry[] {
  if (!entries?.length) {
    return [];
  }

  const cutoff = Date.now() - ttlMs;
  return entries
    .filter((entry) => Boolean(entry?.value?.trim()) && entry.lastUsed >= cutoff)
    .sort((a, b) => b.lastUsed - a.lastUsed);
}

export function useFieldHistory(
  fieldKey: string,
  options?: FieldHistoryOptions,
) {
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const minLength = options?.minLength ?? 1;

  const [history, setHistory] = useState<FieldHistoryEntry[]>([]);
  const [query, setQuery] = useState('');

  const loadEntries = useCallback((): FieldHistoryEntry[] => {
    const store = readStorage();
    const entries = normalizeEntries(store[fieldKey] ?? [], ttlMs);

    if (entries.length !== (store[fieldKey]?.length ?? 0)) {
      store[fieldKey] = entries;
      writeStorage(store);
    }

    return entries;
  }, [fieldKey, ttlMs]);

  useEffect(() => {
    setHistory(loadEntries());
  }, [loadEntries]);

  const persistEntries = useCallback((entries: FieldHistoryEntry[]) => {
    const store = readStorage();
    store[fieldKey] = entries;
    writeStorage(store);
    setHistory(entries);
  }, [fieldKey]);

  const recordValue = useCallback((rawValue: string) => {
    if (!rawValue) {
      return;
    }

    const value = rawValue.trim();
    if (!value || value.length < minLength) {
      return;
    }

    const store = readStorage();
    const existing = normalizeEntries(store[fieldKey] ?? [], ttlMs);

    const lowerValue = value.toLowerCase();
    const filtered = existing.filter((entry) => entry.value.toLowerCase() !== lowerValue);
    const nextEntries: FieldHistoryEntry[] = [
      { value, lastUsed: Date.now() },
      ...filtered,
    ].slice(0, maxEntries);

    store[fieldKey] = nextEntries;
    writeStorage(store);
    setHistory(nextEntries);
  }, [fieldKey, maxEntries, minLength, ttlMs]);

  const clearEntry = useCallback((rawValue: string) => {
    const value = rawValue?.trim();
    if (!value) {
      return;
    }

    const store = readStorage();
    const existing = normalizeEntries(store[fieldKey] ?? [], ttlMs);
    const nextEntries = existing.filter((entry) => entry.value.toLowerCase() !== value.toLowerCase());
    persistEntries(nextEntries);
  }, [fieldKey, ttlMs, persistEntries]);

  const clearAll = useCallback(() => {
    persistEntries([]);
  }, [persistEntries]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value ?? '');
  }, []);

  const suggestions = useMemo(() => {
    if (!history.length) {
      return [] as FieldHistoryEntry[];
    }

    const activeQuery = query.trim().toLowerCase();
    const matches = activeQuery
      ? history.filter((entry) => entry.value.toLowerCase().includes(activeQuery))
      : history;

    return matches.slice(0, 6);
  }, [history, query]);

  return {
    history,
    suggestions,
    updateQuery,
    recordValue,
    clearEntry,
    clearAll,
    hasHistory: history.length > 0,
  } as const;
}
