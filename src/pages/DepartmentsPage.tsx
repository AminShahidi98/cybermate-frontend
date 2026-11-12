import { useState } from "react";
import { api } from "../api/client";
import { DEPARTMENT_STATUS, Department } from "../api/types";
import { useCurrentUser } from "../auth/AuthContext";
import { ListToolbar, SelectCheckbox, deleteEach, rowClickToggles } from "../components/ListToolbar";
import { ErrorBox, Field, FormModal, ListState, PageHeader, Pagination, StatusBadge } from "../components/ui";
import { useDebounced, useFormState, usePaginated, useSelection } from "../hooks";
import { formatDate } from "../utils";

export default function DepartmentsPage() {
  const { isAdmin, isManager } = useCurrentUser();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const list = usePaginated<Department>("/departments/", { search: debouncedSearch, ordering: "name" });
  const rows = list.data?.results ?? [];
  const selection = useSelection(rows);
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [actionError, setActionError] = useState("");
  // Managers and admins create and edit; only admins delete (same rules as the API).
  const canSelect = isManager;

  async function removeSelected() {
    const targets = selection.selected;
    const question = targets.length === 1 ? `Delete the "${targets[0].name}" department?` : `Delete these ${targets.length} departments?`;
    if (!window.confirm(`${question} This can't be undone.`)) return;
    setActionError("");
    setActionError(await deleteEach(targets, (d) => `/departments/${d.id}/`, (d) => d.name));
    await list.reload();
  }

  return (
    <>
      <PageHeader title="Departments" subtitle="All departments in the company." />

      <ListToolbar
        onNew={isManager ? { onClick: () => setEditing("new") } : undefined}
        onEdit={
          isManager
            ? {
                onClick: () => selection.single && setEditing(selection.single),
                disabled: !selection.single,
                title: selection.single ? undefined : "Select one department to edit",
              }
            : undefined
        }
        onDelete={
          isAdmin
            ? {
                onClick: removeSelected,
                disabled: selection.selected.length === 0,
                title: selection.selected.length === 0 ? "Select departments to delete" : undefined,
              }
            : undefined
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search departments…" }}
        selectedCount={selection.selected.length}
      />

      <ErrorBox message={actionError} />

      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No departments yet.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {canSelect && (
                  <th className="select-col">
                    <SelectCheckbox
                      checked={selection.allSelected}
                      indeterminate={selection.someSelected}
                      onChange={selection.toggleAll}
                      label="Select all departments on this page"
                    />
                  </th>
                )}
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.id}
                  className={canSelect ? `selectable ${selection.isSelected(d.id) ? "selected" : ""}` : undefined}
                  onClick={canSelect ? rowClickToggles(() => selection.toggle(d.id)) : undefined}
                >
                  {canSelect && (
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(d.id)}
                        onChange={() => selection.toggle(d.id)}
                        aria-label={`Select ${d.name}`}
                      />
                    </td>
                  )}
                  <td>{d.name}</td>
                  <td className="wrap">{d.description || "—"}</td>
                  <td>
                    <StatusBadge status={d.status} label={DEPARTMENT_STATUS[d.status]} />
                  </td>
                  <td className="nowrap">{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && <Pagination count={list.data.count} page={list.page} onPage={list.setPage} />}
      </ListState>

      {editing && (
        <DepartmentForm
          department={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void list.reload();
          }}
        />
      )}
    </>
  );
}

function DepartmentForm({ department, onClose, onSaved }: { department: Department | null; onClose: () => void; onSaved: () => void }) {
  const { values, bind } = useFormState({
    name: department?.name ?? "",
    description: department?.description ?? "",
    status: department?.status ?? "active",
  });

  async function save() {
    const body = { ...values, name: values.name.trim() };
    if (department) await api(`/departments/${department.id}/`, { method: "PATCH", body });
    else await api("/departments/", { method: "POST", body });
    onSaved();
  }

  return (
    <FormModal title={department ? "Edit department" : "New department"} onClose={onClose} onSubmit={save}>
      <div className="grid-2">
        <Field label="Name">
          <input required maxLength={50} {...bind("name")} />
        </Field>
        <Field label="Status">
          <select {...bind("status")}>
            {Object.entries(DEPARTMENT_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description" hint="Optional.">
        <textarea rows={3} maxLength={300} {...bind("description")} />
      </Field>
    </FormModal>
  );
}
