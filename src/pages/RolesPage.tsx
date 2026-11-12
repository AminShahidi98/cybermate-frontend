import { useState } from "react";
import { api } from "../api/client";
import { Role } from "../api/types";
import { ListToolbar, SelectCheckbox, deleteEach, rowClickToggles } from "../components/ListToolbar";
import { ErrorBox, Field, FormModal, ListState, PageHeader, Pagination } from "../components/ui";
import { useDebounced, useFormState, usePaginated, useSelection } from "../hooks";
import { formatDate } from "../utils";

// The backend's permission checks look for these exact role codes.
const BUILT_IN = new Set(["admin", "manager", "employee"]);

export default function RolesPage() {
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const list = usePaginated<Role>("/roles/", { search: debouncedSearch, ordering: "name" });
  const rows = list.data?.results ?? [];
  const selection = useSelection(rows);
  const includesBuiltIn = selection.selected.some((role) => BUILT_IN.has(role.code));

  async function removeSelected() {
    const targets = selection.selected;
    const question = targets.length === 1 ? `Delete the "${targets[0].name}" role?` : `Delete these ${targets.length} roles?`;
    if (!window.confirm(`${question} Users lose it immediately.`)) return;
    setActionError("");
    setActionError(await deleteEach(targets, (role) => `/roles/${role.id}/`, (role) => role.name));
    await list.reload();
  }

  return (
    <>
      <PageHeader title="Roles" subtitle="Admin, manager and employee drive permissions; other roles are labels only." />

      <ListToolbar
        onNew={{ onClick: () => setEditing("new") }}
        onEdit={{
          onClick: () => selection.single && setEditing(selection.single),
          disabled: !selection.single,
          title: selection.single ? undefined : "Select one role to edit",
        }}
        onDelete={{
          onClick: removeSelected,
          disabled: selection.selected.length === 0 || includesBuiltIn,
          title: includesBuiltIn
            ? "Built-in roles (admin, manager, employee) can't be deleted"
            : selection.selected.length === 0
              ? "Select roles to delete"
              : undefined,
        }}
        search={{ value: search, onChange: setSearch, placeholder: "Search name or code…" }}
        selectedCount={selection.selected.length}
      />

      <ErrorBox message={actionError} />
      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} emptyText="No roles match.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="select-col">
                  <SelectCheckbox
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected}
                    onChange={selection.toggleAll}
                    label="Select all roles on this page"
                  />
                </th>
                <th>Name</th>
                <th>Code</th>
                <th>Description</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((role) => (
                <tr
                  key={role.id}
                  className={`selectable ${selection.isSelected(role.id) ? "selected" : ""}`}
                  onClick={rowClickToggles(() => selection.toggle(role.id))}
                >
                  <td className="select-col">
                    <input
                      type="checkbox"
                      checked={selection.isSelected(role.id)}
                      onChange={() => selection.toggle(role.id)}
                      aria-label={`Select ${role.name}`}
                    />
                  </td>
                  <td>{role.name}</td>
                  <td>
                    <code>{role.code}</code>
                  </td>
                  <td className="wrap">{role.description || "—"}</td>
                  <td className="nowrap">{formatDate(role.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && <Pagination count={list.data.count} page={list.page} onPage={list.setPage} />}
      </ListState>

      {editing && (
        <RoleForm
          role={editing === "new" ? null : editing}
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

function RoleForm({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: () => void }) {
  const { values, bind } = useFormState({
    name: role?.name ?? "",
    code: role?.code ?? "",
    description: role?.description ?? "",
  });
  const builtIn = role !== null && BUILT_IN.has(role.code);

  async function save() {
    if (role) await api(`/roles/${role.id}/`, { method: "PATCH", body: values });
    else await api("/roles/", { method: "POST", body: values });
    onSaved();
  }

  return (
    <FormModal title={role ? `Edit ${role.name}` : "Add role"} onClose={onClose} onSubmit={save}>
      <Field label="Name">
        <input required maxLength={80} {...bind("name")} />
      </Field>
      <Field
        label="Code"
        hint={builtIn ? "Built-in role: the code can't be changed here, because permissions depend on it." : "Letters, numbers, - and _ only."}
      >
        <input required maxLength={40} pattern="[-a-zA-Z0-9_]+" disabled={builtIn} {...bind("code")} />
      </Field>
      <Field label="Description">
        <textarea rows={2} {...bind("description")} />
      </Field>
    </FormModal>
  );
}
