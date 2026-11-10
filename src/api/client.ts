import type { Paginated } from "./types";

const BASE = "/api/v1";
const ACCESS_KEY = "cybermate.access";
const REFRESH_KEY = "cybermate.refresh";

/** Turns a DRF error body ({detail}, {field: [msgs]}, [msgs]) into readable text. */
export function formatError(data: unknown): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(formatError).join(" ");
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        key === "detail" || key === "non_field_errors"
          ? formatError(value)
          : `${key.replace(/_/g, " ")}: ${formatError(value)}`,
      )
      .join("\n");
  }
  return String(data);
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(formatError(data) || `Request failed (${status})`);
    this.status = status;
    this.data = data;
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode etc.): the session just won't survive a reload.
  }
}

export const tokens = {
  get access() {
    return readStorage(ACCESS_KEY);
  },
  get refresh() {
    return readStorage(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    writeStorage(ACCESS_KEY, access);
    if (refresh) writeStorage(REFRESH_KEY, refresh);
  },
  clear() {
    writeStorage(ACCESS_KEY, null);
    writeStorage(REFRESH_KEY, null);
  },
};

let onAuthLost: () => void = () => {};

/** Called when both tokens are no longer valid, so the app can show the login page. */
export function setOnAuthLost(handler: () => void) {
  onAuthLost = handler;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 300);
  }
}

// Several requests can fail with 401 at once; they all share one refresh call.
let refreshing: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { access: string; refresh?: string };
        tokens.set(data.access, data.refresh);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const queryString = params.toString();
  const url = `${BASE}${path}${queryString ? `?${queryString}` : ""}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const access = tokens.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && retry && tokens.refresh) {
    if (await refreshAccessToken()) return api<T>(path, options, false);
    tokens.clear();
    onAuthLost();
  }

  if (res.status === 204) return undefined as T;
  const data = await parseBody(res);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Follows pagination and returns every row (capped, to stay safe on big tables). */
export async function fetchAll<T>(path: string, query: Record<string, QueryValue> = {}, maxPages = 40): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await api<Paginated<T>>(path, { query: { ...query, page } });
    rows.push(...data.results);
    if (!data.next) break;
  }
  return rows;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseBody(res);
  if (!res.ok) throw new ApiError(res.status, data);
  const { access, refresh } = data as { access: string; refresh: string };
  tokens.set(access, refresh);
}
