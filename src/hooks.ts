import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import type { Paginated } from "./api/types";
import { errorMessage } from "./utils";

type Query = Record<string, string | number | undefined>;

/** Loads one page of a DRF list endpoint and resets to page 1 whenever the filters change. */
export function usePaginated<T>(path: string, query: Query) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    setPage(1);
  }, [queryKey]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters = JSON.parse(queryKey) as Query;
      setData(await api<Paginated<T>>(path, { query: { ...filters, page } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [path, queryKey, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, page, setPage, reload };
}

/** Returns `value` only after it has stopped changing for `delay` ms (for search boxes). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Tracks which table rows are ticked. Only rows that are still on screen stay selected,
 * so changing page, filtering or reloading after a delete drops the rest automatically.
 */
export function useSelection<T extends { id: number }>(rows: T[]) {
  const [ids, setIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setIds((current) => {
      const visible = new Set(rows.map((row) => row.id));
      const kept = [...current].filter((id) => visible.has(id));
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [rows]);

  const selected = useMemo(() => rows.filter((row) => ids.has(row.id)), [rows, ids]);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const toggle = useCallback((id: number) => {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setIds(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }, [allSelected, rows]);

  const clear = useCallback(() => setIds(new Set()), []);

  return {
    selected,
    /** The one selected row, or null when zero or several are selected. */
    single: selected.length === 1 ? selected[0] : null,
    isSelected: (id: number) => ids.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected: selected.length > 0 && !allSelected,
  };
}

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Small form-state helper: `bind("name")` gives the value/onChange props for an input. */
export function useFormState<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const bind = (key: keyof T) => ({
    value: values[key],
    onChange: (e: ChangeEvent<FieldElement>) => {
      const next = e.target.value;
      setValues((current) => ({ ...current, [key]: next }));
    },
  });
  return { values, setValues, bind };
}
