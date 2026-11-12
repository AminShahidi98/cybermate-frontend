import { MouseEvent, ReactNode, useEffect, useRef } from "react";
import { api } from "../api/client";
import { errorMessage } from "../utils";

/** One toolbar button. Leave it out entirely when the user isn't allowed to do that action at all. */
export interface ToolbarAction {
  onClick: () => void;
  /** Greyed out, e.g. because nothing (or more than one row) is selected. */
  disabled?: boolean;
  /** Tooltip, mainly to explain why the button is disabled. */
  title?: string;
  label?: string;
}

/**
 * New / Edit / Delete buttons joined with the search box into one bar.
 * Extra filters (dropdowns, checkboxes) go in `children` and appear after it.
 */
export function ListToolbar({
  onNew,
  onEdit,
  onDelete,
  search,
  selectedCount = 0,
  children,
}: {
  onNew?: ToolbarAction;
  onEdit?: ToolbarAction;
  onDelete?: ToolbarAction;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  selectedCount?: number;
  children?: ReactNode;
}) {
  const hasGroup = Boolean(onNew || onEdit || onDelete || search);

  return (
    <div className="list-toolbar">
      {hasGroup && (
        <div className="toolbar-group">
          {onNew && (
            <button type="button" className="toolbar-button primary" onClick={onNew.onClick} disabled={onNew.disabled} title={onNew.title}>
              {onNew.label ?? "New"}
            </button>
          )}
          {onEdit && (
            <button type="button" className="toolbar-button" onClick={onEdit.onClick} disabled={onEdit.disabled} title={onEdit.title}>
              {onEdit.label ?? "Edit"}
            </button>
          )}
          {onDelete && (
            <button type="button" className="toolbar-button danger" onClick={onDelete.onClick} disabled={onDelete.disabled} title={onDelete.title}>
              {onDelete.label ?? "Delete"}
            </button>
          )}
          {search && (
            <input
              type="search"
              className="toolbar-search"
              placeholder={search.placeholder ?? "Search…"}
              aria-label={search.placeholder ?? "Search"}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
            />
          )}
        </div>
      )}
      {children}
      {selectedCount > 0 && <span className="muted small toolbar-count">{selectedCount} selected</span>}
    </div>
  );
}

/** A checkbox that can also show the "some selected" dash, used in table headers. */
export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} />;
}

/**
 * Lets a click anywhere on a table row tick its checkbox,
 * except clicks on the row's own buttons, links and inputs.
 */
export function rowClickToggles(toggle: () => void) {
  return (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, label")) return;
    toggle();
  };
}

/**
 * Sends DELETE for each item one by one. Returns "" when all succeeded,
 * otherwise one line per failure, ready for an <ErrorBox>.
 */
export async function deleteEach<T extends { id: number }>(
  items: T[],
  url: (item: T) => string,
  describe: (item: T) => string,
): Promise<string> {
  const failures: string[] = [];
  for (const item of items) {
    try {
      await api(url(item), { method: "DELETE" });
    } catch (e) {
      failures.push(items.length > 1 ? `${describe(item)}: ${errorMessage(e)}` : errorMessage(e));
    }
  }
  return failures.join("\n");
}
