import { useState } from "react";
import { api } from "../api/client";
import { Role } from "../api/types";
import { ErrorBox, Field, FormModal, ListState, PageHeader, Pagination } from "../components/ui";
import { useFormState, usePaginated } from "../hooks";
import { errorMessage, formatDate } from "../utils";

// The backend's permission checks look for these exact role codes.
const BUILT_IN = new Set(["admin", "manager", "employee"]);

export default function RolesPage() {
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [actionError, setActionError] = useState("");
  const list = usePaginated<Role>("/roles/", { ordering: "name" });
  const rows = list.data?.results ?? [];

  async function remove(role: Role) {
    if (!window.confirm(`Delete the "${role.name}" role? Users lose it immediately.`)) return;
    setActionError("");
    try {
      await api(`/roles/${role.id}/`, { method: "DELETE" });
      await list.reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="Admin, manager and employee drive permissions; other roles are labels only."
        actions={
          <button className="button" onClick={() => setEditing("new")}>
            Add role
          </button>
        }
      />
      <ErrorBox message={actionError} />
      <ListState loading={list.loading} error={list.error} empty={rows.length === 0}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Description</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>
                    <code>{role.code}</code>
                  </td>
                  <td className="wrap">{role.description || "—"}</td>
                  <td className="nowrap">{formatDate(role.created_at)}</td>
                  <td className="actions">
                    <button className="link" onClick={() => setEditing(role)}>
                      Edit
                    </button>
                    {!BUILT_IN.has(role.code) && (
                      <button className="link danger" onClick={() => remove(role)}>
                        Delete
                      </button>
                    )}
                  </td>
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
