import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Something the global search can take you to: a page, or a shortcut into a page. */
export interface SearchTarget {
  label: string;
  to: string;
  /** Shown on the right, e.g. "Page" or "Action". */
  kind: string;
  /** Extra words that should also find this item. */
  keywords?: string;
}

function matches(target: SearchTarget, query: string) {
  const haystack = `${target.label} ${target.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** Search box in the top bar: type, pick a result with the arrow keys or the mouse, press Enter to go there. */
export default function GlobalSearch({ targets }: { targets: SearchTarget[] }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => (query.trim() ? targets.filter((t) => matches(t, query)) : targets), [targets, query]);

  // Ctrl+K (or Cmd+K on a Mac) jumps to the search box from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(target: SearchTarget) {
    navigate(target.to);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="global-search">
      <input
        ref={inputRef}
        type="search"
        placeholder="Search pages and actions…"
        aria-label="Search pages and actions"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {!query && <kbd>Ctrl K</kbd>}
      {open && (
        <ul className="global-search-results" id="global-search-results" role="listbox">
          {results.length === 0 && <li className="empty-result">No pages match “{query}”</li>}
          {results.map((target, i) => (
            <li
              key={target.to + target.label}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              // mousedown (not click) so it fires before the input loses focus and closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                go(target);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{target.label}</span>
              <span className="small muted">{target.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
