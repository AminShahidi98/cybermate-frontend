import { ChangeEvent, useCallback, useEffect, useState } from "react";
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
